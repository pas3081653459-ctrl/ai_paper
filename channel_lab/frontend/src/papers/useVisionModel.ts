import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
export interface VisionConfig { configured:boolean; problems:string[]; device:string; dtype:string; timeout_seconds:number; note:string }
export function useVisionModel(paper:string) {
  const config=ref<VisionConfig|null>(null),busy=ref(false),error=ref(''),trace=shallowRef<unknown>(null)
  let controller:AbortController|undefined,disposed=false,configTicket=0
  async function refresh(){const ticket=++configTicket;try{const r=await fetch(`/api/experiments/vision/config/${paper}`);if(!r.ok)throw Error('无法查询模型配置，请启动已有后端后重试');const value=await r.json();if(!disposed&&ticket===configTicket){config.value=value;error.value=''}}catch(e){if(!disposed&&ticket===configTicket){config.value=null;error.value=String(e)}}}
  function cancel(){controller?.abort();controller=undefined;busy.value=false}
  function invalidate(){cancel();trace.value=null;error.value=''}
  async function run(payload:Record<string,unknown>,accept:(value:unknown)=>void){
    if(busy.value)return
    const current=new AbortController();controller=current;busy.value=true;error.value='';trace.value=null
    try{
      const r=await fetch('/api/experiments/vision/run',{method:'POST',headers:{'Content-Type':'application/json'},signal:current.signal,body:JSON.stringify({...payload,paper_id:paper})})
      const value=await r.json();if(!r.ok)throw Error(typeof value.detail==='string'?value.detail:JSON.stringify(value.detail))
      if(!disposed&&!current.signal.aborted&&controller===current){accept(value);trace.value=value}
    }catch(e){if(!disposed&&!current.signal.aborted&&controller===current)error.value=String(e)}
    finally{if(!disposed&&controller===current){busy.value=false;controller=undefined}}
  }
  onMounted(refresh);onUnmounted(()=>{disposed=true;++configTicket;cancel()})
  return {config,busy,error,trace,refresh,run,cancel,invalidate}
}
export function downloadVisionTrace(trace:unknown,paper:string){
  const url=URL.createObjectURL(new Blob([JSON.stringify(trace,null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=`paper-${paper}-vision-trace.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
