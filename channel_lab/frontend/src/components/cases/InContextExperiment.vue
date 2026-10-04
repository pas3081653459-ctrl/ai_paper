<script setup lang="ts">
import { computed,ref,shallowRef,watch } from 'vue'
import cases from '../../../../backend/context_cases.json'
import TraceLoader from './TraceLoader.vue'
import InContextReplay from './InContextReplay.vue'
import LanguageModelStatus from './LanguageModelStatus.vue'
import { envelope } from '../../papers/traceValidation'
import { parseContext } from '../../papers/languageTraces'
import { useLocalLanguage,downloadLanguageRecord } from '../../papers/useLocalLanguage'
const mode=ref('count'),count=ref(4),order=ref(cases.examples.map(e=>e.id)),corrupt=ref('e1'),selected=ref(0),revealed=ref(false),guess=ref(''),meta=ref('')
const all=cases.examples.map(e=>e.id)
const specs=computed(()=>{
 const base={name:mode.value==='count'?'零样本':'原始示例',example_ids:mode.value==='count'?[]:all,renamed:false,corrupt_id:null as string|null}
 const changed={name:({count:'增加示例',order:'改变顺序',rename:'标签改名',corrupt:'一条错误标签'} as Record<string,string>)[mode.value],example_ids:mode.value==='count'?all.slice(0,count.value):mode.value==='order'?order.value:all,renamed:mode.value==='rename',corrupt_id:mode.value==='corrupt'?corrupt.value:null}
 return [base,changed]
})
function cards(i:number){const s=specs.value[i];return s.example_ids.map(id=>{const e=cases.examples.find(e=>e.id===id)!;const label=s.corrupt_id===id?(e.label==='positive'?'negative':'positive'):e.label;return {...e,shown:s.renamed?(label==='positive'?'A':'B'):label,wrong:s.corrupt_id===id}})}
function preview(i:number){const s=specs.value[i],p=s.renamed?'A':'positive',n=s.renamed?'B':'negative';return `Classify the sentiment. Reply with ${p} for positive or ${n} for negative.\n`+cards(i).map(e=>`Review: ${e.input}\nLabel: ${e.shown}\n\n`).join('')+`Review: ${cases.tests[0].input}\nLabel:`}
function move(index:number,delta:number){const next=index+delta;if(next<0||next>=order.value.length)return;const copy=[...order.value];[copy[index],copy[next]]=[copy[next],copy[index]];order.value=copy}
const data=shallowRef<ReturnType<typeof parseContext>|null>(null)
const local=useLocalLanguage('08'),{config,busy,error}=local
function clear(){local.invalidate();data.value=null;meta.value='';revealed.value=false;guess.value=''}
watch(specs,clear,{deep:true,flush:'sync'})
function accept(v:unknown){data.value=parseContext(v);selected.value=0;revealed.value=false;meta.value='导入记录，以其完整提示、题集与模型来源为准。'}
function receive(v:unknown){const e=envelope(v,'08');accept(e.data);meta.value=JSON.stringify(e.provenance,null,2)}
function start(){const prediction=guess.value;clear();guess.value=prediction;local.request({conditions:specs.value},receive,'context')}
const matrix=computed(()=>data.value?.conditions.map(c=>['positive','negative'].map(actual=>['positive','negative','other'].map(pred=>c.results.filter(r=>r.target_class===actual&&r.prediction===pred).length)))??[])
</script>
<template><section class="paper-lab"><h3>不训练，只动示例卡</h3><p>本地运行使用 GPT‑2 架构的替代模型，研究输入条件变化，不声称复现 GPT‑3。固定英语情感题由本站编写，模型可能完全不能遵循格式。</p><label>一次只改变一个因素<select v-model="mode"><option value="count">示例数量：零 / 一 / 少样本</option><option value="order">顺序</option><option value="rename">标签 positive/negative → A/B</option><option value="corrupt">一条错误示例</option></select></label><label v-if="mode==='count'">示例数<select v-model.number="count"><option :value="1">1</option><option :value="2">2</option><option :value="4">4</option></select></label><label v-if="mode==='corrupt'">改错哪一张<select v-model="corrupt"><option v-for="e in cases.examples" :key="e.id">{{e.id}}</option></select></label>
<div class="cards"><article v-for="(s,i) in specs" :key="i"><h4>{{s.name}} · {{s.example_ids.length}} 张卡</h4><p v-if="!s.example_ids.length">只有任务说明，没有带标签示例。</p><ol><li v-for="(e,j) in cards(i)" :key="e.id" :class="{wrong:e.wrong}"><b>{{e.id}}</b> {{e.input}}<p>Label: <strong>{{e.shown}}</strong> {{e.wrong?'（人为反转）':''}}</p><template v-if="mode==='order'&&i===1"><button :disabled="j===0" @click="move(j,-1)">上移</button><button :disabled="j===3" @click="move(j,1)">下移</button></template></li></ol><details><summary>首个固定测试输入的提示预览（不含测试答案）</summary><pre>{{preview(i)}}</pre></details></article></div>
<p>四个测试输入固定不变；每条件独立运行四次，最多生成 12 token。标签改名会同步改任务说明和示例，不更新权重。</p><label>运行前猜测哪个条件更好？<input v-model="guess" maxlength="100"></label><button :disabled="busy||!config?.configured" @click="start">运行同模型的两组对照</button><LanguageModelStatus :config="config" :busy="busy" :error="error" @refresh="local.refresh" @cancel="local.cancel"/><TraceLoader paper-id="08" :validate="parseContext" @loaded="accept" @clear="clear"/>
<template v-if="data"><p>题集 {{data.dataset_version}}；以下是固定题集的严格首行匹配，other 包括解释性长回答、标点和空回答。格式失败与语义能力不能混为一谈。</p><button v-if="!revealed" @click="revealed=true">揭示真实输出和独立评分</button><template v-if="revealed"><div class="cards"><article v-for="(c,i) in data.conditions" :key="i"><h4>{{c.name}}</h4><p>{{c.results.filter(r=>r.correct).length}} / {{c.results.length}} 正确</p><table><caption>混淆表：行=目标，列=解析结果</caption><thead><tr><th>目标</th><th>positive</th><th>negative</th><th>other</th></tr></thead><tbody><tr v-for="(row,j) in matrix[i]" :key="j"><th>{{j===0?'positive':'negative'}}</th><td v-for="(v,k) in row" :key="k">{{v}}</td></tr></tbody></table></article></div><label>检查同一道题<select v-model.number="selected"><option v-for="(r,i) in data.conditions[0].results" :key="r.test_id" :value="i">{{r.test_id}} · {{r.test_input}}</option></select></label><div class="cards"><article v-for="(c,i) in data.conditions" :key="i"><h4>{{c.name}}</h4><p>{{c.results[selected].test_input}}</p><pre>{{c.results[selected].output||'（没有可见输出）'}}</pre><p>目标 {{c.results[selected].target}}；解析 {{c.results[selected].prediction}}；{{c.results[selected].correct?'匹配':'不匹配'}}；{{c.results[selected].stop_reason}}</p><details><summary>实际完整提示 / 输入 token / 生成记录</summary><pre>{{c.results[selected].text}}</pre><pre>{{c.results[selected].input_ids}}</pre><pre>{{c.results[selected].generated}}</pre></details></article></div></template><button v-if="local.trace.value" @click="downloadLanguageRecord(local.trace.value,'08')">导出实际模型记录</button><details><summary>来源与替代模型声明</summary><pre>{{meta}}</pre></details></template><details><summary>旧版单题记录回放</summary><InContextReplay/></details><p class="note">上下文增加会扩大输入长度，超过模型上下文时明确报错，不偷偷丢弃示例。没有模型或真实记录时只编辑提示，不生成规则答案。</p></section></template>
<style scoped>li{padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin:10px 0}.wrong{background:#fff1f2}ol{padding-left:20px}</style>
