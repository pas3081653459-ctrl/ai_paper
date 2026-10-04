<script setup lang="ts">
import {paperPdf} from '../../papers/paperAssets'
import { computed, ref } from 'vue'
const props=defineProps<{id:string}>()
const logarithmic=ref(false),alpha=ref(.076),floor=ref(false),selected=ref(12)
const sizes=Array.from({length:31},(_,i)=>10**(i/10))
const losses=computed(()=>sizes.map(n=>n**(-alpha.value)+(floor.value ? .2 : 0)))
const xy=computed(()=>losses.value.map((l,i)=>[50+(logarithmic.value?Math.log10(sizes[i])/3:(sizes[i]-1)/999)*590,260-(logarithmic.value?(Math.log10(l)+1.3)/1.5:l/1.3)*230]))
const budget=ref(384),n=ref(8)
const d=computed(()=>budget.value/(6*n.value))
const loss=(a:number,b:number)=>1+2/a**.35+2/b**.35
const ns=Array.from({length:65},(_,i)=>2**(i*6/64))
const curve=computed(()=>ns.map(a=>[50+Math.log2(a)/6*590,260-(loss(a,budget.value/(6*a))-1)/5*210]))
const optimum=computed(()=>Math.sqrt(budget.value/6))
const statement=ref(0),choice=ref(-1),show=ref(false)
const claims=[
 {text:'报告描述图像与文本输入、文本输出。',answer:0,reason:'报告披露了这种输入输出能力；不是说所有产品配置都提供图像输入。',page:1},
 {text:'能从报告读出 GPT-4 的精确层数和专家数量。',answer:1,reason:'报告未公开完整架构、模型规模等细节；不能根据输出能力反推精确结构。',page:2},
 {text:'GPT-4 在报告每一个任务上都胜过所有专用模型。',answer:2,reason:'这个全称结论超出了表中证据。例如原报告 DROP 对照并不支持“所有任务都最优”。',page:7},
 {text:'只看一个基准的总分，就能确定任意真实任务的可靠性。',answer:2,reason:'基准任务、提示设置和部署分布不同；不能从单项总分直接推出任意场景。',page:7}
]
function next(i:number){statement.value=i;choice.value=-1;show.value=false}
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='09'">
   <div class="case-controls"><label><input v-model="logarithmic" type="checkbox"/> 双对数坐标</label><label>合成幂指数 α={{alpha}}<input v-model.number="alpha" type="range" min=".04" max=".4" step=".001"/></label><label><input v-model="floor" type="checkbox"/> 加一个未随 N 下降的数据瓶颈</label><label>检查采样点<input v-model.number="selected" type="range" min="0" max="30"/></label></div>
   <svg class="scene" viewBox="0 0 700 310" aria-label="同一合成幂函数在普通或双对数坐标中的曲线"><path d="M50 30V260H655" fill="none" stroke="#64748b"/><polyline :points="xy.map(p=>p.join(',')).join(' ')" fill="none" stroke="#2563eb" stroke-width="3"/><circle :cx="xy[selected][0]" :cy="xy[selected][1]" r="6" fill="#ea580c"/><text x="45" y="285">N=1</text><text x="570" y="285">N=1000</text><text x="55" y="20">{{logarithmic?'log₁₀ L，纵轴映射范围 −1.3…0.2':'L，纵轴范围 0…1.3'}}</text><text x="320" y="307">{{logarithmic?'log₁₀ N':'N'}}</text></svg>
   <div class="equation">L = N^(−α){{floor?' + 0.2':''}}<br/>选中 N={{sizes[selected].toFixed(2)}}，L={{losses[selected].toFixed(5)}}<br/>{{floor?'加入常数后，log L 不再是 log N 的严格直线。':'log L = −α log N；斜率由设定的 α 决定。'}}</div><p>默认 α=0.076 借用原文参数规模指数作读图练习，但归一化系数、这些点及瓶颈常数都是本页设置。它们不是论文训练观测，也没有完成经验拟合。</p><details><summary>真正做实验时，为什么不能只扫 N？</summary><p>需要控制数据量、训练算力和其他瓶颈，明确比较的是收敛损失还是固定算力下的损失。后面的原文证据分别列出这些不同条件。</p></details>
  </template>
  <template v-else-if="props.id==='15'">
   <div class="case-controls"><label>预算 C={{budget}}<input v-model.number="budget" type="range" min="96" max="1536" step="96"/></label><label>参数单位 N={{n}}<input v-model.number="n" type="range" min="1" max="64"/></label><button @click="n=Math.round(optimum)">靠近本例最优分配</button></div>
   <div class="cards"><article><strong>模型参数</strong><h3>{{n}} 单位</h3></article><article><strong>可用训练 token</strong><h3>{{d.toFixed(2)}} 单位</h3></article><article><strong>核对预算</strong><h3>6 × N × D = {{(6*n*d).toFixed(0)}}</h3></article></div>
   <svg class="scene" viewBox="0 0 700 310" aria-label="固定算力约束下的合成损失曲线"><path d="M50 30V260H655" fill="none" stroke="#64748b"/><polyline :points="curve.map(p=>p.join(',')).join(' ')" fill="none" stroke="#2563eb" stroke-width="3"/><circle :cx="50+Math.log2(n)/6*590" :cy="260-(loss(n,d)-1)/5*210" r="7" fill="#ea580c"/><text x="45" y="285">N=1</text><text x="590" y="285">N=64</text><text x="60" y="20">合成损失 L（纵轴 1…6）</text><text x="250" y="307">模型 N（横轴为 log₂）</text></svg>
   <div class="equation">D = C/(6N)<br/>Ltoy = 1 + 2N⁻⁰·³⁵ + 2D⁻⁰·³⁵ = {{loss(n,d).toFixed(4)}}<br/>本例对称最优 N=D=√(C/6)={{optimum.toFixed(3)}}</div><p>把滑块推到最大，模型项下降，但数据不足项上升。这是本例的预算权衡，不是说真实模型永远在 N=D 最优；原文的“均衡扩展”指随算力增长的扩展关系，单位也不同。</p>
  </template>
  <template v-else>
   <div class="tokens"><button v-for="(_,i) in claims" :key="i" :aria-pressed="statement===i" @click="next(i)">声明 {{i+1}}</button></div><h3>{{claims[statement].text}}</h3><div class="case-controls"><button v-for="(name,i) in ['报告披露支持','报告未披露','超出证据范围']" :key="i" :aria-pressed="choice===i" @click="choice=i;show=true">{{name}}</button></div>
   <div v-if="show" class="callout" aria-live="polite"><strong>{{choice===claims[statement].answer?'判断符合证据。':'需要重新区分事实、未知与过度推断。'}}</strong><p>{{claims[statement].reason}}</p><a :href="paperPdf('18',claims[statement].page)" target="_blank" rel="noopener">核对原报告第 {{claims[statement].page}} 页 ↗</a></div><div class="cards"><article><strong>可以分析</strong><p>任务、输入形式、评测设置、公开成绩、失败边界。</p></article><article><strong>不从图示补全</strong><p>精确层数、隐藏维度、专家数、未披露的训练配方。</p></article></div><p>这一课用证据审阅代替虚构网络的 3D 展示。接着逐项看报告中的基准对照，保持任务和评测条件一致。</p>
  </template>
 </section>
</template>
