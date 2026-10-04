<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,integer,probability,bool,sameLength } from '../../papers/traceValidation'
const schema=fields({experts:integer,tokens:list(fields({text,padding:bool}),1,256),layers:list(fields({name:text,selected:list(list(integer,1,8),1,256),weights:list(list(probability,1,8),1,256)}),1,64)})
function parse(v:unknown){const d=schema(v);if(d.experts<2||d.experts>128)throw Error('专家数需2–128');for(const l of d.layers){sameLength(d.tokens,l.selected,l.weights);for(let i=0;i<l.selected.length;i++){sameLength(l.selected[i],l.weights[i]);if(new Set(l.selected[i]).size!==l.selected[i].length||l.selected[i].some(e=>e>=d.experts))throw Error('专家编号错误');if(Math.abs(l.weights[i].reduce((a,b)=>a+b,0)-1)>1e-4)throw Error('选中专家权重需归一化')}}return d}
const data=shallowRef<ReturnType<typeof parse>|null>(null),layer=ref(0),token=ref(0)
const current=computed(()=>data.value?.layers[layer.value])
const loads=computed(()=>{if(!data.value||!current.value)return [];const n=Array(data.value.experts).fill(0) as number[];current.value.selected.forEach((ids,i)=>{if(!data.value!.tokens[i].padding)ids.forEach(e=>n[e]++)});return n})
function accept(v:unknown){data.value=parse(v);layer.value=0;token.value=0}
</script>
<template><section class="paper-lab"><h3>同一个词，在不同上下文中会走向同一专家吗？</h3><TraceLoader paper-id="23" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data&&current"><label>层<select v-model.number="layer"><option v-for="(l,i) in data.layers" :key="i" :value="i">{{l.name}}</option></select></label><div class="tokens"><button v-for="(t,i) in data.tokens" :key="i" :aria-pressed="token===i" @click="token=i">{{t.text}}{{t.padding?' [PAD]':''}}</button></div><div class="cards"><article><strong>当前 token {{token}}</strong><p v-for="(e,j) in current.selected[token]" :key="e">→ E{{e}}，归一化权重 {{current.weights[token][j].toFixed(5)}}</p></article><article><strong>该层非 padding 调用负载</strong><p v-for="(n,e) in loads" :key="e">E{{e}} <meter min="0" :max="data.tokens.filter(t=>!t.padding).length||1" :value="n"/> {{n}}</p></article></div><p>本 token 激活 {{current.selected[token].length}} / {{data.experts}} 位专家，未选专家的权重仍需存储。合并是加权和，不是把隐藏维度拼接变长。</p></template><p class="note">导入逐层真实路由记录；不预设“代码专家/数学专家”。负载统计不是硬件加速测量，未提供专家输出向量时不伪造加权结果。</p></section></template>
