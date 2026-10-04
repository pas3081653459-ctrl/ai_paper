<script setup lang="ts">
import {paperPdf} from '../../papers/paperAssets'
import { computed, ref } from 'vue'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
// LLaMA (2023) Table 3, zero-shot. Scores are original system results, not reruns.
const models = [
  { name: 'GPT-3 175B', n: 175, scores: [78.9,81.0,51.4] },
  { name: 'LLaMA 7B', n: 7, scores: [76.1,79.8,47.6] },
  { name: 'LLaMA 13B', n: 13, scores: [79.2,80.1,52.7] },
  { name: 'LLaMA 33B', n: 33, scores: [82.8,82.3,57.8] },
  { name: 'LLaMA 65B', n: 65, scores: [84.2,82.8,56.0] },
]
const metrics = ['HellaSwag','PIQA','ARC-challenge']
const tasks = [
  { id: 'story', title: '情境续写：HellaSwag ≥ 79%，纯权重 ≤ 32 GB，16 bit', metric: 0, threshold: 79, budget: 32, correct: 'LLaMA 13B', why: '13B 为 26 GB、79.2%；7B 虽然更小，但成绩不够。其余纯权重超预算。' },
  { id: 'physical', title: '物理常识：PIQA ≥ 81%，纯权重 ≤ 80 GB，16 bit', metric: 1, threshold: 81, budget: 80, correct: 'LLaMA 33B', why: '33B 为 66 GB、82.3%；13B 的 80.1% 未达标。小模型不是所有任务都优于 GPT-3。' },
  { id: 'science', title: '科学推理：ARC-challenge ≥ 57%，纯权重 ≤ 140 GB，16 bit', metric: 2, threshold: 57, budget: 140, correct: 'LLaMA 33B', why: '33B 的 57.8% 达标；65B 的 56.0% 未达标。这一任务的成绩没有随规模单调上升。' },
]
const task = ref(0), metric = ref(0), bits = ref(16), budget = ref(32), threshold = ref(79)
const { book, saved, answer, check, reset, download } = useEvidenceNotebook('17')
const current = computed(() => tasks[task.value])
const rows = computed(() => models.map(m => ({ ...m, gb: m.n*bits.value/8, score: m.scores[metric.value] })))
const candidates = computed(() => rows.value.filter(m => m.gb<=budget.value && m.score>=threshold.value).sort((a,b)=>a.gb-b.gb))
const xmax = computed(()=>Math.max(budget.value,...rows.value.map(m=>m.gb))*1.08)
const px = (gb:number)=>65+gb/xmax.value*540
const py = (score:number)=>255-(score-40)/50*215
const complete = computed(() => [...tasks.map(t=>t.id),'quantization'].filter(k=>book.checked[k]).length)
function loadTask(i: number) { task.value=i; metric.value=tasks[i].metric; budget.value=tasks[i].budget; threshold.value=tasks[i].threshold; bits.value=16 }
function restart() { reset(); loadTask(0) }
function exportBook() { download({ source: 'LLaMA Table 3; https://arxiv.org/pdf/2302.13971#page=4', models, scenario: { metric: metrics[metric.value], bit_width: bits.value, decimal_gb: budget.value, minimum_score: threshold.value } }) }
</script>
<template>
  <section class="paper-lab">
    <h3>模型选型台：先满足任务，再比较大小</h3>
    <p>LLaMA 关注不同推理预算下的表现。与“训练时最省算力”不同，一个多训练一些的小模型可能更适合之后反复使用。先用论文成绩做候选筛选，再检查你究竟还缺什么部署证据。</p>
    <div class="controls"><button v-for="(t,i) in tasks" :key="t.id" :aria-pressed="task===i" @click="loadTask(i)">任务 {{ i+1 }}</button></div>
    <p class="alert">固定任务：{{ current.title }}。选择满足条件且纯权重最小的候选。</p>
    <div class="controls">
      <label>探索任务<select v-model.number="metric"><option v-for="(m,i) in metrics" :key="m" :value="i">{{ m }}</option></select></label>
      <label>权重位宽<select v-model.number="bits"><option :value="32">32 bit</option><option :value="16">16 bit</option><option :value="8">8 bit（质量未知）</option><option :value="4">4 bit（质量未知）</option></select></label>
      <label>纯权重预算 {{ budget }} GB<input v-model.number="budget" type="range" min="1" max="400"></label>
      <label>最低原文成绩 {{ threshold }}%<input v-model.number="threshold" type="range" min="40" max="90" step="0.1"></label>
      <button @click="loadTask(task)">恢复当前任务条件</button>
    </div>
    <svg viewBox="0 0 660 315" role="img" aria-label="成绩与纯权重存储散点图；绿色区域满足两个算术筛选条件，不是部署保证">
      <rect v-if="bits>=16" x="65" y="40" :width="px(budget)-65" :height="py(threshold)-40" fill="#dcfce7"/>
      <g v-for="score in [40,50,60,70,80,90]" :key="score"><path :d="`M65 ${py(score)}H605`" stroke="#e2e8f0"/><text x="55" :y="py(score)+4" text-anchor="end" font-size="11">{{score}}%</text></g>
      <path d="M65 30V255H615" fill="none" stroke="#64748b"/>
      <path :d="`M${px(budget)} 35V255 M65 ${py(threshold)}H605`" stroke="#0d9488" stroke-dasharray="5 4"/>
      <g v-for="r in rows" :key="r.name"><circle :cx="px(r.gb)" :cy="py(r.score)" r="6" :fill="bits<16?'#94a3b8':r.gb<=budget&&r.score>=threshold?'#15803d':'#2563eb'"><title>{{r.name}}：{{r.gb}} GB；原文 {{r.score}}%</title></circle><text :x="px(r.gb)" :y="py(r.score)-11" text-anchor="middle" font-size="11">{{r.n}}B</text></g>
      <text x="65" y="20" font-size="12">{{metrics[metric]}} · 原文成绩（纵轴 40–90%）</text><text x="65" y="277" font-size="11">0 GB</text><text x="605" y="277" text-anchor="end" font-size="11">{{xmax.toFixed(1)}} GB</text><text x="65" y="304" font-size="12">竖虚线：预算 {{budget}} GB；横虚线：最低成绩 {{threshold}}%</text>
    </svg>
    <p v-if="bits<16" class="note">灰点只是原文成绩投影到量化存储估算，未测量量化质量，因此不标达标区域。</p>
    <div class="chart"><table><caption>原文 Table 3 成绩与当前存储估算</caption><thead><tr><th>模型</th><th>{{ metrics[metric] }}（%）</th><th>纯权重 GB</th><th>筛选结果</th></tr></thead><tbody><tr v-for="r in rows" :key="r.name"><td>{{ r.name }}</td><td><span class="score-track"><span :style="{width:r.score+'%'}"/></span>{{ r.score }}</td><td>{{ r.gb.toFixed(1) }}</td><td>{{ r.gb>budget ? '超过存储预算' : bits<16 ? '存储可容纳；量化成绩未知' : r.score<threshold ? '原文成绩未达标' : '候选；尚需部署实测' }}</td></tr></tbody></table></div>
    <p role="status">{{ bits<16 ? '不能用未量化的原文成绩判定量化模型是否达标。当前只比较存储。' : candidates.length ? `按这两个约束筛选，最小候选是 ${candidates[0].name}。` : '当前没有同时满足两个约束的候选；需要调整任务或预算，不能自动推荐一个不达标模型。' }}</p>
    <EvidenceQuestion :title="`固定任务 ${task+1} 的最小候选（按题面条件，不随探索滑块变化）`" :options="models.map(m=>m.name)" :value="book.answers[current.id]" :checked="book.checked[current.id]" :correct="current.correct" :explanation="current.why" @answer="answer(current.id,$event)" @check="check(current.id)"/>
    <EvidenceQuestion title="把 13B 改为 4 bit，6.5 GB 的估算能证明什么？" :options="['只估算纯权重大小','证明 8GB 显卡能保持原成绩运行','证明速度提高四倍']" :value="book.answers.quantization" :checked="book.checked.quantization" correct="只估算纯权重大小" explanation="存储估算不含 KV cache、激活、量化元数据和运行时开销；质量和时延必须测量。原文系统比较也不能隔离出 RMSNorm、RoPE 或某一项数据处理的贡献。" @answer="answer('quantization',$event)" @check="check('quantization')"/>
    <details><summary>为何这只是候选筛选，而不是部署承诺？</summary><p>GB = 参数数 × bit / 8 / 10⁹，是十进制单位，不是 GiB。图中成绩条从 0% 起；没有误差条不代表差异已通过显著性检验。16/32 bit 案例仅把原文成绩作为筛选参照，未重新测量对应精度下的质量。</p><p>GPT-3 与 LLaMA 的训练数据、训练量和架构均不同；Table 3 是系统成绩，不能据此算硬件速度，也不是单变量因果实验。</p><p><a :href="paperPdf('17',4)" target="_blank" rel="noopener">本地 Table 3（PDF p4）</a> · <a href="https://arxiv.org/pdf/2302.13971#page=4" target="_blank" rel="noopener">公开原文 Table 3</a></p></details>
    <EvidenceNotes :book="book" :saved="saved" :completed="complete" :total="4" @notes="book.notes=$event" @reset="restart" @download="exportBook"/>
  </section>
</template>
<style scoped>.score-track{display:inline-block;width:85px;height:8px;background:#e2e8f0;margin-right:8px}.score-track>span{display:block;height:100%;background:#2563eb}</style>
