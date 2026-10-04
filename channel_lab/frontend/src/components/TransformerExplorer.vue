<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import TensorVolume from './TensorVolume.vue'
import { tensorNodes, traceCell, type DemoResult, type TensorKey, type TensorNode, type CellIndex } from '../transformerTrace'
import { vocabulary } from '../transformerDemo'
import '../transformerExplorer.css'
const props=defineProps<{data:DemoResult; ids:number[]; words:string[]; chapter:number; head:number; query:number; temperature:number; causal:boolean}>()
const emit=defineEmits<{ 'update:chapter':[value:number]; 'update:head':[value:number]; 'update:query':[value:number] }>()
const nodes=computed(()=>tensorNodes(props.data,props.ids))
const active=ref(0), playing=ref(false), duration=ref(2600), progress=ref(0), reduced=ref(false)
const selected=computed(()=>nodes.value[active.value])
const cell=ref<CellIndex>({slice:0,row:2,col:0})
const trace=computed(()=>traceCell(selected.value,cell.value,props.data,props.ids,props.temperature))
const value=computed(()=>selected.value.slices[cell.value.slice][cell.value.row][cell.value.col])
const currentSlice=computed(()=>selected.value.slices[cell.value.slice])
const contributionCount=ref(99)
const visibleTerms=computed(()=>trace.value.terms.slice(0,contributionCount.value))
const partialSum=computed(()=>visibleTerms.value.reduce((sum,t)=>sum+t.product,0))
const additive=computed(()=>['x','q','k','v','context','projected','residual','expanded','ffn','output','logits'].includes(selected.value.key))
const fullShape=(node:TensorNode)=>`[${node.shape.join(', ')}]`
const scalarCount=(node:TensorNode)=>node.shape.reduce((a,b)=>a*b,1)
const format=(value:number)=>Number.isFinite(value)?value.toFixed(6):'−∞'
const graph=ref<HTMLDivElement>()
const stride=170, boxWidth=138, boxHeight=90
const graphWidth=20*stride+40
const pos=(node:TensorNode)=>({x:20+node.column*stride,y:35+node.lane*125})
const findNode=(key:TensorKey)=>nodes.value.find(n=>n.key===key)!
const edges=computed(()=>nodes.value.flatMap(target=>target.parents.map(source=>({source:findNode(source),target,skip:(source==='x'&&target.key==='residual')||(source==='residual'&&target.key==='output'),value:source==='v'&&target.key==='context'}))))
function edgePath(edge:typeof edges.value[number]) {
  const a=pos(edge.source),b=pos(edge.target)
  const x1=a.x+boxWidth,y1=a.y+boxHeight/2,x2=b.x,y2=b.y+boxHeight/2
  if(edge.skip || edge.value) {
    const lane=edge.value?420:edge.source.key==='x'?465:490
    return `M ${x1-25} ${a.y+boxHeight} V ${lane} H ${x2+35} V ${b.y+boxHeight+6}`
  }
  return `M ${x1} ${y1} C ${x1+22} ${y1},${x2-22} ${y2},${x2-5} ${y2}`
}
function incoming(edge:typeof edges.value[number]) {return edge.target.key===selected.value.key}
function choose(index:number, pause=true) {
  if(pause) playing.value=false
  active.value=Math.max(0,Math.min(nodes.value.length-1,index)); progress.value=0
  emit('update:chapter',selected.value.chapter)
  alignCell()
  reveal()
}
function chooseKey(key:TensorKey) {choose(nodes.value.findIndex(n=>n.key===key))}
function alignCell() {
  cell.value={slice:Math.min(props.head,selected.value.slices.length-1),row:Math.min(props.query,selected.value.slices[0].length-1),col:Math.min(cell.value.col,selected.value.slices[0][0].length-1)}
  contributionCount.value=99
}
async function reveal() {
  await nextTick()
  if(graph.value) graph.value.scrollTo({left:Math.max(0,pos(selected.value).x-graph.value.clientWidth/2+boxWidth/2),behavior:reduced.value?'auto':'smooth'})
}
function selectCell(index:CellIndex) {
  playing.value=false;cell.value=index;contributionCount.value=99
  emit('update:query',index.row)
  if(selected.value.slices.length>1) emit('update:head',index.slice)
}
function selectCoordinates() {selectCell({...cell.value})}
function focusAttention(row:number,col:number) {
  chooseKey('weights')
  selectCell({slice:props.head,row,col})
}
defineExpose({focusAttention})
watch(()=>props.chapter,chapter=>{if(selected.value.chapter!==chapter)choose(nodes.value.findIndex(n=>n.chapter===chapter))})
watch([()=>props.head,()=>props.query],()=>alignCell())
watch(()=>props.data,()=>{playing.value=false;progress.value=0;contributionCount.value=99})
let frame=0,last=0
function tick(time:number) {
  if(!playing.value)return
  if(document.hidden){last=0;frame=requestAnimationFrame(tick);return}
  if(last) progress.value+=Math.min(time-last,100)/duration.value
  last=time
  if(progress.value>=1) {
    if(active.value===nodes.value.length-1){playing.value=false;progress.value=1}
    else choose(active.value+1,false)
  }
  if(playing.value)frame=requestAnimationFrame(tick)
}
watch(playing,value=>{cancelAnimationFrame(frame);last=0;if(value)frame=requestAnimationFrame(tick)})
function togglePlay() {if(active.value===nodes.value.length-1&&!playing.value)choose(0);playing.value=!playing.value;last=0}
function keyboard(event:KeyboardEvent) {
  if((event.target as HTMLElement).matches('input,select,button'))return
  if(event.key==='ArrowRight'){event.preventDefault();choose(active.value+1)}
  if(event.key==='ArrowLeft'){event.preventDefault();choose(active.value-1)}
}
let media:MediaQueryList|undefined
function updateMotion(){reduced.value=!!media?.matches;if(reduced.value)playing.value=false}
onMounted(()=>{media=window.matchMedia('(prefers-reduced-motion: reduce)');updateMotion();media.addEventListener('change',updateMotion)})
onUnmounted(()=>{cancelAnimationFrame(frame);media?.removeEventListener('change',updateMotion)})
</script>

