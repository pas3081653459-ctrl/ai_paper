<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text } from '../../papers/traceValidation'
const schema=fields({test_input:text,target:text,conditions:list(fields({name:text,prompt:text,examples:list(fields({input:text,label:text}),0,30),output:text}),2,20)})
const data=shallowRef<ReturnType<typeof schema>|null>(null),selected=ref(0),revealed=ref(false),guess=ref('')
const current=computed(()=>data.value?.conditions[selected.value])
function accept(v:unknown){data.value=schema(v);selected.value=0;revealed.value=false;guess.value=''}
</script>
<template><section class="paper-lab"><h3>示例进了上下文，还是进了权重？</h3><p>对同一个测试输入，检查记录中的零样本、示例顺序、标签改名与错误示例条件。每种输出必须来自实际运行，未记录的排列不编造答案。</p><TraceLoader paper-id="08" :validate="schema" @loaded="accept" @clear="data=null"/><template v-if="data&&current"><div class="controls"><button v-for="(c,i) in data.conditions" :key="i" :aria-pressed="selected===i" @click="selected=i;revealed=false;guess=''">{{c.name}}</button></div><h4>上下文示例 {{current.examples.length}} 条</h4><div class="cards"><article v-for="(e,i) in current.examples" :key="i"><strong>第 {{i+1}} 条</strong><p>{{e.input}} → {{e.label}}</p></article></div><p>固定测试输入：{{data.test_input}}</p><label>你预测输出是什么？<input v-model="guess"></label><button :disabled="!guess.trim()" @click="revealed=true">揭示模型实际输出</button><template v-if="revealed"><p>输出：{{current.output}}</p><p>记录的目标标签：{{data.target}}（标签映射条件变化时请核查目标是否仍适用）</p></template><details><summary>该条件完整输入</summary><pre>{{current.prompt}}</pre></details></template><p class="note">这不是 GPT-3 在线服务；模型名称和版本由记录注明。这里不更新参数。示例卡是解释摘要，完整 prompt 才是模型实际输入；标签改变的条件不能只按一个固定标签计算总准确率。</p></section></template>
