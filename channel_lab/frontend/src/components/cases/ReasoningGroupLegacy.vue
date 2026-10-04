<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,choice } from '../../papers/traceValidation'
const parse=fields({route:choice('R1-Zero','R1','substitute'),question:text,expected:text,answers:list(fields({text,final_answer:text}),2,32)})
const data=shallowRef<ReturnType<typeof parse>|null>(null),selected=ref(0)
const clean=(s:string)=>s.trim().replace(/[。.!！]$/,'')
const rewards=computed(()=>data.value?.answers.map(a=>clean(a.final_answer)===clean(data.value!.expected)?1:0)??[])
const mean=computed(()=>rewards.value.length?rewards.value.reduce<number>((a,b)=>a+b,0)/rewards.value.length:0)
const std=computed(()=>rewards.value.length?Math.sqrt(rewards.value.reduce<number>((a,b)=>a+(b-mean.value)**2,0)/rewards.value.length):0)
function accept(v:unknown){data.value=parse(v);selected.value=0}
</script>
<template><section class="paper-lab"><h3>同题多份实际回答，怎样产生组内比较信号？</h3><TraceLoader paper-id="24" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data"><p>记录路线：{{data.route}}；题目：{{data.question}}</p><table><thead><tr><th>候选</th><th>提取答案</th><th>精确匹配奖励</th><th>组内优势</th><th>字符数（非 token）</th></tr></thead><tbody><tr v-for="(a,i) in data.answers" :key="i"><td><button @click="selected=i">{{i+1}}</button></td><td>{{a.final_answer}}</td><td>{{rewards[i]}}</td><td>{{std?((rewards[i]-mean)/std).toFixed(4):'0（全组同分）'}}</td><td>{{a.text.length}}</td></tr></tbody></table><p>平均奖励 {{mean.toFixed(4)}}，总体标准差 {{std.toFixed(4)}}；Aᵢ=(rᵢ−mean)/std，零方差时置0。</p><p class="alert">{{data.answers[selected].text}}</p><p>目标答案：{{data.expected}}。短答案与长答案按同一结果规则评价，不奖励“写得长”。</p></template><p class="note">此精确匹配校验器不判断数学等价表达，不是原文全部奖励组成。优势标准化只是局部机制，不包含策略比率、裁剪、KL 或训练。R1-Zero/R1 路线不能混为一组训练过程。</p></section></template>