<template>
<section class="transformer-explorer" aria-label="交互式 Transformer 数据流">
 <div class="explorer-heading"><div><h2>沿着数据走一遍</h2><p>选一层 → 旋转张量 → 点一个格子 → 查看它的计算来源</p></div><span class="explorer-count">{{active+1}} / {{nodes.length}} 个节点</span></div>
 <div class="flow-playback"><button class="flow-primary" :aria-pressed="playing" @click="togglePlay">{{playing?'暂停':'▶ 播放数据流'}}</button><button :disabled="active===0" @click="choose(active-1)">← 上一层</button><button :disabled="active===nodes.length-1" @click="choose(active+1)">下一层 →</button><label>速度 <select v-model.number="duration"><option :value="4200">慢</option><option :value="2600">标准</option><option :value="1400">快</option></select></label><button @click="choose(0)">回到输入</button><label class="layer-jump">定位 <select :value="active" @change="choose(Number(($event.target as HTMLSelectElement).value))"><option v-for="(node,i) in nodes" :key="node.key" :value="i">{{i+1}}. {{node.title}} {{fullShape(node)}}</option></select></label></div>
 <div class="flow-progress" role="progressbar" aria-label="当前节点演示进度" :aria-valuenow="Math.round(progress*100)" aria-valuemin="0" aria-valuemax="100"><span :style="{width:`${progress*100}%`}"></span></div>
 <div ref="graph" class="flow-graph-scroll" tabindex="0" aria-label="网络拓扑，可横向滚动；左右方向键切换层" @keydown="keyboard">
  <div class="flow-graph" :style="{width:`${graphWidth}px`}">
   <svg class="flow-connections" :viewBox="`0 0 ${graphWidth} 515`" aria-hidden="true">
    <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker></defs>
    <g v-for="edge in edges" :key="`${edge.source.key}-${edge.target.key}`"><path :d="edgePath(edge)" fill="none" :stroke="edge.skip?'#d97706':incoming(edge)?'#2563eb':'#cbd5e1'" :stroke-width="incoming(edge)?3:1.5" :stroke-dasharray="edge.skip?'7 4':undefined" marker-end="url(#flow-arrow)"/>
     <circle v-if="incoming(edge)&&playing&&!reduced" r="4.5" :fill="edge.skip?'#d97706':'#2563eb'"><animateMotion :dur="`${duration/1000}s`" repeatCount="indefinite" :path="edgePath(edge)"/></circle>
     <text v-if="edge.skip||edge.value" :x="pos(edge.source).x+boxWidth" :y="edge.value?413:edge.source.key==='x'?458:483" font-size="12" :fill="edge.skip?'#b45309':'#64748b'">{{edge.skip?`${edge.source.key.toUpperCase()} 残差捷径`:'V：被加权的内容'}}</text>
    </g>
   </svg>
   <button v-for="(node,i) in nodes" :key="node.key" class="flow-node" :class="{current:i===active,upstream:selected.parents.includes(node.key),visited:i<active}" :style="{left:`${pos(node).x}px`,top:`${pos(node).y}px`}" :aria-pressed="i===active" :aria-label="`${i+1}. ${node.title}，输出 ${fullShape(node)}`" @click="choose(i)"><span class="flow-node-index">{{String(i+1).padStart(2,'0')}}</span><span class="node-tensor-icon" :style="{'--planes':Math.min(3,node.slices.length)}" aria-hidden="true"><i></i><i v-if="node.slices.length>1"></i></span><strong>{{node.title}}</strong><code>{{fullShape(node)}}</code><small>{{node.operation}}</small></button>
  </div>
 </div>
 <div class="graph-legend"><span><i></i>运算依赖 →</span><span><i class="skip-line"></i>残差捷径</span><span>横向滚动查看全网；播放时自动跟随当前节点。动画表示计算顺序，不表示耗时或训练。</span></div>
 <div class="tensor-shape-summary" aria-live="polite"><div><span>当前操作</span><strong>{{selected.operation}}</strong></div><div><span>输出 shape</span><strong>{{fullShape(selected)}}</strong></div><div><span>轴的含义</span><strong>{{selected.axes.join(' × ')}}</strong></div><div><span>标量数量</span><strong>{{scalarCount(selected)}}</strong></div></div>
 <div class="shape-transition"><template v-for="parent in selected.parents" :key="parent"><button @click="chooseKey(parent)">{{findNode(parent).title}} <code>{{fullShape(findNode(parent))}}</code></button><span>→</span></template><strong>{{selected.title}} <code>{{fullShape(selected)}}</code></strong></div>
 <p class="node-explanation">{{selected.explanation}}</p>
 <p v-if="!causal&&selected.chapter===6" class="explorer-mode-note">当前为双向注意力：较早位置读取了后文，这些输出不能当作无泄漏的自回归预测。</p>
 <div class="explorer-detail-grid">
  <TensorVolume :node="selected" :selection="cell" :words="words" @select="selectCell"/>
  <aside class="scalar-inspector">
   <h3>这个数是怎么来的？</h3>
   <div class="cell-coordinates"><label v-if="selected.slices.length>1">头 H<select v-model.number="cell.slice" @change="selectCoordinates"><option v-for="(_,h) in selected.slices" :key="h" :value="h">{{h}} · Head {{h+1}}</option></select></label><label>位置 T<select v-model.number="cell.row" @change="selectCoordinates"><option v-for="(word,r) in words" :key="r" :value="r">{{word}}</option></select></label><label>{{selected.key==='ids'?'编号列':selected.axes.at(-1)}}<select v-model.number="cell.col" @change="selectCoordinates"><option v-for="(_,c) in currentSlice[0]" :key="c" :value="c">{{selected.axes.includes('T_key')?words[c]:selected.axes.at(-1)==='V'?`${c}·${vocabulary[c]}`:c}}</option></select></label></div>
   <div class="selected-scalar"><code>{{selected.key}}[{{selected.key==='ids'?`0,${cell.row}`:selected.slices.length>1?`0,${cell.slice},${cell.row},${cell.col}`:`0,${cell.row},${cell.col}`}}]</code><strong>{{format(value)}}</strong></div>
   <pre class="scalar-equation">{{trace.formula}}</pre><p>{{trace.explanation}}</p>
   <details class="scalar-code"><summary>对应网络代码</summary><pre><code>{{selected.code}}</code></pre></details>
  </aside>
 </div>
 <section v-if="trace.terms.length" class="contribution-lab">
  <div class="contribution-heading"><h3>{{additive?'逐项累加，得到这个格子':'计算用到的数值'}}</h3><label v-if="additive">展示前 {{Math.min(contributionCount,trace.terms.length)}} / {{trace.terms.length}} 项 <input :value="Math.min(contributionCount,trace.terms.length)" type="range" min="0" :max="trace.terms.length" aria-label="逐项累加的项数" @input="contributionCount=Number(($event.target as HTMLInputElement).value)"/></label></div>
  <div class="contribution-table-wrap"><table><thead><tr><th>来源</th><th>输入值</th><th>乘数</th><th>{{additive?'对结果的贡献':'用于后续公式的值'}}</th></tr></thead><tbody><tr v-for="(term,i) in trace.terms" :key="i" :class="{pending:additive&&i>=contributionCount}"><th scope="row">{{term.source}}</th><td>{{format(term.value)}}</td><td>{{term.factor===undefined?'—':format(term.factor)}}</td><td><span class="contribution-bar" :style="{width:`${Math.min(100,Math.abs(term.product)/Math.max(.00001,...trace.terms.map(t=>Math.abs(t.product)))*100)}%`,background:term.product<0?'#fed7aa':'#bfdbfe'}"></span><span class="contribution-number">{{format(term.product)}}</span></td></tr></tbody></table></div>
  <p v-if="additive" class="sum-result">{{Math.min(contributionCount,trace.terms.length)===trace.terms.length?'完整求和':'当前部分和'}} = <strong>{{format(partialSum)}}</strong> <span v-if="Math.min(contributionCount,trace.terms.length)<trace.terms.length">（拖动滑块继续累加，当前还不是输出值）</span></p>
 </section>
 <details class="explorer-experiments"><summary>试着做三个实验</summary><ol><li>选中「匹配分数」中的一个格子，查看 Q 与 K 的两个乘积；再看同位置经过 Mask 和 Softmax 后如何变化。</li><li>选中「汇总结果」：拖动累加滑块，观察四个位置的 Value 如何按不同权重相加。权重为 0 的位置贡献为 0。</li><li>在因果模式下选 token 0，把顶部输入的猫换成狗；较早位置不应受未来词元影响。切换双向注意力后，再比较这个位置。</li></ol></details>
 <p class="explorer-disclaimer">B=批次，T=词元位置，C=隐藏特征，H=头，D=每头特征，F=FFN 扩展维，V=词表。这里是前向计算的可视化回放，所有输出已由固定参数算出，不会训练或调用外部模型。</p>
</section>
</template>
