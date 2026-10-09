/* Bound the entire image lifecycle, including native-image CORS fallback. */
function withAbort(work,signal){
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason||new DOMException('Canceled','AbortError'));
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(work).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
class ImageLoadQueue{
  constructor(limit=6){this.limit=limit;this.active=0;this.waiting=[];}
  run(work,signal,priority=false){
    return new Promise((resolve,reject)=>{
      const entry={work,signal,resolve,reject};
      entry.abort=()=>{this.waiting=this.waiting.filter(item=>item!==entry);reject(signal.reason);};
      if(signal.aborted){reject(signal.reason);return;}
      signal.addEventListener('abort',entry.abort,{once:true});
      priority?this.waiting.unshift(entry):this.waiting.push(entry);this.pump();
    });
  }
  pump(){
    while(this.active<this.limit&&this.waiting.length){
      const entry=this.waiting.shift();entry.signal.removeEventListener('abort',entry.abort);
      if(entry.signal.aborted){entry.reject(entry.signal.reason);continue;}
      this.active++;
      Promise.resolve().then(()=>{if(entry.signal.aborted)throw entry.signal.reason;return entry.work();})
        .then(entry.resolve,entry.reject).finally(()=>{this.active--;this.pump();});
    }
  }
}
class PosterImageCache{
  constructor(){this.ready=new Promise(resolve=>{try{const request=indexedDB.open('poster-image-cache-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'url'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);request.onblocked=()=>resolve(null);}catch{resolve(null);}});}
  async read(db,url){return new Promise(resolve=>{try{const tx=db.transaction('images','readwrite'),store=tx.objectStore('images'),request=store.get(url);let blob=null;request.onsuccess=()=>{const record=request.result;if(record){blob=record.blob;record.lastUsed=Date.now();store.put(record);}};tx.oncomplete=()=>resolve(blob);tx.onerror=tx.onabort=()=>resolve(null);}catch{resolve(null);}});}
  async save(db,url,blob){if(blob.size>32*1024*1024)return;return new Promise(resolve=>{try{const tx=db.transaction('images','readwrite'),store=tx.objectStore('images'),request=store.getAll();request.onsuccess=()=>{const records=request.result.filter(record=>record.url!==url).sort((a,b)=>a.lastUsed-b.lastUsed);let bytes=records.reduce((total,record)=>total+record.size,blob.size);while(records.length>=64||bytes>192*1024*1024){const oldest=records.shift();if(!oldest)break;bytes-=oldest.size;store.delete(oldest.url);}store.put({url,blob,size:blob.size,lastUsed:Date.now()});};tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch{resolve();}});}
  async get(url,signal){
    const db=await withAbort(this.ready,signal);
    if(!db)return {source:'remote'};
    const cached=await withAbort(this.read(db,url),signal);
    if(cached)return {blob:cached,source:'cache'};
    const controller=new AbortController(),abort=()=>controller.abort();
    signal.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(abort,15000);
    try{
      const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!response.ok)throw Error('Image unavailable');
      const blob=await response.blob();
      if(!blob.type.startsWith('image/'))throw Error('Unexpected image type');
      if(signal.aborted)throw signal.reason;
      await withAbort(this.save(db,url,blob),signal);
      return {blob,source:'network'};
    }catch(error){if(signal.aborted)throw signal.reason;return {source:'remote'};}
    finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
  }
}

class PosterImageLoader{
  constructor({cache=new PosterImageCache(),limit=6,timeout=30000}={}){
    this.cache=cache;this.queue=new ImageLoadQueue(limit);this.timeout=timeout;
  }
  release(img){
    const task=img.posterTask;delete img.posterTask;
    task?.controller.abort(new DOMException('Canceled','AbortError'));
    img.removeAttribute('src');delete img.dataset.requestURL;
    if(img.dataset.blobURL){URL.revokeObjectURL(img.dataset.blobURL);delete img.dataset.blobURL;}
  }
  async load(img,url,priority=false){
    if(img.dataset.requestURL===url)return;
    this.release(img);
    const controller=new AbortController(),signal=controller.signal,task={controller};
    img.posterTask=task;img.dataset.requestURL=url;
    try{
      await this.queue.run(async()=>{
        const timer=setTimeout(()=>controller.abort(new DOMException('Image timed out','TimeoutError')),this.timeout);
        try{
          const result=await withAbort(this.cache.get(url,signal),signal);
          if(!img.isConnected||img.posterTask!==task)return;
          img.dataset.cacheSource=result.source;
          await new Promise((resolve,reject)=>{
            const cleanup=()=>{img.removeEventListener('load',done);img.removeEventListener('error',done);signal.removeEventListener('abort',abort);};
            const done=()=>{cleanup();resolve();};
            const abort=()=>{cleanup();img.removeAttribute('src');reject(signal.reason);};
            if(signal.aborted){abort();return;}
            img.addEventListener('load',done);img.addEventListener('error',done);signal.addEventListener('abort',abort,{once:true});
            // Remote <img> fallback can display images that do not allow CORS.
            img.removeAttribute('crossorigin');
            if(result.blob){const objectURL=URL.createObjectURL(result.blob);img.dataset.blobURL=objectURL;img.src=objectURL;}
            else img.src=url;
          });
        }finally{clearTimeout(timer);}
      },signal,priority);
    }catch(error){
      if(img.posterTask===task&&img.isConnected&&error?.name!=='AbortError')img.dispatchEvent(new Event('error'));
    }finally{if(img.posterTask===task)delete img.posterTask;}
  }
}
