"""Build an offline gallery index after auditing all candidate sources."""
from pathlib import Path
from datetime import datetime, timezone
import importlib.util,json
ROOT=Path(__file__).resolve().parents[1]
def main():
    report=json.loads((ROOT/'data/source-audit.json').read_text(encoding='utf-8'))
    available=[s for s in report['sources'] if s['status']=='available']
    sources=[{k:s[k] for k in ('id','venue','year','base','url')} for s in available]
    (ROOT/'data/sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding='utf-8')
    spec=importlib.util.spec_from_file_location('sources',ROOT/'scripts/catalog_sources.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    # Base identifiers and derived labels are always included; optional fields must pass every source.
    columns=['event_id','title','authors','acceptance_type','decision_raw','directions','tags','poster_url','paper_url','conference_page']
    optional=[k for k in ('abstract','official_topic','keywords','institutions') if report['common_fields'][k]['eligible']]
    columns+=optional
    assert all(report['common_fields'][k]['eligible'] for k in ('title','authors','decision_raw','paper_url','conference_page'))
    packed=[]
    for source in sources:
        raw=ROOT/'data/raw'/(source['id']+'.json')
        rows=m.normalize(json.loads(raw.read_text(encoding='utf-8')),source)
        packed.append({'id':source['id'],'last_success':datetime.fromtimestamp(raw.stat().st_mtime,timezone.utc).isoformat(),'fallback':False,'rows':[[r.get(k,'') for k in columns] for r in rows]})
    bundle={'version':2,'generated_at':datetime.now(timezone.utc).isoformat(),'columns':columns,'sources':packed}
    target=ROOT/'data/index-data.js';temp=target.with_suffix('.js.tmp');temp.write_text('window.POSTER_INDEX='+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8');temp.replace(target)
    stats={'generated_at':bundle['generated_at'],'total':sum(len(s['rows']) for s in packed),'file_bytes':target.stat().st_size,'retained_fields':columns,'sources':[{**{k:v for k,v in s.items() if k!='rows'},'count':len(s['rows'])} for s in packed]}
    (ROOT/'data/index-report.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
    js=ROOT/'assets/catalog.js';text=js.read_text(encoding='utf-8');end=text.index(';')
    config=json.loads(text.split('=',1)[1][:end-text.index('=')-1]);config['sources']=sources;config['retainedFields']=columns
    text='const POSTER_CONFIG='+json.dumps(config,ensure_ascii=False)+';'+text[end+1:]
    js.write_text(text,encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False))
if __name__=='__main__':main()
