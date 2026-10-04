<script setup lang="ts">
import { computed, ref } from 'vue'
import { demo, type Matrix } from '../transformerDemo'
const props=defineProps<{data:ReturnType<typeof demo>; words:string[]; head:number; query:number; causal:boolean; temperature:number; noun:number}>()
const emit=defineEmits<{inspect:[row:number,col:number];'update:noun':[value:number];'update:causal':[value:boolean];'update:query':[value:number]}>()
const key=ref(2)
const before=computed(()=>demo([0,1,2,4],props.causal,props.temperature))
const h=computed(()=>props.data.heads[props.head])
const old=computed(()=>before.value.heads[props.head])
const allowed=(j:number)=>!props.causal||j<=props.query
const num=(v:number)=>Number.isFinite(v)?v.toFixed(5):'−∞'
const delta=(a:Matrix,b:Matrix,row:number)=>Math.max(...a[row].map((v,i)=>Math.abs(v-b[row][i])))
const stages=computed(()=>[
 {name:'输入 X',a:props.data.x,b:before.value.x},
 {name:'Q',a:h.value.q,b:old.value.q},
 {name:'注意力权重',a:h.value.weights,b:old.value.weights},
 {name:'汇总 V',a:h.value.context,b:old.value.context},
 {name:'Block 输出',a:props.data.output,b:before.value.output}
])
function inspect(j:number){key.value=j;emit('inspect',props.query,j)}
</script>
<template>
 <section class="attention-journey">
  <h2>把「猫」换成「狗」，变化能传到哪里？</h2>
  <p>参照始终是「我 / 喜欢 / 猫 / 。」。两边使用同一组权重、同一个掩码和温度，只替换位置 2 的词。</p>
  <div class="journey-controls"><button :aria-pressed="noun===2" @click="emit('update:noun',2)">原句：猫</button><button :aria-pressed="noun===3" @click="emit('update:noun',3)">只把猫换成狗</button><button @click="emit('update:query',0)">追踪前面的「我」</button><button :aria-pressed="causal" @click="emit('update:causal',!causal)">{{causal?'当前因果：不能读未来':'当前双向：能读后文'}}</button></div>
  <div class="attention-links">
   <svg viewBox="0 0 640 210" role="img" :aria-label="`${words[query]} 读取各个位置的权重；可使用下方按钮选择连接`">
    <text x="320" y="22" text-anchor="middle" fill="#2563eb">Query：{{words[query]}} · Head {{head+1}}</text>
    <g v-for="(word,j) in words" :key="j">
     <path :d="`M 320 38 Q ${80+j*160} 85 ${80+j*160} 155`" fill="none" :stroke="allowed(j)?key===j?'#2563eb':'#94a3b8':'#cbd5e1'" :stroke-width="allowed(j)?1+10*h.weights[query][j]:1" :stroke-dasharray="allowed(j)?undefined:'5 5'"/>
     <text :x="80+j*160" y="182" text-anchor="middle" fill="#172033">{{word}}</text>
     <text :x="80+j*160" y="203" text-anchor="middle" fill="#475569">{{allowed(j)?num(h.weights[query][j]):'遮罩：权重 0'}}</text>
    </g>
   </svg>
   <div class="edge-buttons"><button v-for="(word,j) in words" :key="j" :aria-pressed="key===j" @click="inspect(j)">检查 → {{word}}</button></div>
  </div>
  <div class="edge-equation" aria-live="polite"><h3>这条连接怎样产生？</h3><code>q · k / √2 = ({{num(h.q[query][0])}} × {{num(h.k[key][0])}} + {{num(h.q[query][1])}} × {{num(h.k[key][1])}}) / √2 = {{num(h.scores[query][key])}}</code><code>温度与遮罩后 = {{num(h.masked[query][key])}} → 整行 softmax → {{num(h.weights[query][key])}}</code><code>对汇总向量第 0 维的贡献 = {{num(h.weights[query][key])}} × {{num(h.v[key][0])}} = {{num(h.weights[query][key]*h.v[key][0])}}</code><p>线宽表示权重；权重不等于贡献大小，还要乘 V。点击连接按钮，下方 3D 张量同步选中对应权重格。</p></div>
  <div class="journey-table"><table><caption>改词前后：每个位置在该层的最大绝对差 |Δ|</caption><thead><tr><th>数据经过</th><th v-for="word in words" :key="word">{{word}}</th></tr></thead><tbody><tr v-for="stage in stages" :key="stage.name"><th>{{stage.name}}</th><td v-for="(_,r) in words" :key="r" :class="{changed:delta(stage.a,stage.b,r)>1e-10}">{{num(delta(stage.a,stage.b,r))}}</td></tr></tbody></table></div>
  <p>{{noun===2?'两边输入相同，所以差值为零。先换成狗，再检查各层。':causal?'位置 0、1 不能读取改动位置 2，因此前面的输出保持不变。位置 2 的局部表示先改变，再经注意力传到可读取它的位置。':'双向模式允许较早的位置读取改动后的 K/V，因此局部输入没变的位置，其汇总结果也可能改变。'}}这里是固定教学参数，颜色不表示模型理解了词义。</p>
 </section>
</template>
<style scoped>
.attention-journey{background:white;border:1px solid #dbe3ed;border-radius:12px;padding:22px;margin:18px 0;color:#172033}.attention-journey p{font-size:13px;line-height:1.8;color:#475569}.attention-journey h2{margin-top:0}.journey-controls,.edge-buttons{display:flex;flex-wrap:wrap;gap:8px}.attention-journey button{padding:9px 12px;background:white;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer}.attention-journey button[aria-pressed=true]{background:#dbeafe;border-color:#2563eb}.attention-links{max-width:760px;margin:18px auto}.attention-links svg{width:100%;display:block}.edge-buttons{justify-content:space-around}.edge-equation{background:#f8fafc;padding:14px}.edge-equation code{display:block;overflow-wrap:anywhere;line-height:1.8;margin:6px 0}.journey-table{overflow:auto;margin-top:18px}.journey-table table{border-collapse:collapse;width:100%;font-size:13px}.journey-table th,.journey-table td{padding:10px;border:1px solid #e2e8f0;text-align:left}.journey-table caption{text-align:left;padding:10px 0}.changed{background:#dbeafe;color:#1d4ed8}
</style>
