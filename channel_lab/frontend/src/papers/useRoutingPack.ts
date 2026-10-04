import {ref,shallowRef,onUnmounted} from 'vue'
import {envelope} from './traceValidation'
import {parseRouting,parseRouteLayer,type RouteLayer} from './sparseTraces'
export function useRoutingPack(){
 const pack=shallowRef<ReturnType<typeof parseRouting>|null>(null),provenance=shallowRef<unknown>(null),error=ref(''),busy=ref(false)
 let files=new Map<string,File>(),generation=0,disposed=false
 const cache=new Map<string,RouteLayer>()
 function clear(){generation++;files=new Map();cache.clear();pack.value=null;provenance.value=null;error.value='';busy.value=false}
 async function load(event:Event){const input=event.target as HTMLInputElement,selected=Array.from(input.files??[]);input.value='';clear();if(!selected.length)return;const ticket=generation;busy.value=true
  try{if(selected.length>257||selected.reduce((s,f)=>s+f.size,0)>64*1024*1024)throw Error('最多257文件，总量64MiB');const pending=new Map<string,File>();for(const f of selected){if(pending.has(f.name))throw Error('文件名重复');if(f.size>4*1024*1024)throw Error('每个层文件最多4MiB');pending.set(f.name,f)}const manifest=pending.get('manifest.json');if(!manifest||manifest.size>1024*1024)throw Error('需要≤1MiB的manifest.json');const e=envelope(JSON.parse(await manifest.text()),'23'),d=parseRouting(e.data);if(disposed||ticket!==generation)return;for(const c of d.cases)for(const l of c.layers)if(!pending.has(l.file))throw Error(`缺少 ${l.file}`);files=pending;pack.value=d;provenance.value=e.provenance}
  catch(e){if(!disposed&&ticket===generation)error.value=String(e)}finally{if(!disposed&&ticket===generation)busy.value=false}
 }
 async function layer(caseIndex:number,layerIndex:number){const p=pack.value;if(!p)throw Error('未加载清单');const ticket=generation,entry=p.cases[caseIndex].layers[layerIndex];const known=cache.get(entry.file);if(known){cache.delete(entry.file);cache.set(entry.file,known);return known}const file=files.get(entry.file);if(!file)throw Error('缺少层文件');const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);if(disposed||ticket!==generation)throw Error('记录已切换');const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(hex!==entry.sha256)throw Error('层文件SHA256不匹配');const d=parseRouteLayer(JSON.parse(new TextDecoder().decode(bytes)),p,caseIndex,layerIndex);cache.set(entry.file,d);while(cache.size>4)cache.delete(cache.keys().next().value!);return d}
 onUnmounted(()=>{disposed=true;clear()})
 return {pack,provenance,error,busy,load,layer,clear}
}
