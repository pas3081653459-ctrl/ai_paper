<script setup lang="ts">
import { computed,onUnmounted,ref,shallowRef,watch } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { parseSam } from '../../papers/visionTraces'
import { imageElement } from '../../papers/visionInputs'
const data=shallowRef<ReturnType<typeof parseSam>|null>(null),index=ref(0),candidate=ref(0),opacity=ref(.55),error=ref(''),aligned=ref(false)
const current=computed(()=>data.value?.cases[index.value])
let sequence=0,disposed=false
function accept(v:unknown){data.value=parseSam(v);index.value=0;candidate.value=0}
watch(index,()=>candidate.value=0)
watch([data,index,candidate],async()=>{const id=++sequence;aligned.value=false;error.value='';const record=data.value,mask=current.value?.masks[candidate.value];if(!record||!mask)return;try{const pictures=await Promise.all([imageElement(record.image),imageElement(mask.image)]);if(disposed||id!==sequence)return;if(pictures.some(img=>img.width!==record.width||img.height!==record.height))throw Error('原图或mask尺寸与记录不符，不能可靠对齐');aligned.value=true}catch(e){if(!disposed&&id===sequence)error.value=String(e)}})
onUnmounted(()=>{disposed=true;++sequence})
</script>
<template><section class="paper-lab"><h3>已有记录回放</h3><p>只切换记录里存在的提示与掩码。添加任意新提示的本地推理在页面上方。</p><TraceLoader paper-id="20" :validate="parseSam" @loaded="accept" @clear="data=null"/>
 <template v-if="data&&current"><div class="controls"><label>提示条件<select v-model.number="index"><option v-for="(c,i) in data.cases" :key="i" :value="i">{{c.name}}</option></select></label><label>候选<select v-model.number="candidate"><option v-for="(_,i) in current.masks" :key="i" :value="i">{{i+1}}</option></select></label><label>透明度<input v-model.number="opacity" type="range" min="0" max="1" step=".05"></label></div><p v-if="error" role="alert">{{error}}</p>
 <div class="sam-image" :style="{aspectRatio:`${data.width}/${data.height}`}"><img :src="data.image" alt="记录原图"><img v-if="aligned" class="overlay" :src="current.masks[candidate].image" alt="记录掩码" :style="{opacity}"><svg :viewBox="`0 0 ${data.width} ${data.height}`" class="overlay"><rect v-if="current.box" :x="current.box[0]" :y="current.box[1]" :width="current.box[2]-current.box[0]" :height="current.box[3]-current.box[1]" fill="none" stroke="#f59e0b" :stroke-width="Math.max(data.width/200,1)"/><circle v-for="(p,i) in current.points" :key="i" :cx="p.x" :cy="p.y" :r="Math.max(data.width/80,2)" :fill="p.label==='positive'?'#22c55e':'#ef4444'" stroke="white"/></svg></div><p>绿色正点 / 红色负点。模型质量预测 {{current.masks[candidate].predicted_iou.toFixed(4)}}，不是真实标注IoU。</p></template>
</section></template>
<style scoped>.sam-image{position:relative;width:min(100%,600px)}.sam-image img,.sam-image svg{width:100%;height:100%;max-height:none;object-fit:fill}.overlay{position:absolute;inset:0;pointer-events:none}</style>
