import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
export function useLocalLanguage(paper: string, namespace='language') {
 const config=ref<{configured:boolean;problems:string[];model_dir:string;device:string;timeout_seconds:number}|null>(null)
 const busy=ref(false),error=ref(''),trace=shallowRef<unknown>(null)
 let controller:AbortController|undefined,disposed=false,configTicket=0
 async function refresh(){const ticket=++configTicket;try{const r=await fetch(`/api/experiments/${namespace}/config/${paper}`);if(!r.ok)throw Error('配置查询失败');const value=await r.json();if(!disposed&&ticket===configTicket){config.value=value;error.value=''}}catch(e){if(!disposed&&ticket===configTicket){config.value=null;error.value=String(e)}}}
 async function request(body:unknown,accept:(data:unknown)=>void,path='run'){
  if(busy.value)return;busy.value=true;error.value='';trace.value=null
  const c=new AbortController();controller=c
  try{const r=await fetch(`/api/experiments/${namespace}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:c.signal,body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));if(!disposed&&!c.signal.aborted&&controller===c){accept(data);trace.value=data}}
  catch(e){if(!disposed&&!c.signal.aborted&&controller===c)error.value=String(e)}
  finally{if(controller===c){controller=undefined;if(!disposed)busy.value=false}}
 }
 function run(texts:string[],accept:(data:unknown)=>void,maxNewTokens=48){return request({paper_id:paper,texts,max_new_tokens:maxNewTokens},accept)}
 function cancel(){controller?.abort();controller=undefined;busy.value=false}
 function invalidate(){cancel();trace.value=null;error.value=''}
 onMounted(refresh);onUnmounted(()=>{disposed=true;++configTicket;cancel()})
 return {config,busy,error,trace,refresh,run,request,cancel,invalidate}
}
export function downloadLanguageRecord(value:unknown,paper:string){
 const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}))
 const a=document.createElement('a');a.href=url;a.download=`paper-${paper}-model-trace.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
