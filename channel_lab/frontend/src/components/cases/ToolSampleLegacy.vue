<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,number,sameLength } from '../../papers/traceValidation'
const nonnegative=(v:unknown)=>{const n=number(v);if(n<0)throw Error('损失/权重不能为负');return n}
const schema=fields({candidates:list(fields({call:text,tool_return:text,target_tokens:list(text),weights:list(nonnegative),loss_without:list(nonnegative),loss_empty:list(nonnegative),loss_with:list(nonnegative)}),1,50)})
function parse(v:unknown){const d=schema(v);for(const c of d.candidates){sameLength(c.target_tokens,c.weights,c.loss_without,c.loss_empty,c.loss_with);if(c.weights.reduce((a,b)=>a+b,0)<=0)throw Error('权重总和需大于0')}return d}
const data=shallowRef<ReturnType<typeof parse>|null>(null),index=ref(0),threshold=ref(.2),reveal=ref(false)
const current=computed(()=>data.value?.candidates[index.value])
const losses=computed(()=>{const c=current.value;if(!c)return [];return [c.loss_without,c.loss_empty,c.loss_with].map(xs=>xs.reduce((s,n,i)=>s+n*c.weights[i],0))})
const gain=computed(()=>losses.value.length?Math.min(losses.value[0],losses.value[1])-losses.value[2]:0)
function accept(v:unknown){data.value=parse(v);index.value=0;reveal.value=false}
</script>
<template><section class="paper-lab"><h3>工具返回，是否真的改善后续预测？</h3><p>无调用、空返回和有返回三个条件，必须评分同一目标后缀。逐 token 检查收益来自哪里，而不是先指定正确候选。</p><TraceLoader paper-id="22" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data&&current"><select v-model.number="index" @change="reveal=false"><option v-for="(c,i) in data.candidates" :key="i" :value="i">{{c.call}}</option></select><p>实际工具返回：{{current.tool_return}}</p><button @click="reveal=true">揭示实际模型的后续 NLL</button><template v-if="reveal"><table><thead><tr><th>目标 token</th><th>权重</th><th>无调用</th><th>空返回</th><th>有返回</th></tr></thead><tbody><tr v-for="(t,i) in current.target_tokens" :key="i"><td>{{t}}</td><td>{{current.weights[i]}}</td><td>{{current.loss_without[i].toFixed(4)}}</td><td>{{current.loss_empty[i].toFixed(4)}}</td><td>{{current.loss_with[i].toFixed(4)}}</td></tr></tbody></table><label>筛选阈值 {{threshold}}<input v-model.number="threshold" type="range" min="0" max="5" step=".05"></label><p>Δ = min({{losses[0].toFixed(4)}}, {{losses[1].toFixed(4)}}) − {{losses[2].toFixed(4)}} = {{gain.toFixed(4)}} → {{gain>=threshold?'保留':'丢弃'}}。</p></template></template><p class="note">损失采用记录中的加权和，权重不自动归一化；阈值需与权重约定一致。这里只回放评分与过滤，不生成训练数据或微调。工具实际执行和模型评分来源须在记录中注明。</p></section></template>
