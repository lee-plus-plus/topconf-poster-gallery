from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import importlib.util, json
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('catalog_sources',ROOT/'scripts/catalog_sources.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RAW=ROOT/'data/raw';RAW.mkdir(exist_ok=True)
candidates=[{'id':f'{venue}-{year}','venue':venue,'year':year,'base':f'https://{host}','url':f'https://{host}/static/virtual/data/{venue.lower()}-{year}-orals-posters.json'} for venue,host,years in [('NeurIPS','neurips.cc',range(2025,2019,-1)),('ICML','icml.cc',range(2026,2019,-1)),('ICLR','iclr.cc',range(2026,2019,-1))] for year in years]

def nonempty(v):
    if isinstance(v,str):return v.strip().lower() not in ('','none','null','n/a','unknown','not available')
    return bool(v)
def run(source, refresh=False):
    target=RAW/(source['id']+'.json')
    try:
        if target.exists() and not refresh:data=json.loads(target.read_text(encoding='utf-8'))
        else:
            data=m.fetch_metadata(source['url']);target.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
        rows=m.normalize(data,source); ids={r['event_id'] for r in rows}
        events=[e for e in data['results'] if e.get('id') in ids and e.get('eventtype')=='Poster']
        row_map={r['event_id']:r for r in rows}
        total=len(events);all_posters=sum(e.get('eventtype')=='Poster' for e in data['results'])
        fields={}
        getters={'title':lambda e:e.get('name'),'authors':lambda e:all(nonempty(a.get('fullname')) for a in e.get('authors',[])) and bool(e.get('authors')),'abstract':lambda e:e.get('abstract'),'official_topic':lambda e:e.get('topic'),'keywords':lambda e:e.get('keywords'),'decision_raw':lambda e:e.get('decision'),'paper_url':lambda e:row_map[e['id']]['paper_url'],'paper_pdf_url':lambda e:e.get('paper_pdf_url'),'conference_page':lambda e:row_map[e['id']]['conference_page'],'institutions':lambda e:bool(e.get('authors')) and all(nonempty(a.get('institution')) for a in e['authors']),'institution_any_author':lambda e:any(nonempty(a.get('institution')) for a in e.get('authors',[])),'author_profile_urls':lambda e:bool(e.get('authors')) and all(nonempty(a.get('url')) for a in e['authors']),'session':lambda e:e.get('session'),'room_name':lambda e:e.get('room_name'),'poster_position':lambda e:e.get('poster_position')}
        for key,getter in getters.items():
            count=sum(nonempty(getter(e)) for e in events);fields[key]={'present':count,'total':total,'coverage':round(count/total,6) if total else 0}
        inventory={key:sum(nonempty(e.get(key)) for e in events) for key in sorted({k for e in events for k in e})}
        authors=[a for e in events for a in e.get('authors',[])]
        out={**source,'status':'available' if total else 'no_posters','poster_records':total,'poster_events':all_posters,'poster_link_coverage':round(total/all_posters,6) if all_posters else 0,'fields':fields,'event_field_presence':inventory,'authors_total':len(authors),'authors_with_institution':sum(nonempty(a.get('institution')) for a in authors)}
        print(source['id'],total,'posters; institution complete',fields['institutions']['coverage'],flush=True)
        return out
    except Exception as e:
        print(source['id'],'unavailable:',str(e)[:140],flush=True)
        return {**source,'status':'unavailable','error':str(e)[:500]}
def main(refresh=False):
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda source:run(source,refresh),candidates))
    usable=[s for s in results if s['status']=='available']
    fields={k:{'minimum_source_coverage':min(s['fields'][k]['coverage'] for s in usable),'overall_coverage':round(sum(s['fields'][k]['present'] for s in usable)/sum(s['poster_records'] for s in usable),6),'eligible':all(s['fields'][k]['coverage']>=.9 for s in usable)} for k in usable[0]['fields']}
    fields['author_profile_urls'].update(eligible=False,reliability_reason='Author URLs are internal user API routes; some older sources point to testserver, not public researcher profiles')
    fields['institution_any_author'].update(eligible=False,reliability_reason='Diagnostic only: at least one institution does not establish complete affiliations for all authors')
    report={'generated_at':datetime.now(timezone.utc).isoformat(),'threshold':.9,'denominator':'Poster records with a non-thumbnail official poster URL; institutions require every named author to have an institution','sources':results,'common_fields':fields}
    (ROOT/'data/source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('COMMON',json.dumps(fields,ensure_ascii=False),flush=True)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true',help='Refetch official metadata rather than reuse raw caches');args=parser.parse_args();main(refresh=args.refresh)
