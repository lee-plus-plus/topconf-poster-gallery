const $=id=>document.getElementById(id);
const groups=['venue','year','type','topic'];
const BATCH_SIZE=24;
const defaults=()=>({q:'',venue:[],year:[],type:['Oral','Spotlight'],topic:[],sort:'relevance',view:'combined',columns:'2'});
// Persistent image blobs are separate from the paper metadata index.
class PosterImageCache{
  constructor(){this.pending=new Map();this.ready=new Promise(resolve=>{try{const request=indexedDB.open('poster-image-cache-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'url'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);}catch{resolve(null);}});}
  async read(db,url){return new Promise(resolve=>{try{const tx=db.transaction('images','readwrite'),store=tx.objectStore('images'),request=store.get(url);let blob=null;request.onsuccess=()=>{const record=request.result;if(record){blob=record.blob;record.lastUsed=Date.now();store.put(record);}};tx.oncomplete=()=>resolve(blob);tx.onerror=tx.onabort=()=>resolve(null);}catch{resolve(null);}});}
  async save(db,url,blob){if(blob.size>32*1024*1024)return;return new Promise(resolve=>{try{const tx=db.transaction('images','readwrite'),store=tx.objectStore('images'),request=store.getAll();request.onsuccess=()=>{const records=request.result.filter(record=>record.url!==url).sort((a,b)=>a.lastUsed-b.lastUsed);let bytes=records.reduce((total,record)=>total+record.size,blob.size);while(records.length>=64||bytes>192*1024*1024){const oldest=records.shift();if(!oldest)break;bytes-=oldest.size;store.delete(oldest.url);}store.put({url,blob,size:blob.size,lastUsed:Date.now()});};tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});}
  async get(url){if(this.pending.has(url))return this.pending.get(url);const work=this.obtain(url);this.pending.set(url,work);try{return await work;}finally{this.pending.delete(url);}}
  async obtain(url){const db=await this.ready;if(!db)return {source:'remote'};const cached=await this.read(db,url);if(cached)return {blob:cached,source:'cache'};const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});if(!response.ok)throw Error('Image unavailable');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Unexpected image type');await this.save(db,url,blob);return {blob,source:'network'};}catch{return {source:'remote'};}finally{clearTimeout(timeout);}}
}
const posterImages=new PosterImageCache();
const imageVisible=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){imageVisible.unobserve(entry.target);loadPosterImage(entry.target,entry.target.dataset.src);}},{rootMargin:'600px'});
function releasePosterImage(img){if(img.dataset.blobURL){URL.revokeObjectURL(img.dataset.blobURL);delete img.dataset.blobURL;}}
async function loadPosterImage(img,url){if(img.dataset.requestURL===url)return;img.dataset.requestURL=url;releasePosterImage(img);const result=await posterImages.get(url);if(!img.isConnected||img.dataset.requestURL!==url)return;img.dataset.cacheSource=result.source;if(result.blob){const objectURL=URL.createObjectURL(result.blob);img.dataset.blobURL=objectURL;img.src=objectURL;}else img.src=url;}
function queuePosterImage(img){loadPosterImage(img,img.dataset.src);}
const catalog=new BrowserPosterCatalog();
let state=defaults(),offset=0,hasMore=false,generation=0,busy=false,controller,timer,debounce,lastSignature='',facets={};
let visibleRows=[],previewIndex=-1;
const scalar=['q','sort','view','columns'];
function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function link(url,text){const a=element('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function params(value=state){const p=new URLSearchParams();for(const key of scalar)if(value[key])p.set(key,value[key]);p.set('lab','0');p.set('field','title_authors');p.set('match','any');p.set('tag_match','any');for(const key of groups){if(value[key].length)value[key].forEach(v=>p.append(key,v));else if(key==='type')p.set(key,'all');}return p;}
function fromURL(p){const value=defaults();for(const key of scalar)if(p.has(key))value[key]=p.get(key);for(const key of groups)if(p.has(key))value[key]=p.getAll(key).flatMap(v=>v.split(',')).filter(v=>v&&v!=='all'&&v!=='featured');if(p.get('type')==='featured')value.type=['Oral','Spotlight'];if(p.has('source')){const [venue,year]=p.get('source').split('-');value.venue=[venue];value.year=[year];}value.topic=[...new Set([...value.topic,...p.getAll('tag').flatMap(v=>v.split(',')).filter(Boolean)])];return value;}
function readStored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
const initial=new URLSearchParams(location.search);
state=initial.size?fromURL(initial):{...defaults(),...readStored('poster-filter-last',{})};
for(const key of groups)if(!Array.isArray(state[key]))state[key]=[];
state.topic=[...new Set([...state.topic,...(Array.isArray(state.tag)?state.tag:[])])];delete state.tag;delete state.page;
// Single-choice controls share the same menu surface as multi-choice filters.
function syncDropdowns(){for(const key of ['sort','view','columns']){const select=$(key),menu=$('menu-'+key);menu.querySelector('summary span').textContent=select.selectedOptions[0].textContent;for(const button of menu.querySelectorAll('[data-value]')){const selected=button.dataset.value===select.value;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}}}
for(const key of ['sort','view','columns']){
  const select=$(key),menu=element('details',null,'filter-menu single-menu');menu.id='menu-'+key;
  const summary=element('summary');summary.setAttribute('aria-label',select.getAttribute('aria-label'));summary.append(element('span'));menu.append(summary);
  const popover=element('div',null,'filter-popover'),choices=element('div',null,'choices');
  for(const option of select.options){const button=element('button',option.textContent,'choice');button.type='button';button.dataset.value=option.value;button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change'));syncDropdowns();menu.open=false;summary.focus();});choices.append(button);}
  popover.append(choices);menu.append(popover);select.hidden=true;select.after(menu);
}
function updateLoadingStatus(){
  const pending=state.view!=='text'&&Boolean($('cards').querySelector('[data-image-state=loading]'));
  const loading=busy||pending,footer=$('load-sentinel');
  footer.hidden=!hasMore&&!loading;footer.classList.toggle('is-loading',loading);footer.textContent=loading?'正在加载…':'';
}
function applyView(){
  if(!['combined','images','text'].includes(state.view))state.view='combined';
  if(!['2','3','4','5'].includes(String(state.columns)))state.columns='2';
  state.columns=String(state.columns);$('view').value=state.view;$('columns').value=state.columns;syncDropdowns();
  const gallery=$('cards');gallery.classList.add('masonry');gallery.classList.toggle('text-only',state.view==='text');gallery.classList.toggle('images-only',state.view==='images');gallery.style.setProperty('--gallery-columns',state.columns);
  if(state.view==='text'){posterVisible.disconnect();imageVisible.disconnect();orientationQueue.length=0;}
  for(const article of gallery.querySelectorAll('article')){
    const img=article.querySelector('img');
    if(state.view!=='text'&&img&&!img.getAttribute('src'))queuePosterImage(img);
    if(state.view!=='text'){fitPoster(article);if(img?.naturalWidth&&!orientationCache[article.dataset.posterURL])posterVisible.observe(article);}
  }
  updateLoadingStatus();
}
function reflect(){applyView();for(const key of scalar)$(key).value=state[key];syncDropdowns();renderFacets();renderActive();}
function renderFacets(){
  const active=document.activeElement;const focus=active?.matches('input[type=checkbox][name]')?{name:active.name,value:active.value}:null;
  for(const key of groups){const selected=state[key];$('selected-'+key).textContent=selected.length===0?'全部':selected.length===1?selected[0]:key==='type'?selected.join(' + '):selected.length+' 项';const container=$('facet-'+key);container.replaceChildren();
    for(const item of facets[key]||[]){if(key==='topic'&&item.value===Object.keys(POSTER_CONFIG.subtopics)[0])container.append(element('hr',null,'topic-separator'));const label=element('label',null,'choice');const input=document.createElement('input');input.type='checkbox';input.name=key;input.value=item.value;input.checked=state[key].includes(item.value);input.disabled=item.count===0&&!input.checked;label.classList.toggle('selected',input.checked);label.classList.toggle('unavailable',input.disabled);
      input.addEventListener('change',()=>{state[key]=input.checked?[...new Set([...state[key],item.value])]:state[key].filter(v=>v!==item.value);changed();});
      label.append(input,element('span',item.value),element('span',item.count.toLocaleString(),'option-count'));container.append(label);}
  }
  if(focus){const input=[...document.querySelectorAll('input[type=checkbox][name]')].find(e=>e.name===focus.name&&e.value===focus.value);if(input&&!input.disabled)input.focus({preventScroll:true});}
}
function activeButton(text,action){const button=element('button',text+' ×','filter-chip');button.type='button';button.setAttribute('aria-label','移除筛选：'+text);button.addEventListener('click',action);return button;}
function renderActive(){
  const container=$('active');container.replaceChildren();const names={venue:'会议',year:'年份',type:'录用',topic:'主题'};
  function appendGroup(name,values,remove){
    const group=element('div',null,'active-group');group.setAttribute('role','group');group.setAttribute('aria-label',name);group.append(element('span',name,'active-group-label'));
    values.forEach(value=>{const button=activeButton(value,()=>remove(value));button.setAttribute('aria-label','移除筛选：'+name+'：'+value);group.append(button);});container.append(group);
  }
  if(state.q)appendGroup('搜索',[state.q],()=>{state.q='';reflect();changed();});
  for(const key of groups)if(state[key].length)appendGroup(names[key],state[key],value=>{state[key]=state[key].filter(v=>v!==value);changed();});
  container.hidden=!container.childNodes.length;
}
function changed(){clearTimeout(debounce);renderActive();renderFacets();store('poster-filter-last',state);load(true,'push');}
function syncURL(mode){const url=new URL(location.href);url.search=params().toString();if(url.href!==location.href)history[mode==='push'?'pushState':'replaceState'](null,'',url);}
function message(text){$('sync').textContent=text;}
function card(row){
  const article=element('article');article.dataset.id=row.id;article.dataset.imageState='loading';
  const imageLink=link(row.poster_url,'');imageLink.className='image-link';imageLink.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey)return;event.preventDefault();openPreview(row.id);});imageLink.setAttribute('aria-label','查看完整海报：'+row.title);
  const loading=element('span','加载中…','image-loading');imageLink.append(loading);
  const img=document.createElement('img');img.crossOrigin='anonymous';img.alt=row.title;img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';img.dataset.src=row.poster_url;if(state.view!=='text')queuePosterImage(img);
  img.addEventListener('load',()=>{article.dataset.imageState='ready';updateLoadingStatus();article.classList.add('poster-ready');loading.remove();imageLink.classList.add('is-loaded');orientationLoaded(article,img,row.poster_url);requestAnimationFrame(observeLoadAhead);});img.addEventListener('error',()=>{if(img.hasAttribute('crossorigin')){img.removeAttribute('crossorigin');img.src=row.poster_url;return;}article.dataset.imageState='failed';updateLoadingStatus();requestAnimationFrame(observeLoadAhead);releasePosterImage(img);img.remove();loading.remove();imageLink.append(element('span','海报暂不可用','image-error'));});imageLink.append(img);article.append(imageLink);const rotate=element('button','↻','rotate-poster');rotate.type='button';rotate.setAttribute('aria-label','顺时针旋转海报90度');rotate.title='旋转海报';rotate.addEventListener('click',()=>{if(!img.naturalWidth)return;const angle=(Number(article.dataset.rotation||0)+90)%360;orientationCache[row.poster_url]={angle,manual:true};store('poster-orientation-v1',orientationCache);article.dataset.rotation=angle;fitPoster(article);});article.append(rotate);
  const content=element('div',null,'content');const small=element('small',`${row.venue} ${row.year}`);const badge=element('span',row.acceptance_type,'badge'+(row.acceptance_type==='Oral'?' oral':''));badge.title='官方录用字段：'+(row.decision_raw||'未注明');small.append(badge);content.append(small,element('h2',row.title));
  const tags=element('div',null,'paper-tags');for(const tag of row.tags){const button=element('button',tag);button.type='button';button.title='按此主题筛选';button.addEventListener('click',()=>{state.topic=[tag];changed();});tags.append(button);}content.append(element('p',row.authors,'card-authors'),tags);
  const nav=element('nav');const detail=element('a','详情');detail.href=row.poster_url;detail.addEventListener('click',event=>{event.preventDefault();openPreview(row.id);});nav.append(detail,link(row.poster_url,'图片'));if(row.paper_url)nav.append(link(row.paper_url,'论文原文'));if(row.conference_page)nav.append(link(row.conference_page,'官方页面'));content.append(nav);article.append(content);return article;
}
async function typesetTitles(titles){const math=window.MathJax;if(!math?.typesetPromise)return;try{await math.startup.promise;const connected=titles.filter(e=>e.isConnected&&!e.querySelector('mjx-container'));if(connected.length)await math.typesetPromise(connected);}catch(error){console.warn('Math rendering unavailable; original title retained.',error);}}
window.addEventListener('mathjax-ready',()=>typesetTitles([...document.querySelectorAll('article h2')]));
function sourceStatus(data){
  const failures=data.sources.filter(source=>source.error).length;
  $('sync').textContent=data.refreshing?'正在更新…':failures?`${failures} 个来源更新失败`:'';
  $('refresh').disabled=data.refreshing;$('refresh').textContent=data.refreshing?'正在更新…':'更新';clearTimeout(timer);
}
async function load(reset=true,historyMode='replace'){
  if(!reset&&busy)return;const token=++generation;controller?.abort();controller=new AbortController();busy=true;syncURL(historyMode);
  loadMoreObserver.disconnect();
  if(reset){imageVisible.disconnect();$('cards').querySelectorAll('img').forEach(releasePosterImage);posterResize.disconnect();posterVisible.disconnect();orientationQueue.length=0;offset=0;hasMore=false;visibleRows=[];window.MathJax?.typesetClear?.([$('cards')]);$('cards').replaceChildren();$('count').textContent='正在筛选…';} $('error').hidden=true;$('empty').hidden=true;
  updateLoadingStatus();
  try{const data=catalog.query(state,{offset,limit:BATCH_SIZE});if(token!==generation)return;
    visibleRows.push(...data.rows);const added=data.rows.map(card);added.forEach(e=>$('cards').append(e));typesetTitles(added.map(e=>e.querySelector('h2')));offset+=added.length;hasMore=offset<data.matched;facets=data.facets;renderFacets();renderActive();
    $('count').textContent=`${data.matched.toLocaleString()} / ${data.total.toLocaleString()} 张`;
    $('empty').hidden=data.matched>0||(data.refreshing&&data.total===0);updateLoadingStatus();sourceStatus(data);lastSignature=data.sources.map(s=>s.last_success).join('|');
  }catch(error){if(error.name!=='AbortError'&&token===generation){$('error').hidden=false;$('error').querySelector('p').textContent='无法完成筛选：'+error.message;$('count').textContent='筛选失败，可重试';}}
  finally{if(token===generation){busy=false;updateLoadingStatus();if(hasMore&&$('error').hidden)requestAnimationFrame(observeLoadAhead);}}
}
async function poll(){if(busy){timer=setTimeout(poll,5000);return;}await refreshCatalog(false);}
async function refreshCatalog(force){const before=catalog.sources.map(s=>s.last_success).join('|'),work=catalog.refresh(force);sourceStatus(catalog.query(state));if(catalog.refreshing&&!catalog.items.size){$('empty').hidden=true;$('count').textContent='正在加载论文索引…';}await work;const after=catalog.sources.map(s=>s.last_success).join('|');if(before!==after||!catalog.items.size)await load(true);else sourceStatus(catalog.query(state));if(!catalog.items.size&&catalog.sources.some(s=>s.error)){$('empty').hidden=true;$('error').hidden=false;$('error').querySelector('p').textContent='无法读取会议索引，请检查网络后重试';}}

$('filters').addEventListener('submit',event=>event.preventDefault());
for(const key of ['q'])$(key).addEventListener('input',()=>{state[key]=$(key).value;clearTimeout(debounce);debounce=setTimeout(changed,300);});
for(const key of ['sort'])$(key).addEventListener('change',()=>{state[key]=$(key).value;changed();});
function reset(){state={...defaults(),view:state.view,columns:state.columns};reflect();changed();}
$('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('clear').addEventListener('click',()=>{state={...defaults(),type:[],view:state.view,columns:state.columns};reflect();changed();});
for(const key of ['view','columns'])$(key).addEventListener('change',()=>{state[key]=$(key).value;applyView();store('poster-filter-last',state);syncURL('push');});
const loadMoreObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&hasMore&&!busy)load(false);});
function observeLoadAhead(){
  loadMoreObserver.disconnect();if(busy||!hasMore||!$('error').hidden)return;
  if(state.view!=='text'&&$('cards').querySelector('[data-image-state=loading]'))return;
  // Hidden pending cards cannot be scroll targets; wait for this batch to settle.
  const cards=[...$('cards').querySelectorAll(state.view==='text'?'article':'article.poster-ready')].sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
  const target=cards[Math.max(0,cards.length-Math.ceil(BATCH_SIZE/3))];loadMoreObserver.observe(target||$('load-sentinel'));
}
let loadAheadFrame;
new ResizeObserver(()=>{cancelAnimationFrame(loadAheadFrame);loadAheadFrame=requestAnimationFrame(observeLoadAhead);}).observe($('cards'));
$('retry').addEventListener('click',()=>refreshCatalog(true));
$('refresh').addEventListener('click',()=>refreshCatalog(true));
$('export').addEventListener('click',event=>{event.preventDefault();const url=URL.createObjectURL(catalog.exportCSV(state));const a=document.createElement('a');a.href=url;a.download='poster_manifest.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('popstate',()=>{state=fromURL(new URLSearchParams(location.search));reflect();load(true);});


for(const menu of document.querySelectorAll('.filter-menu'))menu.addEventListener('toggle',()=>{if(menu.open)for(const other of document.querySelectorAll('.filter-menu'))if(other!==menu)other.open=false;});
document.addEventListener('click',event=>{if(!event.target.closest('.filter-menu'))document.querySelectorAll('.filter-menu[open]').forEach(e=>e.open=false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.filter-menu[open]').forEach(e=>e.open=false);});
for(const button of document.querySelectorAll('[data-clear-group]'))button.addEventListener('click',()=>{state[button.dataset.clearGroup]=[];changed();});
function fitPreview(){const row=visibleRows[previewIndex],img=$('viewer-image'),stage=$('viewer-stage');if(!$('viewer').open||!row||!img.naturalWidth)return;const angle=orientationCache[row.poster_url]?.angle||0,sideways=angle%180!==0,w=sideways?img.naturalHeight:img.naturalWidth,h=sideways?img.naturalWidth:img.naturalHeight;const scale=Math.min((stage.clientWidth-16)/w,(stage.clientHeight-16)/h);img.style.width=img.naturalWidth*scale+'px';img.style.height=img.naturalHeight*scale+'px';img.style.transform=`rotate(${angle}deg)`;}
function showPreview(){const row=visibleRows[previewIndex];if(!row)return;const image=$('viewer-image');image.hidden=true;$('viewer-status').textContent='加载中…';image.alt=row.title;image.removeAttribute('src');releasePosterImage(image);image.dataset.requestURL='';loadPosterImage(image,row.poster_url);window.MathJax?.typesetClear?.([$('viewer-title')]);$('viewer-title').textContent=row.title;$('viewer-authors').textContent=row.authors;$('viewer-conference').textContent=`${row.venue} ${row.year} · ${row.acceptance_type}`;$('viewer-prev').disabled=previewIndex===0;$('viewer-next').disabled=previewIndex===visibleRows.length-1;for(const [id,key] of [['viewer-source','poster_url'],['viewer-paper','paper_url'],['viewer-page','conference_page']]){$(id).href=row[key]||'#';$(id).hidden=!row[key];}typesetTitles([$('viewer-title')]);}
function openPreview(id){previewIndex=visibleRows.findIndex(row=>row.id===id);if(previewIndex<0)return;if(!$('viewer').open)$('viewer').showModal();showPreview();}
$('viewer-image').addEventListener('load',()=>{$('viewer-image').hidden=false;$('viewer-status').textContent='';fitPreview();});
$('viewer-image').addEventListener('error',()=>{$('viewer-status').textContent='海报暂不可用';});
$('viewer-close').addEventListener('click',()=>$('viewer').close());
$('viewer').addEventListener('click',event=>{if(event.target===$('viewer')){const r=$('viewer').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('viewer').close();}});
$('viewer-prev').addEventListener('click',()=>{if(previewIndex>0){previewIndex--;showPreview();}});
$('viewer-next').addEventListener('click',()=>{if(previewIndex<visibleRows.length-1){previewIndex++;showPreview();}});
$('viewer').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();$(event.key==='ArrowLeft'?'viewer-prev':'viewer-next').click();}});
$('viewer-rotate').addEventListener('click',()=>{const row=visibleRows[previewIndex];if(!row)return;const angle=((orientationCache[row.poster_url]?.angle||0)+90)%360;orientationCache[row.poster_url]={angle,manual:true};store('poster-orientation-v1',orientationCache);document.querySelectorAll('#cards article').forEach(e=>{if(e.dataset.posterURL===row.poster_url){e.dataset.rotation=angle;fitPoster(e);}});fitPreview();});
new ResizeObserver(fitPreview).observe($('viewer-stage'));

const orientationCache=readStored('poster-orientation-v1',{}),orientationQueue=[];
let orientationWorker,orientationRunning=false,orientationUnavailable=false;
const posterResize=new ResizeObserver(entries=>entries.forEach(e=>fitPoster(e.target.closest('article'))));
const posterVisible=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){posterVisible.unobserve(entry.target);orientationQueue.push(entry.target);detectPosters();}},{rootMargin:'150px'});
function fitPoster(article){
  if(!article||state.view==='text')return;const img=article.querySelector('img'),a=article.querySelector('.image-link');if(!img?.naturalWidth)return;
  const angle=Number(article.dataset.rotation||0);if(!angle){img.style.cssText='';a.style.height='';return;}
  const sideways=angle%180!==0,masonry=$('cards').classList.contains('masonry');const w=sideways?img.naturalHeight:img.naturalWidth,h=sideways?img.naturalWidth:img.naturalHeight;
  if(masonry)a.style.height=(a.clientWidth*h/w)+'px';else a.style.height='';
  const padding=masonry?0:14,scale=Math.min((a.clientWidth-padding)/w,(a.clientHeight-padding)/h);
  img.style.cssText=`position:absolute;left:50%;top:50%;width:${img.naturalWidth*scale}px;height:${img.naturalHeight*scale}px;max-width:none;transform:translate(-50%,-50%) rotate(${angle}deg)`;
}
function orientationLoaded(article,img,url){
  article.dataset.posterURL=url;const cached=orientationCache[url];article.dataset.rotation=cached?.angle||0;posterResize.observe(article.querySelector('.image-link'));fitPoster(article);
  if(!cached&&state.view!=='text')posterVisible.observe(article);
}
async function getOrientationWorker(){
  if(!orientationWorker)orientationWorker=(async()=>{if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Orientation library unavailable'));document.head.append(script);});return Tesseract.createWorker('osd',0,{legacyCore:true,legacyLang:true});})();
  return orientationWorker;
}
async function detectPosters(){
  if(orientationRunning||orientationUnavailable)return;orientationRunning=true;
  try{const worker=await getOrientationWorker();while(orientationQueue.length){const article=orientationQueue.shift(),img=article.querySelector('img'),url=article.dataset.posterURL;
    if(state.view==='text'||!article.isConnected||!img?.naturalWidth||orientationCache[url])continue;
    try{const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const {data}=await worker.detect(canvas);if(orientationCache[url]?.manual)continue;
      const confident=data.orientation_confidence>=8&&[0,90,180,270].includes(data.orientation_degrees),angle=confident?data.orientation_degrees:0;
      orientationCache[url]={angle,confidence:data.orientation_confidence,uncertain:!confident};store('poster-orientation-v1',orientationCache);
      document.querySelectorAll('#cards article').forEach(e=>{if(e.dataset.posterURL===url){e.dataset.rotation=angle;fitPoster(e);}});fitPreview();
    }catch(error){console.warn('Poster direction retained:',error);}
  }}catch(error){orientationUnavailable=true;console.warn('Automatic poster direction unavailable:',error);}finally{orientationRunning=false;}
}

(async()=>{reflect();await load();const before=catalog.sources.map(s=>s.last_success).join('|');await catalog.init();if(before!==catalog.sources.map(s=>s.last_success).join('|'))await load();})();
