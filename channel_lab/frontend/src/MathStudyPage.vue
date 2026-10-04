<script setup lang="ts">
import {computed,ref} from 'vue'
import {mathLessons} from './papers/mathLessons'
import {papers} from './papers/catalog'
import {paperPdf} from './papers/paperAssets'
import './paperAcademy.css'
import './studyReference.css'
const props=defineProps<{topic?:string;from?:string}>()
const lesson=computed(()=>mathLessons.find(m=>m.id===props.topic))
const origin=computed(()=>papers.find(p=>p.id===props.from))
const values=ref([1,0,1,0]),expanded=ref(false)
const defaults:Record<string,number[]>={residual:[1,-.5,0,0],attention:[1,0,1,0],likelihood:[.5,0,0,0],diffusion:[.5,1,.25,0],contrast:[1,0,1,0],moe:[2,1,0,0],advantage:[1,0,1,0],budget:[1,10,0,0],selfplay:[.5,1,0,0]}
function reset(){values.value=[...(defaults[props.topic??'']??[1,0,1,0])];expanded.value=false}
reset()
const knobs=computed(()=>{
 switch(props.topic){
 case 'residual':return [{name:'输入 x',min:-2,max:2,step:.1},{name:'主分支 F(x)',min:-2,max:2,step:.1}]
 case 'attention':case 'contrast':return [{name:'分数 s₁',min:-4,max:4,step:.1},{name:'分数 s₂',min:-4,max:4,step:.1},{name:'温度 τ',min:.25,max:2,step:.05}]
 case 'likelihood':return [{name:'正确目标概率 p',min:.01,max:1,step:.01}]
 case 'diffusion':return [{name:'原像素 x₀',min:-1,max:1,step:.1},{name:'固定噪声 ε',min:-2,max:2,step:.1},{name:'累计保留 ᾱ',min:0,max:1,step:.01}]
 case 'moe':return [0,1,2].map(i=>({name:`E${i} 路由分数`,min:-4,max:4,step:.1}))
 case 'advantage':return [0,1,2,3].map(i=>({name:`候选${i+1}奖励`,min:0,max:1,step:.1}))
 case 'budget':return [{name:'计算预算 C（×10²¹ FLOPs）',min:.1,max:5,step:.1},{name:'参数 N（十亿）',min:1,max:100,step:1}]
 case 'selfplay':return [{name:'网络价值 v',min:-1,max:1,step:.1},{name:'终局 z（输 / 和 / 赢）',min:-1,max:1,step:1}]
 default:return []
 }
})
const fmt=(n:number)=>Number(n.toFixed(5)).toString()
const calculation=computed(()=>{const [a,b,c]=values.value
 switch(props.topic){
 case 'residual':return {result:`ReLU(x + F) = ${fmt(Math.max(0,a+b))}`,lines:[`x + F = ${fmt(a)} + (${fmt(b)}) = ${fmt(a+b)}`,`ReLU(s) = max(0, s) = ${fmt(Math.max(0,a+b))}`],hint:'试把F设为0，再把x改成负数：末尾ReLU是否保留原值？'}
 case 'attention':case 'contrast':{const max=Math.max(a/c,b/c),e1=Math.exp(a/c-max),e2=Math.exp(b/c-max),p=e1/(e1+e2);const lines=[`稳定指数：exp(s/τ − max) = [${fmt(e1)}, ${fmt(e2)}]`,`归一化分母 = ${fmt(e1+e2)}`];if(props.topic==='attention')lines.push(`固定Value=[2, −1]时，加权和 = 2p₁ − p₂ = ${fmt(3*p-1)}`);return {result:`p₁ = ${fmt(p)}；p₂ = ${fmt(1-p)}`,lines,hint:props.topic==='contrast'?'这里只算两个候选的相对概率；logit缩放s对应1/τ，不是实测CLIP的参数。':'将两个分数设为相同，权重是否各为一半？缩小τ后较大分数得到多少权重？'}}
 case 'likelihood':return {result:`NLL = ${fmt(-Math.log(a))} nats`,lines:[`ln(${fmt(a)}) = ${fmt(Math.log(a))}`,`取负号 → ${fmt(-Math.log(a))}`],hint:'p从0.5升到1，损失如何变化？这里使用自然对数。'}
 case 'diffusion':return {result:`xₜ = ${fmt(Math.sqrt(c)*a+Math.sqrt(1-c)*b)}`,lines:[`信号项 √ᾱ·x₀ = ${fmt(Math.sqrt(c)*a)}`,`噪声项 √(1−ᾱ)·ε = ${fmt(Math.sqrt(1-c)*b)}`,`两项相加 = ${fmt(Math.sqrt(c)*a+Math.sqrt(1-c)*b)}`],hint:'固定x₀和ε，只改变ᾱ。ᾱ=1与ᾱ=0分别留下什么？这不是逐步生成轨迹。'}
 case 'moe':{const scores=[a,b,c],chosen=scores.map((s,i)=>({s,i})).sort((x,y)=>y.s-x.s||x.i-y.i).slice(0,2),max=chosen[0].s,ex=chosen.map(x=>Math.exp(x.s-max)),sum=ex[0]+ex[1],w=ex.map(x=>x/sum),outputs=[1,3,-2];return {result:`E${chosen[0].i} / E${chosen[1].i} → 输出 ${fmt(w.reduce((s,v,i)=>s+v*outputs[chosen[i].i],0))}`,lines:chosen.map((x,i)=>`E${x.i}: 权重 ${fmt(w[i])} × 固定输出 ${outputs[x.i]} = ${fmt(w[i]*outputs[x.i])}`),hint:'专家输出固定为[1,3,−2]，同分按编号选择。切换入选集合时可能出现不连续；不是实际模型输出。'}}
 case 'advantage':{const mean=values.value.reduce((s,v)=>s+v,0)/4,variance=values.value.reduce((s,v)=>s+(v-mean)**2,0)/4,std=Math.sqrt(variance),adv=values.value.map(v=>std===0?0:(v-mean)/std);return {result:`优势 = [${adv.map(fmt).join(', ')}]`,lines:[`均值 = ${fmt(mean)}`,`总体方差 = ${fmt(variance)}`,`标准差 = ${fmt(std)}${std===0?' → 本例约定优势全部为0':''}`],hint:'让四个奖励相同，再只提高其中一个。优势反映组内比较，不是奖励本身。'}}
 case 'budget':{const tokens=a*1e21/(6*b*1e9);return {result:`D ≈ ${fmt(tokens/1e9)} 十亿 tokens`,lines:[`C = ${a} × 10²¹ FLOPs`,`N = ${b} × 10⁹ 个参数`,`D = C/(6N) = ${tokens.toExponential(4)} tokens`],hint:'固定计算预算，将参数量翻倍，训练token预算是否减半？结果不包含质量预测。'}}
 case 'selfplay':return {result:`价值损失 = ${fmt((b-a)**2)}`,lines:[`z − v = ${fmt(b)} − (${fmt(a)}) = ${fmt(b-a)}`,`平方 = ${fmt((b-a)**2)}`],hint:'这是联合目标中的价值项；不包含策略交叉熵与正则。z=0表示平局。'}
 default:return {result:'',lines:[],hint:''}
 }
})
</script>
<template><div class="paper-page"><header class="paper-header"><a :href="origin?`#/papers/${origin.id}`:'#/papers'">← {{origin?`${origin.name} 实验`:'论文实验室'}}</a><strong>数学原理学习室</strong><a href="#/glossary">中英文术语</a></header><main class="paper-main reference-page"><template v-if="!topic"><h1>把公式拆成看得懂的步骤</h1><p>选择一个主题：先理解符号，再展开推导，最后用小数值验证。练习由浏览器直接计算，无需模型权重。</p><div class="math-catalog"><a v-for="m in mathLessons" :key="m.id" :href="`#/math/${m.id}`"><small>{{m.english}}</small><h2>{{m.title}}</h2><p>{{m.question}}</p></a></div></template><template v-else-if="lesson"><a href="#/math">全部数学主题</a><h1>{{lesson.title}}</h1><p lang="en">{{lesson.english}}</p><p>{{lesson.question}}</p><details><summary>需要哪些基础？</summary><p>{{lesson.prerequisites}}</p></details><details class="term-card" open><summary>1 · 先读符号</summary><dl class="math-symbols"><template v-for="[symbol,meaning] in lesson.symbols" :key="symbol"><dt>{{symbol}}</dt><dd>{{meaning}}</dd></template></dl></details><section class="math-steps"><h2>2 · 一步一步展开</h2><details v-for="(step,i) in lesson.steps" :key="step.title" :open="i===0"><summary>{{i+1}}. {{step.title}}</summary><pre class="math-equation" :aria-label="step.title+'公式'">{{step.formula}}</pre><p>{{step.explanation}}</p></details></section><section class="term-card"><h2>3 · 改一个数，核对计算</h2><p class="reference-note">{{lesson.boundary}}</p><div class="math-knobs"><label v-for="(knob,i) in knobs" :key="knob.name">{{knob.name}} = {{fmt(values[i])}}<input v-model.number="values[i]" type="range" :min="knob.min" :max="knob.max" :step="knob.step"></label></div><output class="math-result" aria-live="polite">{{calculation.result}}</output><button @click="reset">恢复本例初始数值</button><details :open="expanded" @toggle="expanded=($event.target as HTMLDetailsElement).open"><summary>逐项代入核对</summary><pre class="math-equation">{{calculation.lines.join('\n')}}</pre></details><p>{{calculation.hint}}</p></section><section class="term-card"><h2>4 · 回到论文与实验</h2><p>{{lesson.source}}</p><p class="reference-note">公式按教学阅读重排，变量命名可能与原文不同；解释性推导不是原文逐字引述。页码为随站PDF页序。</p><div class="reference-links"><a v-for="p in lesson.pages??[lesson.page]" :key="p" :href="paperPdf(lesson.papers[0],p)" target="_blank" rel="noopener">打开对应原文第{{p}}页 ↗</a><a v-for="id in lesson.papers" :key="id" :href="`#/papers/${id}`">{{papers.find(p=>p.id===id)?.name}}实验 →</a></div></section></template><section v-else><h1>未找到这个数学主题</h1><a href="#/math">返回数学目录</a></section></main></div></template>
