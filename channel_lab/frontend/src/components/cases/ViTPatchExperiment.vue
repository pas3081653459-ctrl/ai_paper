<script setup lang="ts">
import { computed,onUnmounted,ref,shallowRef,watch } from 'vue'
import LabPhotoPicker from './LabPhotoPicker.vue'
import VisionModelStatus from './VisionModelStatus.vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import TraceLoader from './TraceLoader.vue'
import { imageElement,base64Payload,type LabPhoto } from '../../papers/visionInputs'
import { useVisionModel,downloadVisionTrace } from '../../papers/useVisionModel'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
import { parseVit } from '../../papers/visionTraces'
import { envelope } from '../../papers/traceValidation'
const canvas=ref<HTMLCanvasElement>(),original=ref<HTMLCanvasElement>(),detail=ref<HTMLCanvasElement>()
const image=shallowRef<ImageData|null>(null),size=ref(32),selected=ref(0),pixel=ref(0),mode=ref('inspect'),pending=ref<number|null>(null)
const mapping=ref<(number|null)[]>([]),error=ref(''),photo=shallowRef<LabPhoto|null>(null),modelPatch=ref(0),loaderKey=ref(0)
const result=shallowRef<ReturnType<typeof parseVit>|null>(null)
const local=useVisionModel('10'),{config,busy,error:modelError}=local
const {book,saved,answer,check,reset:resetBook,download}=useEvidenceNotebook('10')
let ticket=0,disposed=false
const columns=computed(()=>224/size.value),count=computed(()=>columns.value**2),origin=computed(()=>mapping.value[selected.value])
const rgb=computed(()=>{if(!image.value||origin.value==null)return [127,127,127];const x=origin.value%columns.value*size.value+pixel.value%size.value,y=Math.floor(origin.value/columns.value)*size.value+Math.floor(pixel.value/size.value);return Array.from(image.value.data.slice((y*224+x)*4,(y*224+x)*4+3))})
function invalidate(){local.invalidate();result.value=null;modelPatch.value=0;loaderKey.value++}
function reset(){mapping.value=Array.from({length:count.value},(_,i)=>i);selected.value=0;pixel.value=0;pending.value=null}
function render(){if(!image.value||!canvas.value||!original.value||!detail.value)return
 const src=document.createElement('canvas');src.width=src.height=224;src.getContext('2d')!.putImageData(image.value,0,0);original.value.getContext('2d')!.putImageData(image.value,0,0)
 const ctx=canvas.value.getContext('2d')!;ctx.fillStyle='rgb(127,127,127)';ctx.fillRect(0,0,224,224)
 mapping.value.forEach((from,to)=>{if(from!==null)ctx.drawImage(src,from%columns.value*size.value,Math.floor(from/columns.value)*size.value,size.value,size.value,to%columns.value*size.value,Math.floor(to/columns.value)*size.value,size.value,size.value)})
 const zoom=detail.value.getContext('2d')!;zoom.imageSmoothingEnabled=false;zoom.clearRect(0,0,160,160);zoom.drawImage(canvas.value,selected.value%columns.value*size.value,Math.floor(selected.value/columns.value)*size.value,size.value,size.value,0,0,160,160)
}
watch(size,reset);watch([image,mapping,size],invalidate,{deep:true,flush:'sync'});watch([image,mapping,selected,size],render,{flush:'post',deep:true});watch(mode,()=>pending.value=null)
function choose(index:number){selected.value=index;pixel.value=0;if(mode.value==='mask')mapping.value[index]=mapping.value[index]===null?index:null;if(mode.value==='swap'){if(pending.value===null)pending.value=index;else{const next=[...mapping.value];[next[index],next[pending.value]]=[next[pending.value],next[index]];mapping.value=next;pending.value=null}}}
async function changePhoto(value:LabPhoto){const id=++ticket;invalidate();image.value=null;photo.value=value;error.value='';try{const img=await imageElement(value.url);if(disposed||id!==ticket)return;const c=document.createElement('canvas');c.width=c.height=224;const ctx=c.getContext('2d')!,side=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,224,224);image.value=ctx.getImageData(0,0,224,224);reset()}catch(e){if(!disposed&&id===ticket)error.value=String(e)}}
async function run(){if(!image.value||!canvas.value||!original.value)return;result.value=null;render();await local.run({image_base64:base64Payload(original.value.toDataURL()),changed_base64:base64Payload(canvas.value.toDataURL())},raw=>{result.value=parseVit(envelope(raw,'10').data);modelPatch.value=0})}
function accept(v:unknown){local.invalidate();result.value=parseVit(v);modelPatch.value=0}
const maxDelta=computed(()=>Math.max(1e-12,...(result.value?.patch_delta??[])))
const completed=computed(()=>['position','attribution'].filter(k=>book.checked[k]).length)
function restart(){resetBook();reset();invalidate()}
onUnmounted(()=>{disposed=true;++ticket})
</script>
<template><section class="paper-lab"><h3>照片拆解台：移动的是内容，还是位置？</h3><p>ViT把图片变成patch序列，但切块本身不能证明识别能力。先修改像素，再让同一个本地模型对两张图分类；看看第一层投影和最终分类分别怎样变化。</p>
 <LabPhotoPicker @change="changePhoto"/><p v-if="photo" class="note">{{photo.source}}</p><p v-if="error" role="alert">{{error}}</p>
 <div class="controls"><label>教学块边长<select v-model.number="size"><option :value="16">16</option><option :value="32">32</option><option :value="56">56</option></select></label><label>操作<select v-model="mode"><option value="inspect">检查像素</option><option value="mask">遮挡 / 恢复本位置</option><option value="swap">交换两块</option></select></label><button :disabled="!image" @click="reset">恢复原图</button></div><p v-if="pending!==null">已选位置 {{pending}}，再选一块完成交换。</p>
 <div class="pictures"><figure><canvas ref="original" width="224" height="224"/><figcaption>模型原图：中心裁剪224×224</figcaption></figure><figure><div class="board"><canvas ref="canvas" width="224" height="224"/><div class="grid" :style="{gridTemplateColumns:`repeat(${columns},1fr)`}"><button v-for="i in count" :key="i" :class="{chosen:selected===i-1,waiting:pending===i-1}" :disabled="!image" :aria-label="`patch ${i-1}`" :aria-pressed="selected===i-1" @click="choose(i-1)"/></div></div><figcaption>模型干预图：位置编号固定</figcaption></figure><figure><canvas ref="detail" width="160" height="160" class="zoom"/><figcaption>位置{{selected}}：{{origin==null?'灰色遮挡':`内容来自块${origin}`}}</figcaption></figure></div>
 <template v-if="image"><p>{{count}}块 × {{size}}×{{size}}×3个RGB数值。教学网格可变，checkpoint的patch尺寸不会跟着改变。</p><label>块内像素 ({{pixel%size}}, {{Math.floor(pixel/size)}})<input v-model.number="pixel" type="range" min="0" :max="size*size-1"></label><p>RGB = [{{rgb.join(', ')}}]；逐像素RGB展平下标为 {{pixel*3}}–{{pixel*3+2}}。模型Conv2d实际读取CHW布局，不能混用展平顺序。</p></template>
 <VisionModelStatus :config="config" :busy="busy" :error="modelError" @refresh="local.refresh" @cancel="local.cancel"/><button :disabled="!image||busy||!config?.configured" @click="run">对原图和干预图做真实分类</button>
 <template v-if="result"><p>实际模型 patch={{result.patch_size}}，隐藏维度D={{result.hidden_size}}；[2,3,224,224] → [2,{{result.patch_delta.length}},D] → 加CLS和位置 → [2,{{result.patch_delta.length+1}},D]。</p><div class="cards"><article v-for="c in result.conditions" :key="c.name"><strong>{{c.name==='original'?'原图':'干预图'}}</strong><img :src="c.image" alt="本次实际输入"><ol><li v-for="r in c.top" :key="r.id">{{r.label}}：{{(r.p*100).toFixed(2)}}%</li></ol></article></div><p>原图第一名“{{result.reference_class.label}}”的概率：{{result.reference_class.probabilities.map(p=>(p*100).toFixed(2)+'%').join(' → ')}}。只作同模型同类别对照，不是校准置信度。</p>
 <h4>第一层哪些patch向量变了？</h4><div class="delta-grid" :style="{gridTemplateColumns:`repeat(${224/result.patch_size},1fr)`}"><button v-for="(v,i) in result.patch_delta" :key="i" :style="{background:`rgba(37,99,235,${.08+.85*v/maxDelta})`}" :aria-label="`模型patch ${i}，RMS变化${v}`" :aria-pressed="modelPatch===i" @click="modelPatch=i">{{i}}</button></div><p>模型patch {{modelPatch}}：投影向量变化RMS={{result.patch_delta[modelPatch].toPrecision(4)}}。颜色按本次最大值归一化；这是局部表示差异，不是类别重要性或注意力热图。</p>
 <div class="chart"><table><caption>所选patch前16维（D={{result.hidden_size}}）；原图/干预图使用同一位置向量</caption><thead><tr><th>维度</th><th>原图投影</th><th>干预投影</th><th>位置编码</th><th>干预图相加后</th></tr></thead><tbody><tr v-for="(value,j) in result.position_vectors[modelPatch]" :key="j"><td>{{j}}</td><td>{{result.conditions[0].patch_vectors[modelPatch][j].toFixed(4)}}</td><td>{{result.conditions[1].patch_vectors[modelPatch][j].toFixed(4)}}</td><td>{{value.toFixed(4)}}</td><td>{{result.conditions[1].token_vectors[modelPatch][j].toFixed(4)}}</td></tr></tbody></table></div><details><summary>实际编码器各层输出形状</summary><p v-for="(shape,i) in result.layer_shapes" :key="i">{{i===0?'编码器输入':`Encoder ${i}`}}：[{{shape.join(', ')}}]</p><p>这里只记录形状，未展示完整层内激活；第一层局部投影不等于最终全局信息交互。</p></details></template>
 <div class="controls"><button :disabled="!local.trace.value" @click="downloadVisionTrace(local.trace.value,'10')">导出真实实验记录</button></div><details><summary>导入此前运行的ViT记录</summary><TraceLoader :key="loaderKey" paper-id="10" :validate="parseVit" @loaded="accept" @clear="local.invalidate();result=null"/></details>
 <EvidenceQuestion title="交换两块照片，本实验的位置编码如何变化？" :options="['内容改变，位置编码仍绑定位置','位置编码随原始内容一起移动']" :value="book.answers.position" :checked="book.checked.position" correct="内容改变，位置编码仍绑定位置" explanation="输入是重排后的像素，checkpoint的可学习位置表未重排。教学块与模型patch不一致时，一块教学区域会影响多个模型patch。" @answer="answer('position',$event)" @check="check('position')"/>
 <EvidenceQuestion title="遮挡后类别概率下降，能证明遮挡区就是物体的位置吗？" :options="['不能，还可能涉及背景或分布变化','能，概率差就是分割掩码']" :value="book.answers.attribution" :checked="book.checked.attribution" correct="不能，还可能涉及背景或分布变化" explanation="遮挡是输入干预。它提供敏感性证据，但不自动建立语义定位、注意力归因或ViT优于CNN的结论。" @answer="answer('attribution',$event)" @check="check('attribution')"/>
 <EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="2" @notes="book.notes=$event" @reset="restart" @download="download({source:photo?.source,patch_size:size,mapping})"/>
</section></template>
<style scoped>.pictures{display:flex;gap:18px;flex-wrap:wrap}figure{margin:14px 0;max-width:224px}canvas{display:block;background:#f1f5f9;width:224px;height:224px}.board{position:relative;width:224px;height:224px}.grid{position:absolute;inset:0;display:grid}.grid button{background:transparent;border:1px solid #ffffff77;padding:0;min-width:0;border-radius:0}.grid .chosen{outline:3px solid #2563eb;outline-offset:-3px}.grid .waiting{background:#f59e0b55}canvas.zoom{width:160px;height:160px;image-rendering:pixelated}.delta-grid{display:grid;max-width:490px;gap:2px}.delta-grid button{padding:3px;min-width:0;font-size:10px;aspect-ratio:1}.delta-grid button[aria-pressed=true]{outline:2px solid #f97316}</style>
