<script setup lang="ts">
import { ref,shallowRef,computed } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text } from '../../papers/traceValidation'
const parse=fields({question:text,expected:text,direct:fields({prompt:text,output:text,answer:text}),cot:fields({prompt:text,steps:list(text,1,80),answer:text})})
const data=shallowRef<ReturnType<typeof parse>|null>(null),shown=ref(0),marked=ref<number|null>(null)
const normalize=(s:string)=>s.trim().replace(/[。.!！]$/,'')
const correctness=computed(()=>data.value?[normalize(data.value.direct.answer)===normalize(data.value.expected),normalize(data.value.cot.answer)===normalize(data.value.expected)]:[])
function accept(v:unknown){data.value=parse(v);shown.value=0;marked.value=null}
</script>
<template><section class="paper-lab"><h3>答案正确，与每一步都正确，是同一个判断吗？</h3><TraceLoader paper-id="14" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data"><h4>{{data.question}}</h4><div class="cards"><article><h4>直接回答条件</h4><p>{{data.direct.output}}</p><p>提取的最终答案：{{data.direct.answer}}</p></article><article><h4>公开分步解答条件</h4><button :disabled="shown>=data.cot.steps.length" @click="shown++">展开下一步</button><ol><li v-for="(s,i) in data.cot.steps.slice(0,shown)" :key="i"><p>{{s}}</p><button :aria-pressed="marked===i" @click="marked=i">标为首个可核查错误</button></li></ol><p v-if="shown===data.cot.steps.length">最终答案：{{data.cot.answer}}</p></article></div><details><summary>独立答案核验</summary><p>目标：{{data.expected}}；直接答案精确匹配 {{correctness[0]?'是':'否'}}；分步答案精确匹配 {{correctness[1]?'是':'否'}}。</p><p>你的首错标注：{{marked===null?'尚未判断':`第 ${marked+1} 步`}}。这里只记录判断，不能自动证明某一步逻辑正确。</p></details><details><summary>两个条件实际提示</summary><pre>{{data.direct.prompt}}</pre><pre>{{data.cot.prompt}}</pre></details></template><p class="note">只接受对外公开解答，不索取模型私有思维。精确匹配不能判断数学等价表达；复杂题需要专用校验器。原文规模效应和失败例仍需在下方证据区核对。</p></section></template>
