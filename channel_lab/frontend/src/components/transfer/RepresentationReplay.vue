<script setup lang="ts">
import {computed,ref,shallowRef} from 'vue'
import TraceLoader from '../cases/TraceLoader.vue'
import {parseTransferTrace,type TransferTrace} from '../../papers/transferLesson'
const data=shallowRef<TransferTrace|null>(null),phase=ref('pretrained'),sampleId=ref('')
const names:Record<string,string>={random:'随机初始化',pretrained:'预训练后',head_only:'仅训练头',full:'联合微调'}
const current=computed(()=>data.value?.stages.find(s=>s.key===phase.value))
const chosen=computed(()=>data.value?.samples.find(s=>s.id===sampleId.value))
const selected=computed(()=>current.value?.points.find(p=>p.id===sampleId.value))
const extent=computed(()=>{const p=data.value?.stages.flatMap(s=>s.points)??[];return {x:Math.max(1,...p.map(p=>Math.abs(p.x))),y:Math.max(1,...p.map(p=>Math.abs(p.y)))}})
function accept(v:unknown){data.value=parseTransferTrace(v);phase.value='pretrained';sampleId.value=data.value.samples[0].id}
</script>
<template><section><h2>主干留下了什么？看同一批句子的表示</h2><p>预训练通过预测误差调整全部层。能帮助预测的句法、关系和上下文信息，可能变成可迁移的表示；这不保证模型像人一样理解。</p><details><summary>为什么预测文字会涉及语义？</summary><p>“杯子从桌边掉下去，最后摔……”的后续预测会受物体、动作与上下文关系影响。损失从词表头传回主干，推动有用表示形成。但模型也能利用共现和模板捷径，因此必须用留出任务检验，不能把会预测等同可靠理解。</p><p>同一个“苹果”的初始词嵌入可以相同；经过不同上下文计算后，其隐藏表示可以不同。维度没有天然的“情感轴”或“公司轴”。</p></details>
<TraceLoader paper-id="transfer" :validate="parseTransferTrace" @loaded="accept" @clear="data=null"/>
<template v-if="data&&current"><div class="transfer-controls"><button v-for="(name,key) in names" :key="key" :aria-pressed="phase===key" @click="phase=key">{{name}}</button></div><p>{{current.checkpoint}} · {{data.split}}</p><svg viewBox="0 0 600 340" role="img" aria-label="同一坐标投影中的句子表示；下方列表可选择样本"><line x1="30" y1="170" x2="570" y2="170" stroke="#cbd5e1"/><line x1="300" y1="20" x2="300" y2="320" stroke="#cbd5e1"/><g v-for="p in current.points" :key="p.id"><circle :cx="300+p.x/extent.x*260" :cy="170-p.y/extent.y*140" :r="sampleId===p.id?9:5" :fill="data.samples.find(s=>s.id===p.id)?.label==='positive'?'#2563eb':'#c2410c'" :stroke="sampleId===p.id?'#111827':'white'" @click="sampleId=p.id"><title>{{p.id}}</title></circle></g></svg><p>蓝：真实正面标签；橙：真实负面标签。颜色不是预测结果。</p><label>选择句子<select v-model="sampleId"><option v-for="s in data.samples" :value="s.id" :key="s.id">{{s.id}} · {{s.sentence}}</option></select></label><p v-if="chosen&&selected">{{chosen.sentence}} · 真实标签 {{chosen.label}} · 该阶段预测 {{selected.prediction}}</p><details><summary>投影与比较条件</summary><pre>{{data.projection}}</pre><p>全部阶段共用一个投影变换和坐标尺度。二维投影会丢失信息，不绘制未经记录的分类边界，也不能单靠“分成两团”证明语义理解。随机/预训练阶段的预测来自什么头，必须在来源设置中说明。</p></details></template><p v-else class="transfer-note">尚无真实表示记录。这里不预置“越来越漂亮的分群”；导入规范见 TRANSFER_TOPIC.md。其他四个场景无需记录。</p></section></template>
