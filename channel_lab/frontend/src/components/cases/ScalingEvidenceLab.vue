<script setup lang="ts">
import {paperPdf} from '../../papers/paperAssets'
import { computed, ref, shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import { fields, list, text, positive, bool } from '../../papers/traceValidation'
import { scalingFixture, scalingSource } from '../../papers/scalingFixture'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'

const shape = fields({ axis: text, controls: text, points: list(fields({ x: positive, loss: positive, held_out: bool }), 3, 500) })
function parse(value: unknown) {
  const result = shape(value)
  if (result.points.some(p => p.x < 1e-12 || p.x > 1e30 || p.loss < 1e-12 || p.loss > 1e12)) throw Error('坐标超出本教学图支持的数值范围')
  if (new Set(result.points.filter(p => !p.held_out).map(p => p.x)).size < 2) throw Error('需要至少两个不同 x 的非留出点')
  if (!result.points.some(p => p.held_out)) throw Error('至少提供一个留出点才能检验预测')
  return result
}
const data = shallowRef<ReturnType<typeof parse>>(scalingFixture)
const imported = ref(false), loaderKey = ref(0), revealed = ref(false), log = ref(true), count = ref(4)
const { book, saved, answer, check, reset, download } = useEvidenceNotebook('09')
function restore() { data.value = scalingFixture; imported.value = false; revealed.value = false; count.value = 4; log.value = true; loaderKey.value++ }
function accept(value: unknown) { data.value = parse(value); imported.value = true; revealed.value = false; count.value = training.value.length }
const training = computed(() => data.value.points.filter(p => !p.held_out).slice().sort((a, b) => a.x - b.x))
const selected = computed(() => training.value.slice(0, count.value))
const held = computed(() => data.value.points.filter(p => p.held_out))
const fit = computed(() => {
  const ps = selected.value, xs = ps.map(p => Math.log(p.x)), ys = ps.map(p => Math.log(p.loss))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length
  const denominator = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
  if (denominator < 1e-12) return null
  const b = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / denominator
  const a = my - b * mx
  if (data.value.points.some(p => !Number.isFinite(a+b*Math.log(p.x)) || Math.abs(a+b*Math.log(p.x))>200)) return null
  return { a, b }
})
const predict = (x: number) => fit.value ? Math.exp(fit.value.a + fit.value.b * Math.log(x)) : NaN
const shown = computed(() => data.value.points.filter(p => revealed.value || !p.held_out))
const domain = computed(() => {
  const xs = data.value.points.map(p => p.x)
  // Hidden measurements do not enter either the fit or the y-axis range.
  const ys = shown.value.map(p => p.loss)
  for (const x of xs) { const y = predict(x); if (Number.isFinite(y) && y > 0) ys.push(y) }
  return { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys) * .9, ymax: Math.max(...ys) * 1.1 }
})
const transform = (x: number) => log.value ? Math.log10(x) : x
const inverse = (x: number) => log.value ? 10 ** x : x
function fraction(v: number, min: number, max: number) { return (transform(v) - transform(min)) / (transform(max) - transform(min) || 1) }
const px = (x: number) => 75 + fraction(x, domain.value.xmin, domain.value.xmax) * 550
const py = (y: number) => 275 - fraction(y, domain.value.ymin, domain.value.ymax) * 235
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => {
  const d = domain.value, f = i / 4
  return { x: inverse(transform(d.xmin) + f * (transform(d.xmax) - transform(d.xmin))), y: inverse(transform(d.ymin) + f * (transform(d.ymax) - transform(d.ymin))) }
}))
const line = computed(() => fit.value ? Array.from({ length: 60 }, (_, i) => {
  const d = domain.value, x = inverse(transform(d.xmin) + i / 59 * (transform(d.xmax) - transform(d.xmin)))
  return `${px(x)},${py(predict(x))}`
}).join(' ') : '')
const complete = computed(() => ['scope', 'axes'].filter(key => book.checked[key]).length)
function restart() { reset(); restore() }
function exportBook() { download({ source: imported.value ? 'User supplied trace; see its provenance separately' : scalingSource, data: data.value, training_count: count.value, fit: fit.value, held_out_revealed: revealed.value }) }
</script>
<template>
  <section class="paper-lab">
    <h3>拿小模型的结果，预测还没看到的大模型</h3>
    <p>问题：每扩大一次模型都训练到收敛，太贵。论文先测一系列规模，再寻找可外推的规律。这里把 Figure 6 的一条曲线拆成拟合点和留出点，让预测接受检验。</p>
    <p class="alert">{{ imported ? '当前使用导入点集，来源仍需核验。' : '默认 6 个点来自 Figure 6 右图橙色 6 层曲线的近似读图，不是作者原始数据。末 2 点由本课留出；精度不足以复现论文 α = 0.076。' }}</p>
    <p>{{ data.axis }} · {{ data.controls }}</p>
    <div class="controls">
      <label>用最小的 {{ count }} 个非留出点拟合 <input v-model.number="count" type="range" min="2" :max="training.length" @input="revealed=false"></label>
      <label><input v-model="log" type="checkbox">双对数坐标</label>
      <button @click="revealed=!revealed">{{ revealed ? '隐藏留出点' : '检验预测：揭示留出点' }}</button>
      <button @click="restore">恢复论文固定案例</button>
    </div>
    <svg viewBox="0 0 680 345" role="img" aria-label="拟合点、未使用点、留出点和预测曲线；完整数值见下方表格">
      <g v-for="(tick,i) in ticks" :key="i" fill="#475569" font-size="11">
        <path :d="`M75 ${py(tick.y)}H625`" stroke="#e2e8f0"/><text x="65" :y="py(tick.y)+4" text-anchor="end">{{ tick.y.toPrecision(3) }}</text>
        <text :x="px(tick.x)" y="298" text-anchor="middle">{{ tick.x.toExponential(1) }}</text>
      </g>
      <path d="M75 25V275H640" fill="none" stroke="#64748b"/>
      <polyline v-if="fit" :points="line" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 4"/>
      <circle v-for="(p,i) in shown" :key="i" :cx="px(p.x)" :cy="py(p.loss)" r="5" :fill="p.held_out ? '#ea580c' : selected.includes(p) ? '#2563eb' : '#94a3b8'"><title>x={{ p.x }}, loss={{ p.loss }}</title></circle>
      <text x="75" y="18" font-size="12">测试交叉熵 L（内置案例单位：nats）</text><text x="75" y="328" font-size="12">{{ data.axis }} · {{ log ? '两轴取对数；刻度显示原始值' : '两轴原始线性坐标' }}</text>
    </svg>
    <p class="note">蓝点参与拟合，灰点未使用，橙点留出；虚线为预测。切换坐标只改变画法，拟合始终在 ln 空间进行。揭示留出点时纵轴可能扩展。</p>
    <p v-if="fit">ln L = {{ fit.a.toFixed(4) }} {{ fit.b < 0 ? '−' : '+' }} {{ Math.abs(fit.b).toFixed(4) }} ln x；α = {{ (-fit.b).toFixed(4) }}。减至 2 个点，再检验远处的预测是否仍可靠。</p>
    <p v-else role="status">当前范围无法稳定拟合：检查重复或过于接近的横坐标，或增加点数。</p>
    <div class="chart"><table><caption>未参与拟合的留出点</caption><thead><tr><th>x</th><th>预测 L</th><th>读图 / 导入 L</th><th>绝对相对误差</th></tr></thead><tbody><tr v-for="(p,i) in held" :key="i"><td>{{ p.x.toExponential(2) }}</td><td>{{ fit ? predict(p.x).toFixed(4) : '无法拟合' }}</td><td>{{ revealed ? p.loss : '待揭示' }}</td><td>{{ revealed && fit ? (Math.abs(predict(p.x)/p.loss-1)*100).toFixed(2)+'%' : '—' }}</td></tr></tbody></table></div>
    <EvidenceQuestion title="留出点接近预测，能证明什么？" :options="['支持该范围内的近似趋势','保证所有模型都遵循同一规律','已经复现论文完整拟合']" :value="book.answers.scope" :checked="book.checked.scope" correct="支持该范围内的近似趋势" explanation="这只是近似读图、单一深度、少量点的检验；原文还有不同深度、数据与计算受限实验。更远外推和未收敛模型需要新证据。" @answer="answer('scope',$event)" @check="check('scope')"/>
    <EvidenceQuestion title="把坐标切成线性后，为什么 α 没有变化？" :options="['显示方式没有改变拟合数据和目标','幂律在任何坐标上都是直线']" :value="book.answers.axes" :checked="book.checked.axes" correct="显示方式没有改变拟合数据和目标" explanation="这里最小化的是 ln L 的残差平方和，不是原始 L 的残差；幂律只在双对数坐标中成为直线。" @answer="answer('axes',$event)" @check="check('axes')"/>
    <details><summary>数据、拟合方法与原文</summary><p>公式：b = Σ(ln x − 平均 ln x)(ln L − 平均 ln L) / Σ(ln x − 平均 ln x)²；a = 平均 ln L − b·平均 ln x。本课无不可约损失项，不使用留出点调参。多次观察留出点后重新选择范围，就不再是严格的盲测。</p><p>{{ scalingSource.precision }} 原文 αN=0.076、αD=0.095、αCmin=0.050 来自不同受控设置，不是本课拟合的期望答案。</p><pre>{{ JSON.stringify(data,null,2) }}</pre><a :href="paperPdf('09',8)" target="_blank" rel="noopener">本地 Figure 6（PDF p8）</a> · <a :href="scalingSource.url" target="_blank" rel="noopener">公开原文 Figure 6</a></details>
    <details><summary>可选：用自己的实验点替换固定案例</summary><TraceLoader :key="loaderKey" paper-id="09" :validate="parse" @loaded="accept" @clear="revealed=false"/><p>导入失败时保留当前案例。数据须包含至少两个不同 x 的训练点和一个留出点。</p></details>
    <EvidenceNotes :book="book" :saved="saved" :completed="complete" :total="2" @notes="book.notes=$event" @reset="restart" @download="exportBook"/>
  </section>
</template>
