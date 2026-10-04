<script setup lang="ts">
import {paperPdf} from '../../papers/paperAssets'
import { computed, ref } from 'vue'
import { research } from '../../papers/research'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
const n = ref(70), multiple = ref(10), route = ref(1), show = ref(false)
const { book, saved, answer, check, reset, download } = useEvidenceNotebook('15')
const allocation = research['15'].experiments[0], evaluation = research['15'].experiments[1]
const tokensT = computed(() => 4.2e23 / (6 * n.value * 1e9) / 1e12)
const chosen = computed(() => allocation.rows[route.value])
const intervals = ['该行未给区间','a: (0.488, 0.502)；b: (0.501, 0.512)','a: (0.462, 0.534)；b: (0.483, 0.529)','a: (0.454, 0.455)；b: (0.542, 0.543)']
const routes = [
  '此前的扩展建议：新增算力主要用于参数，数据增长较慢。',
  '训练曲线包络：比较不同模型的训练曲线，在每个计算预算处寻找最低损失的配置。',
  'IsoFLOP：固定一个预算，扫描模型规模与 token 的配对；在每条等算力曲线中寻找低点。',
  '参数化拟合：用模型规模和 token 数共同解释最终损失，再在预算约束下求最优配置。',
]
const complete = computed(() => ['budget', 'prediction', 'causal'].filter(k => book.checked[k]).length)
function reveal() { check('prediction'); show.value = true }
function restart() { reset(); n.value = 70; multiple.value = 10; route.value = 1; show.value = false }
function exportBook() { download({ source: 'Chinchilla Tables 1, 2, 6; https://arxiv.org/pdf/2203.15556', arithmetic: { flops: 4.2e23, parameters_b: n.value, tokens_t: tokensT.value }, compute_multiplier: multiple.value, scaling_route: chosen.value.name }) }
</script>
<template>
  <section class="paper-lab">
    <h3>一笔算力预算：买更多参数，还是让模型多读一些？</h3>
    <p>许多大模型用了相近数量的训练 token。只比较“模型有多大”，可能把训练不足当成规模不够。Chinchilla 扫描模型与数据组合，再训练一个更小、读得更多的模型验证配置。</p>
    <h4>先挤一挤预算</h4>
    <div class="controls"><button @click="n=70">70B 配置</button><button @click="n=280">280B 配置</button><label>参数 N = {{ n }} B<input v-model.number="n" type="range" min="7" max="280" step="1"></label></div>
    <div class="cards"><article><strong>固定教学预算 C</strong><p>4.2 × 10²³ FLOPs</p></article><article><strong>可读 token 数 D</strong><p>{{ tokensT.toFixed(3) }} T</p></article><article><strong>预算约束</strong><p>D = C / (6N)</p></article></div>
    <svg viewBox="0 0 660 155" role="img" aria-label="参数和可用数据的反向变化；两条刻度分别为 280B 和 10T">
      <text x="10" y="25">参数 N / 280B</text><rect x="160" y="10" width="470" height="28" fill="#e2e8f0"/><rect x="160" y="10" :width="470*n/280" height="28" fill="#2563eb"/>
      <text x="10" y="82">数据 D / 10T</text><rect x="160" y="65" width="470" height="28" fill="#e2e8f0"/><rect x="160" y="65" :width="470*tokensT/10" height="28" fill="#0d9488"/>
      <text x="10" y="135">N × D 不变；两条长度使用不同单位，不能相加。</text>
    </svg>
    <EvidenceQuestion title="这个预算下从 70B 改为 280B，可读数据从 1T 变为？" :options="['0.25T','1T','4T']" :value="book.answers.budget" :checked="book.checked.budget" correct="0.25T" explanation="N 乘 4，D 就除以 4。C≈6ND 是训练计算的近似，只限制可行配置，并不能告诉你哪一种损失最低。" @answer="answer('budget',$event)" @check="check('budget')"/>
    <h4>论文怎样找出更好的配置？</h4>
    <div class="controls"><button v-for="(r,i) in allocation.rows" :key="r.name" :aria-pressed="route===i" @click="route=i">{{ r.name }}</button></div>
    <p class="alert">{{ routes[route] }}</p>
    <label>相对同一基点，算力扩大 {{ multiple }} 倍<input v-model.number="multiple" type="range" min="2" max="100"></label>
    <div class="cards"><article><strong>N ∝ C^{{ chosen.values[0] }}</strong><p>参数 × {{ (multiple**chosen.values[0]).toFixed(2) }}</p></article><article><strong>D ∝ C^{{ chosen.values[1] }}</strong><p>数据 × {{ (multiple**chosen.values[1]).toFixed(2) }}</p></article></div>
    <div class="chart"><table><caption>Table 2：同一算力增幅，不同估计如何分配</caption><thead><tr><th>路线</th><th>参数倍数</th><th>token 倍数</th></tr></thead><tbody><tr v-for="r in allocation.rows" :key="r.name"><td>{{ r.name }}</td><td>{{ (multiple**r.values[0]).toFixed(2) }}</td><td>{{ (multiple**r.values[1]).toFixed(2) }}</td></tr></tbody></table></div>
    <p>三种路线的点估计不完全相同，却都比此前建议更重视数据扩展。这里计算的是相对倍数，不是完整最优配置，也没有模拟损失曲线。</p>
    <p class="note">Table 2 的 bootstrap 第 10–90 百分位（照录）：{{ intervals[route] }}。原表第三路线的 a 点估计与区间并不一致；本页保留原数值，不自行修正或据此画置信带。这是拟合不确定性，不是单次训练结果的波动区间。</p>
    <h4>最后做一次真正的大模型验证</h4>
    <p>原文配置：Gopher 280B / 300B tokens；Chinchilla 70B / 1.4T tokens。论文将二者作为相近训练计算预算的系统比较；它们不等于上面的教学预算。</p>
    <div class="controls"><button v-for="x in ['Chinchilla 70B','Gopher 280B','单凭参数量无法判断']" :key="x" :aria-pressed="book.answers.prediction===x" @click="answer('prediction',x);show=false">{{ x }}</button><button :disabled="!book.answers.prediction" @click="reveal">记录预测，揭示 MMLU</button></div>
    <template v-if="show || book.checked.prediction"><div class="cards"><article v-for="r in evaluation.rows" :key="r.name"><strong>{{ r.name }}</strong><p>MMLU 5-shot：{{ r.values[0] }}%</p></article></div><p>Table 6 的差距为 7.6 个百分点。{{ book.answers.prediction==='Chinchilla 70B' ? '预测命中本次结果。' : '这次实测更小的 Chinchilla 获胜；参数量本身不能决定胜负。' }} 摘要写 67.5%，本课按 Table 6 的 67.6% 展示。</p></template>
    <EvidenceQuestion title="能把这次成绩提升全部归因于参数减少吗？" :options="['不能，需要隔离变量的证据','能，模型越小一定越好']" :value="book.answers.causal" :checked="book.checked.causal" correct="不能，需要隔离变量的证据" explanation="参数量、训练 token、训练细节共同改变。计算约束、配置扫描和完整系统验证形成证据链，但并非仅改变参数量的单因素消融。" @answer="answer('causal',$event)" @check="check('causal')"/>
    <details><summary>单位、公式与原文位置</summary><p>B = 10⁹，T = 10¹²；FLOPs 是运算次数，不是每秒运算能力。近似式不覆盖全部训练开销，不能换算设备时长或采购预算。</p><p><a :href="paperPdf('15',8)" target="_blank" rel="noopener">本地 PDF：Table 2（p8）</a> · <a href="https://arxiv.org/pdf/2203.15556" target="_blank" rel="noopener">公开原文：§3 三条路线、Table 1 / 2 / 6</a></p></details>
    <EvidenceNotes :book="book" :saved="saved" :completed="complete" :total="3" @notes="book.notes=$event" @reset="restart" @download="exportBook"/>
  </section>
</template>
