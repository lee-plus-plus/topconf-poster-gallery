const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function extract(source,name){
  const start=source.indexOf('function '+name+'('),end=source.indexOf('\n}',start);
  assert(start>=0&&end>=0);return source.slice(start,end+2);
}
class FakeImage extends EventTarget{
  constructor(){super();this.dataset={};this.isConnected=true;this.attrs={};}
  set src(value){this.attrs.src=value;}
  get src(){return this.attrs.src;}
  removeAttribute(name){delete this.attrs[name];}
}
(async()=>{
  const context=vm.createContext({window:{},URL,Blob,AbortSignal,AbortController,DOMException,Event,setTimeout,clearTimeout,document:{createElement:()=>({value:'',set innerHTML(v){this.value=v;}})}});
  vm.runInContext(read('data/index-data.js'),context);
  vm.runInContext(read('assets/catalog.js'),context);
  vm.runInContext(read('assets/images.js'),context);
  const app=read('assets/app.js');
  vm.runInContext("const groups=['venue','year','type','topic'];const defaults=()=>({q:'',venue:[],year:[],type:['Oral','Spotlight'],topic:[],sort:'relevance',view:'combined',columns:'2'});"+extract(app,'sanitizeState'),context);
  const state=vm.runInContext("sanitizeState({sort:'bad',view:'bad',columns:99,q:{bad:true},venue:['ICML','bad'],year:['2025','9999'],topic:['其他方向'],type:42})",context);
  assert.equal(state.sort,'relevance');assert.equal(state.view,'combined');assert.equal(state.columns,'2');assert.equal(state.q,'');assert.deepEqual([...state.venue],['ICML']);assert.deepEqual([...state.year],['2025']);assert.deepEqual([...state.topic],[]);
  let observed=0,pending=1;
  Object.assign(context,{BATCH_SIZE:24,state:{view:'images'},busy:false,hasMore:true,loadMoreObserver:{disconnect(){},observe(){observed++;}},$:id=>id==='error'?{hidden:true}:id==='cards'?{querySelectorAll:selector=>selector.includes('loading')?Array(pending).fill({}):Array.from({length:23},()=>({getBoundingClientRect:()=>({top:0})}))}:{}});
  vm.runInContext(extract(app,'observeLoadAhead'),context);
  vm.runInContext('observeLoadAhead()',context);assert.equal(observed,1,'One slow image must not block preloading');pending=25;vm.runInContext('observeLoadAhead()',context);assert.equal(observed,1,'Do not enqueue unlimited batches');

  const Loader=vm.runInContext('PosterImageLoader',context);
  const requests=[];
  const loader=new Loader({limit:2,timeout:1000,cache:{get(url,signal){requests.push({url,signal});return new Promise(()=>{});}}});
  const imgs=[new FakeImage(),new FakeImage(),new FakeImage()];
  const jobs=imgs.map((img,i)=>loader.load(img,'https://example.test/'+i));await flush();
  assert.equal(requests.length,2,'Concurrency cap');imgs.forEach(img=>loader.release(img));await Promise.all(jobs);await flush();
  assert(requests.every(r=>r.signal.aborted));assert.equal(requests.length,2,'Canceled queued image must never fetch');assert.equal(loader.queue.active,0);assert.equal(loader.queue.waiting.length,0);
  for(const cache of [{get:()=>new Promise(()=>{})},{get:async()=>({source:'remote'})}]){
    const bounded=new Loader({timeout:15,cache}),img=new FakeImage();let errors=0;img.addEventListener('error',()=>errors++);
    await bounded.load(img,'https://example.test/stalled');await flush();assert.equal(errors,1,'Fetch and native img fallback both have final timeouts');assert.equal(bounded.queue.active,0);
  }
  let finish;
  const racing=new Loader({cache:{get:()=>new Promise(resolve=>finish=resolve)}}),removed=new FakeImage();
  const old=racing.load(removed,'https://example.test/old');await flush();racing.release(removed);finish({source:'remote'});await old;assert.equal(removed.src,undefined,'Canceled result must not set an image source');

  const quality=vm.runInContext(`(()=>{
    const source=POSTER_CONFIG.sources[0];
    const make=count=>({results:Array.from({length:100},(_,i)=>({id:i,name:'Paper '+i,eventtype:'Poster',decision:'Oral',authors:i<count?[{fullname:'Alice'}]:[{fullname:''},{fullname:'unknown'}],paper_url:'https://openreview.net/forum?id='+i,eventmedia:[{type:'Poster',file:'/media/'+i+'.png'}]}))});
    return [0,89,90,100].map(n=>{const raw=make(n);return completeSource(raw,normalizePosters(raw,source));});
  })()`,context);
  assert.deepEqual([...quality],[false,false,true,true]);
  context.fetch=async()=>({ok:true,json:async()=>({results:[{id:1,name:'Paper',eventtype:'Poster',decision:'Oral',authors:[{fullname:''},{fullname:''}],paper_url:'https://openreview.net/forum?id=1',eventmedia:[{type:'Poster',file:'/media/1.png'}]}]})});
  const preserved=await vm.runInContext(`(async()=>{const c=new BrowserPosterCatalog();c.sources=c.sources.slice(0,1);const id=c.sources[0].id,before=c.items.get(id);await c.refresh(true);return c.items.get(id)===before&&Boolean(c.sources[0].error);})()`,context);
  assert(preserved,'Reject bad metadata without overwriting cached rows');
  const csv=await vm.runInContext("new BrowserPosterCatalog().exportCSV({q:'',venue:['ICML'],year:['2026'],type:[],topic:[],sort:'title'}).text()",context);
  const head=csv.split('\r\n')[0];for(const h of ['作者','条目ID','会议事件ID','来源ID','索引格式版本','索引生成时间','来源更新时间'])assert(head.includes(h));assert(csv.includes(context.window.POSTER_INDEX.generated_at));assert(csv.includes('ICML-2026-'));

  // Exercise the real mutation handler against a literal search chip in both languages.
  for(const lang of ['zh','en']){
    let ready,observer;
    const languageButton={textContent:'',setAttribute(){},addEventListener(){}};
    const doc={documentElement:{nodeType:1,matches:()=>false,hasAttribute:()=>false,childNodes:[]},getElementById:()=>languageButton,addEventListener:(event,fn)=>ready=fn};
    const locale=vm.createContext({window:{},document:doc,localStorage:{getItem:()=>lang},MutationObserver:class{constructor(fn){observer=fn;}observe(){}}});
    vm.runInContext(read('assets/i18n.js'),locale);ready();
    const attrs={'aria-label':'移除筛选：搜索：Agents'};
    const chip={nodeType:1,id:'',dataset:{i18nLiteral:'',i18nLabelPrefix:'移除筛选：搜索：',i18nLabelValue:'Agents'},matches:s=>s==='[data-i18n-literal]',getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,childNodes:[]};
    const value={nodeType:3,nodeValue:'Agents ×',parentElement:{closest:s=>s.includes('[data-i18n-literal]')?chip:null}};chip.childNodes=[value];
    observer([{type:'childList',target:{},addedNodes:[chip]}]);observer([{type:'characterData',target:value}]);
    assert.equal(value.nodeValue,'Agents ×');assert.equal(attrs['aria-label'],lang==='en'?'Remove filter: Search: Agents':'移除筛选：搜索：Agents');
    assert.equal(locale.window.PosterI18n.text('大模型应用'),lang==='en'?'LLM applications':'大模型应用');
  }
  console.log('Reliability passed: parameter fallback, preload/backlog, cancellation/concurrency, timeout fallback, 90% quality gate, CSV provenance, literal search labels.');
})().catch(error=>{console.error(error);process.exitCode=1;});
