<script setup lang="ts">
import { computed,onUnmounted,ref,shallowRef } from 'vue'
import LabPhotoPicker from './LabPhotoPicker.vue'
import PromptCanvas from './PromptCanvas.vue'
import VisionModelStatus from './VisionModelStatus.vue'
import SAMReplay from './SAMReplay.vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import { type LabPhoto,type PromptPoint,type PromptBox,base64Payload,imageElement } from '../../papers/visionInputs'
import { parseSam } from '../../papers/visionTraces'
import { envelope } from '../../papers/traceValidation'
import { useVisionModel,downloadVisionTrace } from '../../papers/useVisionModel'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
const photo=shallowRef<LabPhoto|null>(null),points=ref<PromptPoint[]>([]),box=ref<PromptBox|null>(null),tool=ref<'positive'|'negative'|'box'>('positive')
const x=ref(0),y=ref(0),boxEditor=ref([0,0,100,100]),candidate=ref(0),opacity=ref(.65),error=ref(''),cacheMessage=ref('')
const history=ref<{points:PromptPoint[];box:PromptBox|null}[]>([])
const result=shallowRef<ReturnType<typeof parseSam>|null>(null),pinned=shallowRef<{data:ReturnType<typeof parseSam>;index:number;revision:string}|null>(null)
const revision=ref(''),cacheHit=ref(false)
const local=useVisionModel('20'),{config,busy,error:modelError}=local
const {book,saved,answer,check,reset:resetBook,download}=useEvidenceNotebook('20')
let ticket=0,disposed=false
const current=computed(()=>result.value?.cases[0]),mask=computed(()=>current.value?.masks[candidate.value]?.image)
const isCat=computed(()=>photo.value?.source.includes('Abyssinian_1'))
function invalidate(){++ticket;local.invalidate();result.value=null;candidate.value=0;error.value=''}
function remember(){history.value.push({points:points.value.map(p=>({...p})),box:box.value?[...box.value]:null});if(history.value.length>50)history.value.shift();invalidate()}
function changePhoto(value:LabPhoto){invalidate();photo.value=value;points.value=[];box.value=null;history.value=[];pinned.value=null;x.value=Math.floor(value.width/2);y.value=Math.floor(value.height/2);boxEditor.value=[0,0,value.width,value.height]}
function addPoint(point:PromptPoint){if(!photo.value)return;if(points.value.length>=32){error.value='最多32个提示点';return}if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.y<0||point.x>=photo.value.width||point.y>=photo.value.height){error.value='点坐标越界';return}remember();points.value.push(point)}
function addBox(value:PromptBox){if(!photo.value)return;if(value.some(v=>!Number.isFinite(v))||value[0]<0||value[1]<0||value[2]>photo.value.width||value[3]>photo.value.height||value[0]>=value[2]||value[1]>=value[3]){error.value='框坐标需要在图片内，左上小于右下';return}remember();box.value=value}
function undo(){const previous=history.value.pop();if(previous){invalidate();points.value=previous.points;box.value=previous.box}}
function clear(){remember();points.value=[];box.value=null}
function preset(kind:'head'|'exclude'|'box'){if(!photo.value||!isCat.value)return;remember();const {width:w,height:h}=photo.value;points.value=[{x:Math.round(w*.63),y:Math.round(h*.33),label:'positive'}];box.value=null;if(kind==='exclude')points.value.push({x:Math.round(w*.40),y:Math.round(h*.45),label:'negative'});if(kind==='box'){points.value=[];box.value=[Math.round(w*.16),Math.round(h*.17),Math.round(w*.78),Math.round(h*.87)]}}
async function run(){if(!photo.value)return;const id=++ticket;result.value=null;await local.run({image_base64:base64Payload(photo.value.url),points:points.value,box:box.value},raw=>{const trace=envelope(raw,'20');const next=parseSam(trace.data);if(id!==ticket)return;result.value=next;candidate.value=0;revision.value=trace.provenance.revision;cacheHit.value=trace.provenance.settings.cache_hit===true;void verifyMasks(next,id)})}
async function verifyMasks(data:ReturnType<typeof parseSam>,id:number){try{for(const m of data.cases[0].masks){const img=await imageElement(m.image);if(disposed||id!==ticket)return;if(img.width!==data.width||img.height!==data.height)throw Error('返回掩码与实验图尺寸不一致')} }catch(e){if(!disposed&&id===ticket){error.value=String(e);result.value=null}}}
function pin(){if(result.value)pinned.value={data:result.value,index:candidate.value,revision:revision.value}}
async function clearCache(){cacheMessage.value='';try{const r=await fetch('/api/experiments/vision/sam-cache',{method:'DELETE'});const data=await r.json();if(!r.ok)throw Error(data.detail);if(!disposed)cacheMessage.value=`已清理${data.removed}份图像编码缓存`}catch(e){if(!disposed)cacheMessage.value=String(e)}}
const completed=computed(()=>['ambiguity','cache','score'].filter(k=>book.checked[k]).length)
function restart(){resetBook();clear();history.value=[];pinned.value=null}
onUnmounted(()=>{disposed=true;++ticket})
</script>
<template><section class="paper-lab"><h3>对象选择画布：同一个点，指的是猫头还是整只猫？</h3><p>SAM把“要分割什么”变成提示。先点猫头，看多候选；再给身体一个负点，或画框。比较实际掩码如何改变，图像编码是否被复用。</p><LabPhotoPicker @change="changePhoto"/>
 <template v-if="photo"><div class="controls"><button :disabled="!isCat" @click="preset('head')">固定任务1：猫头正点</button><button :disabled="!isCat" @click="preset('exclude')">任务2：排除身体</button><button :disabled="!isCat" @click="preset('box')">任务3：整猫范围框</button></div><p class="note">预设坐标只对内置猫图开放；并不预设分割结果。自己的照片可任意点选或画框。</p>
 <div class="controls"><label>工具<select v-model="tool"><option value="positive">正点 +</option><option value="negative">负点 −</option><option value="box">拖动框</option></select></label><button :disabled="!history.length" @click="undo">撤销上次提示修改</button><button @click="clear">清空提示</button><label>掩码透明度<input v-model.number="opacity" type="range" min="0" max="1" step=".05"></label></div>
 <PromptCanvas :photo="photo" :tool="tool" :points="points" :box="box" :mask="mask" :opacity="opacity" @point="addPoint" @box="addBox"/>
 <p>实验图 {{photo.width}}×{{photo.height}} · {{points.length}}个点 · {{box?`框 [${box.join(', ')}]`:'无框'}}。修改提示会清除旧掩码，点击运行才重新解码。</p>
 <details><summary>键盘坐标输入与逐点删除</summary><div class="controls"><label>x<input v-model.number="x" type="number" min="0" :max="photo.width-1"></label><label>y<input v-model.number="y" type="number" min="0" :max="photo.height-1"></label><button @click="addPoint({x,y,label:tool==='negative'?'negative':'positive'})">添加{{tool==='negative'?'负':'正'}}点</button></div><div class="controls"><label v-for="(label,i) in ['x1','y1','x2','y2']" :key="label">{{label}}<input v-model.number="boxEditor[i]" type="number"></label><button @click="addBox([boxEditor[0],boxEditor[1],boxEditor[2],boxEditor[3]])">设置框</button><button :disabled="!box" @click="remember();box=null">删除框</button></div><ul><li v-for="(p,i) in points" :key="i">{{p.label}} ({{p.x}},{{p.y}}) <button @click="remember();points.splice(i,1)">删除</button></li></ul></details></template>
 <p v-if="error" role="alert">{{error}}</p><VisionModelStatus :config="config" :busy="busy" :error="modelError" @refresh="local.refresh" @cancel="local.cancel"/><div class="controls"><button :disabled="!photo||busy||!config?.configured||(!points.length&&!box)" @click="run">运行SAM多候选分割</button><button :disabled="busy" @click="clearCache">清理本地图像编码缓存</button></div><p v-if="cacheMessage" role="status">{{cacheMessage}}</p>
 <template v-if="current"><div class="controls"><button v-for="(m,i) in current.masks" :key="i" :aria-pressed="candidate===i" @click="candidate=i">候选{{i+1}} · 预测质量{{m.predicted_iou.toFixed(3)}}</button><button @click="pin">固定当前候选作对照</button><button @click="downloadVisionTrace(local.trace.value,'20')">导出本次真实记录</button></div><p>编码缓存：{{cacheHit?'命中，复用同一图像编码':'未命中，本次重新编码'}}。模型预测质量分不是用真实标注算出的IoU；候选不一定准确覆盖你的意图。</p></template>
 <figure v-if="pinned" class="pinned"><div :style="{aspectRatio:`${pinned.data.width}/${pinned.data.height}`}"><img :src="pinned.data.image" alt="固定对照原图"><img class="overlay" :src="pinned.data.cases[0].masks[pinned.index].image" alt="固定对照掩码" :style="{opacity}"></div><figcaption>固定对照候选{{pinned.index+1}} · {{pinned.data.cases[0].points.map(p=>`${p.label}(${p.x},${p.y})`).join('；')}} · 框 {{pinned.data.cases[0].box??'无'}}<span v-if="result&&pinned.revision!==revision"> · 注意：两次权重/配置指纹不同</span></figcaption></figure>
 <details><summary>没有权重时：导入已有的真实SAM记录回放</summary><SAMReplay/></details>
 <EvidenceQuestion title="同一个正点为什么可能有多个候选？" :options="['提示没有唯一确定目标粒度','正点会自动提供类别名称']" :value="book.answers.ambiguity" :checked="book.checked.ambiguity" correct="提示没有唯一确定目标粒度" explanation="猫头中的点也可能属于整只猫。候选表达可能的粒度；额外点和框用于约束目标，但不保证选中读者心中的对象。" @answer="answer('ambiguity',$event)" @check="check('ambiguity')"/>
 <EvidenceQuestion title="图片不变只增加负点，需要重新做什么？" :options="['提示编码和掩码解码','必须重新计算整张图的视觉编码']" :value="book.answers.cache" :checked="book.checked.cache" correct="提示编码和掩码解码" explanation="本页缓存同图同权重的image embedding；每次仍重新加载模型进程，不应把缓存命中说成端到端实时速度保证。" @answer="answer('cache',$event)" @check="check('cache')"/>
 <EvidenceQuestion title="候选的0.9质量分等于真实IoU=0.9吗？" :options="['不是，缺少目标标注就没有实测IoU','是，模型分数就是测量结果']" :value="book.answers.score" :checked="book.checked.score" correct="不是，缺少目标标注就没有实测IoU" explanation="这是模型对掩码质量的预测。应同时看边缘、遗漏与目标粒度，并在有真实标注时独立评价。" @answer="answer('score',$event)" @check="check('score')"/>
 <EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="3" @notes="book.notes=$event" @reset="restart" @download="download({source:photo?.source,points,box})"/>
</section></template>
<style scoped>.pinned{margin:20px 0;max-width:440px}.pinned>div{position:relative}.pinned img{width:100%;height:100%;max-height:none}.overlay{position:absolute;inset:0}.pinned figcaption{font-size:12px;overflow-wrap:anywhere}input[type=number]{width:80px}</style>
