<script setup lang="ts">
import {paperPdf} from '../../papers/paperAssets'
import { computed, ref } from 'vue'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
import EvidenceNotes from './EvidenceNotes.vue'
const dossiers = [
  { id:'scores', title:'任务成绩', page:7, location:'Table 2', condition:'报告时点的完整系统比较；MMLU 为 5-shot，HumanEval 为 0-shot。', rows:[['MMLU accuracy (%)','GPT-3.5: 70.0','GPT-4: 86.4'],['HumanEval pass@1 (%)','GPT-3.5: 48.1','GPT-4: 67.0']], boundary:'两项提升分别为 16.4、18.9 个百分点；没有隔离某个架构模块。' },
  { id:'drop', title:'反例任务', page:7, location:'Table 2', condition:'DROP 阅读推理；GPT-4 为 3-shot；QDGAT 为专用系统，训练与评测设置不能当作相同。', rows:[['DROP F1','GPT-4: 80.9','QDGAT: 88.4']], boundary:'同表可检查分数高低，但不是同训练配方的受控比较。' },
  { id:'disclosure', title:'披露范围', page:2, location:'§2 Scope and Limitations', condition:'报告明确保留完整架构（含模型规模）、硬件、训练计算量、数据集构建及训练方法细节。', rows:[], boundary:'可以判断“报告是否披露”，不能反推出未披露的层数、专家数或某模块贡献。' },
]
const claims = [
  { id:'improvement', text:'报告列出的 GPT-4 在 MMLU 与 HumanEval 两项上均高于 GPT-3.5。', source:'scores', verdict:'支持', why:'Table 2 支持限定到这两个任务、这些条件和报告时点的比较。' },
  { id:'routing', text:'这两项分数提升证明某个特定专家路由模块更有效。', source:'disclosure', verdict:'证据不足', why:'报告没有足够的架构披露或该模块消融；系统分数不能识别内部原因。成绩表只能说明表现差异。' },
  { id:'drop-win', text:'GPT-4 的 DROP 分数超过表中的专用系统。', source:'drop', verdict:'反驳', why:'80.9 低于 88.4。这一数值命题被表格反驳；也不能从中推出专用系统在所有任务更强。' },
  { id:'layers', text:'报告已经公开精确层数和完整训练配方。', source:'disclosure', verdict:'反驳', why:'“是否公开”本身是可核查命题，报告明确说未提供这些细节，所以是反驳；若改问“精确层数是多少”，才是证据不足。' },
  { id:'today', text:'Table 2 足以证明今天任意一个同名产品版本仍有相同成绩。', source:'scores', verdict:'证据不足', why:'表格只对应报告中的模型和评测。没有当前版本、提示设置和数据评测的对应证据，不能跨版本外推。' },
]
const selected = ref(0), opened = ref(0)
const { book, saved, answer, check, reset, download } = useEvidenceNotebook('18')
const current = computed(()=>claims[selected.value])
const dossier = computed(()=>dossiers[opened.value])
const completed = computed(()=>claims.filter(c=>book.checked[c.id]).length)
const correct = (id:string, source:string, verdict:string) => book.answers[id]===verdict && book.answers[`source-${id}`]===source
const matches = computed(()=>claims.filter(c=>book.checked[c.id] && correct(c.id,c.source,c.verdict)).length)
function chooseSource(id:string) { answer(`source-${current.value.id}`,id); book.checked[current.value.id]=false }
function restart() { reset(); selected.value=0; opened.value=0 }
function exportBook() { download({ source:'GPT-4 Technical Report, https://arxiv.org/pdf/2303.08774', claims:claims.map(c=>({ statement:c.text, judgment:book.answers[c.id]??null, cited_dossier:book.answers[`source-${c.id}`]??null, checked:!!book.checked[c.id], matches_evidence:book.checked[c.id] ? correct(c.id,c.source,c.verdict) : null })), dossiers }) }
</script>
<template>
  <section class="paper-lab">
    <h3>证据审查台：这句话能从报告中推出吗？</h3>
    <p>这篇报告的教学重点不是补画未知内部层，而是审查“结果 → 结论”的每一步。逐条挑选证据并给出判定，最后形成一份可检查的审查记录。</p>
    <div class="controls"><button v-for="(c,i) in claims" :key="c.id" :aria-pressed="selected===i" @click="selected=i">声明 {{ i+1 }}{{ book.checked[c.id] ? ' ✓' : '' }}</button></div>
    <blockquote>{{ current.text }}</blockquote>
    <h4>翻阅证据抽屉</h4>
    <div class="controls"><button v-for="(d,i) in dossiers" :key="d.id" :aria-pressed="opened===i" @click="opened=i">{{ d.title }}</button></div>
    <article class="dossier">
      <strong>{{ dossier.location }} · PDF p{{ dossier.page }}</strong><p>{{ dossier.condition }}</p>
      <div v-if="dossier.rows.length" class="chart"><table><thead><tr><th>指标</th><th>系统 A</th><th>系统 B</th></tr></thead><tbody><tr v-for="row in dossier.rows" :key="row[0]"><td v-for="cell in row" :key="cell">{{ cell }}</td></tr></tbody></table></div>
      <p>{{ dossier.boundary }}</p><a :href="paperPdf('18',dossier.page)" target="_blank" rel="noopener">打开本地原文</a> · <a :href="`https://arxiv.org/pdf/2303.08774#page=${dossier.page}`" target="_blank" rel="noopener">公开原文</a>
      <div class="controls"><button :aria-pressed="book.answers[`source-${current.id}`]===dossier.id" @click="chooseSource(dossier.id)">引用这份证据</button></div>
    </article>
    <p>本条已引用：{{ dossiers.find(d=>d.id===book.answers[`source-${current.id}`])?.title ?? '尚未选择' }}</p>
    <div class="controls"><button v-for="label in ['支持','反驳','证据不足']" :key="label" :aria-pressed="book.answers[current.id]===label" @click="answer(current.id,label)">{{ label }}</button><button :disabled="!book.answers[current.id] || !book.answers[`source-${current.id}`] || book.checked[current.id]" @click="check(current.id)">提交本条审查</button></div>
    <p v-if="book.checked[current.id]" role="status" class="alert"><strong>{{ correct(current.id,current.source,current.verdict) ? '判定和引用均匹配。' : '需要调整判定或引用。' }}</strong>本条应为“{{ current.verdict }}”，主要证据是“{{ dossiers.find(d=>d.id===current.source)?.title }}”。{{ current.why }}</p>
    <details><summary>审查记录：已核对 {{ completed }}/{{ claims.length }}，判定与引用均匹配 {{ matches }} 条</summary><div class="chart"><table><thead><tr><th>声明</th><th>我的判定</th><th>引用</th><th>状态</th></tr></thead><tbody><tr v-for="c in claims" :key="c.id"><td>{{ c.text }}</td><td>{{ book.answers[c.id]??'待判断' }}</td><td>{{ dossiers.find(d=>d.id===book.answers[`source-${c.id}`])?.title??'未引用' }}</td><td>{{ !book.checked[c.id] ? '未提交' : correct(c.id,c.source,c.verdict) ? '匹配' : '待修订' }}</td></tr></tbody></table></div></details>
    <p class="note">支持：证据覆盖了命题的条件与范围。反驳：有与命题相冲突的证据。证据不足：现有信息无法建立所说关系。“未披露”不等于所猜架构不存在。</p>
    <EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="claims.length" @notes="book.notes=$event" @reset="restart" @download="exportBook"/>
  </section>
</template>
<style scoped>blockquote{margin:20px 0;padding:18px;border-left:4px solid #2563eb;background:#eff6ff;font-size:18px}.dossier{padding:18px;border:1px solid #cbd5e1;border-radius:8px}</style>
