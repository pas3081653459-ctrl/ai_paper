<script setup lang="ts">
import {onUnmounted,ref} from 'vue'
import {envelope} from '../../papers/traceValidation'
const props=defineProps<{paperId:string;validate:(value:unknown)=>unknown;hideMetadata?:boolean}>()
const emit=defineEmits<{loaded:[value:unknown];clear:[];provenance:[value:ReturnType<typeof envelope>['provenance']]}>()
const error=ref(''),metadata=ref<ReturnType<typeof envelope>['provenance']|null>(null),busy=ref(false),filename=ref('')
let sequence=0,disposed=false
function clear(){++sequence;metadata.value=null;filename.value='';error.value='';busy.value=false;emit('clear')}
async function load(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;clear();const ticket=sequence;busy.value=true
 try{if(file.size>20*1024*1024)throw Error('文件超过20 MB，请减少记录帧或图片数量后重试。');const raw=await file.text();if(disposed||ticket!==sequence)return;const trace=envelope(JSON.parse(raw),props.paperId);const data=props.validate(trace.data);metadata.value=trace.provenance;filename.value=file.name;emit('provenance',trace.provenance);emit('loaded',data)}catch(e){if(!disposed&&ticket===sequence)error.value=String(e)}finally{if(!disposed&&ticket===sequence)busy.value=false}
}
onUnmounted(()=>{disposed=true;++sequence})
</script>
<template><div class="trace-loader" :aria-busy="busy"><label><strong>载入已有实验</strong><input type="file" accept="application/json,.json" @change="load"></label><p role="status">{{busy?'正在读取并检查记录…':metadata?(hideMetadata?'记录已就绪，完成评价后揭示来源':`已载入：${filename}`):'还没有记录。可先做页面中的基础练习，或阅读下方论文对照。'}}</p><button v-if="metadata||busy||error" @click="clear">{{busy?'取消读取':'清除记录'}}</button><p v-if="error" role="alert">无法载入：{{error}}</p><details><summary>我应该选择什么文件？</summary><p>选择为本课准备的JSON实验记录，最大20 MB。PDF、模型权重、图片和其他课程的记录不能直接代替它。文件在浏览器中读取，不会上传；清除只移除页面记录，不删除原文件。</p><p>真实记录需要按项目的 TRACE_FORMATS.md 导出；没有文件也可继续阅读原文证据，不会自动生成假结果。</p></details><details v-if="metadata&&!hideMetadata"><summary>查看记录来源与运行设置</summary><p>来源由提供者声明，结构校验不代表已核验真实性。</p><pre>{{JSON.stringify(metadata,null,2)}}</pre></details></div></template>
<style scoped>.trace-loader{padding:16px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;margin:16px 0}.trace-loader label{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.trace-loader input{max-width:100%}.trace-loader p{font-size:13px;line-height:1.8;color:#526579}.trace-loader pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.trace-loader summary{cursor:pointer}</style>
