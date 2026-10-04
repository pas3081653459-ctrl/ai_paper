<script setup lang="ts">
import { computed,ref,shallowRef,watch } from 'vue'
import TraceLoader from './TraceLoader.vue'
import LanguageModelStatus from './LanguageModelStatus.vue'
import { envelope } from '../../papers/traceValidation'
import { parseBert } from '../../papers/languageTraces'
import { useLocalLanguage,downloadLanguageRecord } from '../../papers/useLocalLanguage'
const presets=[{name:'去哪里？',prefix:'He went to the [MASK]',a:'to withdraw cash .',b:'to buy fresh bread .'}, {name:'用什么工具？',prefix:'She picked up the [MASK]',a:'to cut the paper .',b:'to unlock the door .'}]
const prefix=ref(presets[0].prefix),rightA=ref(presets[0].a),rightB=ref(presets[0].b),reveal=ref(5)
const wordsA=computed(()=>rightA.value.trim().split(/\s+/).filter(Boolean)),wordsB=computed(()=>rightB.value.trim().split(/\s+/).filter(Boolean))
const limit=computed(()=>Math.max(wordsA.value.length,wordsB.value.length))
const texts=computed(()=>[prefix.value,prefix.value+' '+wordsA.value.slice(0,reveal.value).join(' '),prefix.value+' '+wordsB.value.slice(0,reveal.value).join(' ')])
const data=shallowRef<ReturnType<typeof parseBert>|null>(null),meta=ref(''),selected=ref(''),token=ref(0)
const candidates=computed(()=>[...new Set(data.value?.conditions.flatMap(c=>c.candidates.map(t=>t.token))??[])])
const local=useLocalLanguage('06'),{config,busy,error}=local
function clear(){local.invalidate();data.value=null;meta.value='';selected.value='';token.value=0}
watch([prefix,rightA,rightB,reveal],clear,{flush:'sync'})
function preset(i:number){const p=presets[i];prefix.value=p.prefix;rightA.value=p.a;rightB.value=p.b;reveal.value=1}
function accept(v:unknown){data.value=parseBert(v);selected.value=candidates.value[0]??'';token.value=0;meta.value='导入记录：来源见上方导入器，条件文本以记录为准。'}
function receive(v:unknown){const e=envelope(v,'06');accept(e.data);meta.value=JSON.stringify(e.provenance,null,2)}
function start(){clear();local.run(texts.value,receive)}
</script>
<template><section class="paper-lab"><h3>一句话未说完时，先别猜词</h3><div class="controls"><button v-for="(p,i) in presets" :key="p.name" @click="preset(i)">{{p.name}}</button></div><label>左文与目标位置<input v-model="prefix" maxlength="500" class="wide"></label><div class="controls"><label>线索 A<input v-model="rightA" maxlength="500"></label><label>线索 B<input v-model="rightB" maxlength="500"></label></div>
<p>点词卡逐段开放。灰色词不会送进模型；它们是按空白划分的阅读片段，真正的 WordPiece 在结果中查看。</p><label>右文开放 {{reveal}} 段<input v-model.number="reveal" type="range" min="0" :max="limit"></label><div v-for="(words,i) in [wordsA,wordsB]" :key="i" class="tokens"><b>{{i===0?'A':'B'}}</b><button v-for="(w,j) in words" :key="j" :aria-pressed="j<reveal" @click="reveal=j+1">{{w}}</button></div><details><summary>将比较的三个实际输入</summary><pre v-for="(t,i) in texts" :key="i">{{i===0?'无右文':i===1?'开放 A':'开放 B'}}：{{t}}</pre></details>
<button :disabled="busy||!config?.configured" @click="start">固定权重，比较三种输入</button><LanguageModelStatus :config="config" :busy="busy" :error="error" @refresh="local.refresh" @cancel="local.cancel"/>
<TraceLoader paper-id="06" :validate="parseBert" @loaded="accept" @clear="clear"/>
<template v-if="data"><label>追踪同一个候选<select v-model="selected"><option v-for="c in candidates" :key="c">{{c}}</option></select></label><div class="cards"><article v-for="(c,i) in data.conditions" :key="i"><h4>条件 {{i+1}}</h4><p>{{c.text}}</p><p v-if="c.candidates.some(p=>p.token===selected)">{{selected}}：{{((c.candidates.find(p=>p.token===selected)?.p??0)*100).toFixed(2)}}%</p><p v-else>{{selected}} 不在该条件记录的 top-k 中，不能当作概率 0。</p><p v-for="p in c.candidates" :key="p.token"><button @click="selected=p.token">{{p.token}}</button> <meter min="0" max="1" :value="p.p"/> {{(p.p*100).toFixed(2)}}%</p><details><summary>实际 WordPiece / ID / attention_mask</summary><div class="tokens"><button v-for="(t,j) in c.tokens" :key="j" :aria-pressed="j===c.mask_index" @click="token=j">{{j}}: {{t}}</button></div><p v-if="token<c.tokens.length">位置 {{token}} → {{c.tokens[token]}} → ID {{c.input_ids[token]}} → attention_mask {{c.attention_mask?.[token]??'旧记录未提供'}}</p><p>选词位置 {{c.mask_index}}；以 ## 开头的是续接子词，不必是一个完整单词。</p></details></article></div><p>p(v|可见输入)=exp(logitᵥ)/Σ全词表 exp(logit)。这里截取 top-k，没有重新归一化。</p><button v-if="local.trace.value" @click="downloadLanguageRecord(local.trace.value,'06')">导出实际模型记录</button><details><summary>来源</summary><pre>{{meta}}</pre></details></template>
<p class="note">删除右文会改变序列长度及 [SEP] 位置；不是在固定位置上施加因果 attention mask。80/10/10 是预训练替换策略，不是此处推理操作。</p></section></template>
<style scoped>.wide{width:min(90%,520px)}.tokens button[aria-pressed=false]{background:#e5e7eb;color:#64748b}</style>
