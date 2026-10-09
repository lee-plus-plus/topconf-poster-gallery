const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.resolve(__dirname,'..');
const ctx=vm.createContext({window:{},URL,Blob,document:{createElement:()=>({value:"",set innerHTML(value){this.value=value;}})}});
vm.runInContext(fs.readFileSync(path.join(root,'data/index-data.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'assets/catalog.js'),'utf8'),ctx);
(async()=>{
 const result=await vm.runInContext(`(async()=>{
 const c=new BrowserPosterCatalog();
 const base={q:'',venue:[],year:[],type:['Oral','Spotlight'],topic:[],tag:[],sort:'relevance'};
 const query=patch=>c.query({...base,...patch},{all:true});
 const all=query({type:[]}),featured=query({});
 for(const [venue,year,decision,expected] of [['ICLR',2023,'Accept: notable-top-5%','Oral'],['ICLR',2023,'Accept: notable-top-25%','Spotlight'],['ICML',2022,'Accept for Long Presentation','Oral'],['ICML',2022,'Accept for Short Presentation','Spotlight'],['NeurIPS',2022,'Accept','Poster'],['ICML',2024,'Accept for Short Presentation','Poster']])if(normalizedAcceptance(decision,{venue,year})!==expected)throw Error('Decision mapping failed: '+decision);
 for(const row of all.rows)if(row.acceptance_type!==normalizedAcceptance(row.decision_raw,{venue:row.venue,year:row.year}))throw Error('Bundled decision mismatch');

 if(['abstract','official_topic','keywords','institutions'].some(k=>all.rows.some(r=>Object.hasOwn(r,k))))throw Error('Excluded field present');
 const past=query({year:['2021'],type:[]});if(!past.matched||!past.rows.every(r=>r.year===2021))throw Error('Older year filter failed');
 if(!all.facets.year.some(f=>f.value==='2021'))throw Error('Older year facet missing');
 const old=all.rows.find(r=>r.source_id==='ICML-2023'&&r.title==='Scaling Vision Transformers to 22 Billion Parameters');if(!old?.paper_url?.startsWith('https://proceedings.mlr.press/v202/'))throw Error('PMLR supplement missing');
 const source=POSTER_CONFIG.sources.find(s=>s.id==='ICML-2023');const refreshed=normalizePosters({results:[{id:old.event_id,eventtype:'Poster',name:old.title,authors:[{fullname:'Test'}],decision:'Accept (Oral)',eventmedia:[{type:'Poster',file:'/media/test.png'}]}]},source,[old]);if(refreshed[0].paper_url!==old.paper_url)throw Error('Refresh lost supplemented paper link');
 const icml=query({venue:['ICML']}),iclr=query({venue:['ICLR']});
 const union=query({venue:['ICML','ICLR']});
 const year=query({venue:['ICML','ICLR'],year:['2026']});
 const search=query({q:'calibration language'}),a=query({q:'calibration'}),b=query({q:'language'});
 const broad=query({topic:['大模型应用']}),fine=query({topic:[Object.keys(finePatterns)[0]]}),mixed=query({topic:['大模型应用',Object.keys(finePatterns)[0]]});
 if(mixed.matched!==new Set([...broad.rows,...fine.rows].map(r=>r.id)).size)throw Error('Unified topic OR failed');
 if(!mixed.facets.topic.some(f=>f.value===Object.keys(finePatterns)[0])||!mixed.facets.topic.some(f=>f.value==='大模型应用'))throw Error('Unified topic facet missing');
 const csv=await c.exportCSV({ ...base,venue:['ICML','ICLR'],year:['2026'] }).text();
 return {total:all.matched,featured:featured.matched,union:union.matched,parts:icml.matched+iclr.matched,year:year.matched,validYear:year.rows.every(r=>r.year===2026&&['ICML','ICLR'].includes(r.venue)),search:search.matched,searchUnion:new Set([...a.rows,...b.rows].map(r=>r.id)).size,csvLines:csv.split('\\r\\n').length};
 })()`,ctx);
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/index-report.json'),'utf8'));assert.equal(result.total,report.total);assert(result.featured>0);
 assert.equal(result.union,result.parts);assert(result.validYear);
 assert.equal(result.search,result.searchUnion);assert.equal(result.csvLines,result.year+1);
 console.log('Filtering and CSV passed:',result);
})().catch(e=>{console.error(e);process.exitCode=1});

