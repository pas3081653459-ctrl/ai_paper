<script setup lang="ts">
import LearningGuide from './components/LearningGuide.vue'
import { computed, ref } from 'vue'
import NumberMatrix from './components/NumberMatrix.vue'
import TransformerExplorer from './components/TransformerExplorer.vue'
import AttentionJourney from './components/AttentionJourney.vue'
import { demo, vocabulary, embedding, Wq, Wk, Wv, Wo, W1, W2 } from './transformerDemo'
import './transformerLesson.css'
import attentionSource from '../../../transformer_layers.py?raw'
import bertSource from '../../../bert_model.py?raw'
import gptSource from '../../../gpt_model.py?raw'
withDefaults(defineProps<{paperMode?:boolean}>(),{paperMode:false})
const explorer=ref<InstanceType<typeof TransformerExplorer>>()
function inspectAttention(row:number,col:number){explorer.value?.focusAttention(row,col)}
const step=ref(0), causal=ref(true), head=ref(0), query=ref(2), noun=ref(2), temperature=ref(1)
const ids=computed(() => [0,1,noun.value,4])
const words=computed(() => ids.value.map((id,i) => `${i}·${vocabulary[id]}`))
const data=computed(() => demo(ids.value,causal.value,temperature.value))
const current=computed(() => data.value.heads[head.value])
const selectedWeights=computed(() => current.value.weights[query.value])
const weightedValues=computed(() => current.value.v.map((row,j) => row.map(v => selectedWeights.value[j]*v)))
const steps=['文字与向量','Q / K / V','注意力分数','Softmax 与加权求和','多头合并','残差与前馈网络','词表输出']
const code = [
`# input_ids: [B,T]，整数编号，不能直接传字符串
positions = torch.arange(T, device=input_ids.device)
x = token_embedding(input_ids) + position_embedding(positions)
# x: [B,T,C]；TinyGPT 使用可学习位置表
# 本页数值演示使用正弦位置编码，方便逐项计算`,
`# Pre-LN Block 中先归一化，再计算 Q/K/V
u = norm1(x)                          # [B,T,C]
q = query(u)                         # [B,T,C]
k = key(u)
v = value(u)
q = q.reshape(B,T,H,D).transpose(1,2) # [B,H,T,D]
k = k.reshape(B,T,H,D).transpose(1,2)
v = v.reshape(B,T,H,D).transpose(1,2)`,
`# i 行为 Query，j 列为 Key
scores = q @ k.transpose(-2,-1) / math.sqrt(D)
# scores: [B,H,T,T]
if causal:
    mask = torch.ones(T,T,device=x.device,dtype=torch.bool).tril()
    scores = scores.masked_fill(~mask, float('-inf'))
# padding 则屏蔽对应 key 列；本页四个 token 均有效`,
`# 标准注意力 temperature=1；滑块仅用来观察分布变化
weights = torch.softmax(scores / temperature, dim=-1)
# 每个 query 的一行概率和为 1
context = weights @ v  # [B,H,T,D]
# context[i] = sum_j weights[i,j] * v[j]
# 本页不使用 dropout，以保持数值可复算`,
`# 头之间拼接，不是直接求平均
context = context.transpose(1,2).contiguous()
context = context.reshape(B,T,C)  # C=H*D
attention_output = output(context) # Linear(C,C)
# 每个头可有不同的注意力分布`,
`# GPT 风格 Pre-LN，注意 x 是原始残差输入
r = x + attention(norm1(x))
u = norm2(r)
f = linear2(gelu(linear1(u)))
y = r + f
# 多个 Block 重复上述过程
hidden = final_norm(y)
# 完整模型可含 dropout；本页单 Block、无 dropout`,
`hidden = final_norm(block_output)     # [B,T,C]
logits = lm_head(hidden)              # [B,T,V]
next_logits = logits[:, -1, :]        # 仅适用于无 padding 的末尾
probabilities = next_logits.softmax(-1)
next_id = probabilities.argmax(-1)    # 贪心选择示意
# tokenizer.decode(next_id) 才得到可读文字
# 再追加编号，重复前向，形成自回归生成`
]
</script>

<template>
<div class="transformer-page">
 <header v-if="!paperMode" class="lesson-header"><a href="#/">← CNN / ResNet</a><strong>Transformer 原理</strong><a href="#/papers">论文实验室</a><span>数据流 · 数学 · 代码</span></header>
 <LearningGuide v-if="!paperMode" paper-id="04"/>
 <section class="lesson-layout">
  <aside class="lesson-sidebar">
   <nav aria-label="Transformer 学习步骤"><button v-for="(title,i) in steps" :key="title" :class="{active:step===i}" :aria-current="step===i?'step':undefined" @click="step=i">{{i+1}}. {{title}}</button></nav>
   <p>按顺序阅读，也可直接选择步骤。所有矩阵来自同一次前向计算。</p>
  </aside>
  <div class="lesson-content">
   <section class="lesson-card">
    <h1>走进 Transformer 的数据流</h1>
    <p>从编号到词表概率：逐层播放、旋转张量、点击一个数，追踪它的计算来源。下面的 3D 视图、矩阵与代码使用同一组数据。</p>
    <details><summary>Encoder、Decoder 和 Embedding 有什么区别？</summary>
     <div class="architecture-grid"><div><h3>BERT：Encoder-only</h3><p>编号 → Embedding → 双向自注意力 Block → 任务头。能看左右两侧，用于掩码预测、分类等。</p></div><div><h3>GPT：Decoder-only</h3><p>编号 → Embedding → 因果自注意力 Block → 词表输出。只看当前位置及之前；没有 Encoder，也没有交叉注意力。</p></div><div><h3>经典翻译：Encoder–Decoder</h3><p>源句经过 Encoder；Decoder 同时读取目标端已有词元，并通过交叉注意力读取源句。不是直接把现成 BERT 与 GPT 拼接。</p></div></div>
     <p><strong>Embedding 是查表，Encoder 是上下文计算。</strong>两者不是同一层。解码器也有自己的 Embedding，因此文字接口背后仍然是向量计算。交叉注意力中 Q 来自 Decoder，K/V 来自 Encoder；自注意力的 Q/K/V 则来自同一个序列。</p>
    </details>
   </section>
   <section class="lesson-card demo-controls" aria-label="演示设置">
    <div><label for="lesson-mask">可见范围</label><select id="lesson-mask" v-model="causal"><option :value="true">因果注意力（GPT）</option><option :value="false">双向注意力（Encoder）</option></select></div>
    <div><label for="lesson-noun">输入序列</label><select id="lesson-noun" v-model.number="noun"><option :value="2">我 / 喜欢 / 猫 / 。</option><option :value="3">我 / 喜欢 / 狗 / 。</option></select></div>
    <div><label for="lesson-head">注意力头</label><select id="lesson-head" v-model.number="head"><option :value="0">Head 1</option><option :value="1">Head 2</option></select></div>
    <div><label for="lesson-query">观察 Query 位置</label><select id="lesson-query" v-model.number="query"><option v-for="(word,i) in words" :key="i" :value="i">{{word}}</option></select></div>
    <div class="temperature-control"><label for="lesson-temperature">注意力温度 τ = {{temperature.toFixed(2)}}</label><input id="lesson-temperature" v-model.number="temperature" type="range" min="0.25" max="2" step="0.25"/><button @click="temperature=1">恢复 τ=1</button></div>
    <details class="demo-disclaimer"><summary>数值来自哪里？这些设置代表什么？</summary><p>固定教学参数，未训练；不是模型学到的语言关系。B=1，T=4，C=4，H=2，D=2；矩阵省略批次维。两种模式均用 Pre-LN 单 Block，仅切换掩码，不代表完整 BERT/GPT 对照。τ=1 为标准缩放点积注意力；计算保留原精度，显示四舍五入至三位。</p></details>
   </section>
   <AttentionJourney :data="data" :words="words" :head="head" :temperature="temperature" v-model:query="query" v-model:causal="causal" v-model:noun="noun" @inspect="inspectAttention"/>
   <TransformerExplorer ref="explorer" :data="data" :ids="ids" :words="words" :temperature="temperature" :causal="causal" v-model:chapter="step" v-model:head="head" v-model:query="query" />
   <article class="lesson-card lesson-detail">
    <h2>{{step+1}}. {{steps[step]}}</h2>
    <template v-if="step===0">
     <p>Tokenizer 把文本切成 token 并映射为整数。本页使用固定词表与预先切好的四个 token，真实 tokenizer 可能按字、子词或字节切分。编号只用于索引，不表示语义距离。</p>
     <div class="token-row"><div v-for="(id,i) in ids" :key="i"><strong>{{vocabulary[id]}}</strong><span>token ID = {{id}}</span><small>位置 p = {{i}}</small></div></div>
     <div class="formula">Xₚ = E[token_idₚ] + PEₚ<br/>PE(p, 2i) = sin(p / 10000^(2i/C))<br/>PE(p, 2i+1) = cos(p / 10000^(2i/C))</div>
     <p>E 是词嵌入表。同一 token 的初始词向量相同；位置编码让不同位置具有不同输入。两者逐元素相加，通道数依然是 C。位置编码本身不负责理解语义。</p>
     <NumberMatrix title="词嵌入表 E" :values="embedding" :rows="vocabulary"/>
     <div class="matrix-pair"><NumberMatrix title="查表得到的词向量" :values="data.tokens" :rows="words"/><NumberMatrix title="位置编码 PE" :values="data.positions" :rows="words"/></div>
     <NumberMatrix title="X = 词向量 + 位置编码" :values="data.x" :rows="words"/>
     <p>这个数值例子用正弦位置编码便于手算；项目中的 TinyBERT / TinyGPT 使用可学习的位置嵌入表。BERT 还加句段嵌入，用于区分句段 0 与 1。</p>
    </template>
    <template v-else-if="step===1">
     <p>本页使用 Pre-LN：先把每个 token 的四个特征归一化，再分别投影为 Q、K、V。三套权重不同，即使来源相同，输出也不同。</p>
     <div class="formula">U = LayerNorm(X)<br/>Q = U WQ，K = U WK，V = U WV</div>
     <ul><li><strong>Query（查询）</strong>：当前位置用于匹配其他位置的表示。</li><li><strong>Key（键）</strong>：每个位置提供的匹配表示。</li><li><strong>Value（值）</strong>：匹配后实际汇总的信息。</li></ul>
     <p>“查询”不是自然语言问题，只是向量的作用名称。WQ/WK/WV 在训练中通过梯度更新；本页固定给定。PyTorch Linear 的 weight 存储为 [out,in]，实际计算 x @ weight.T，本页数学表则按右乘 [in,out] 展示。</p>
     <NumberMatrix title="U = LayerNorm(X)" :values="data.u" :rows="words"/>
     <details><summary>查看投影权重 WQ / WK / WV</summary><NumberMatrix title="WQ" :values="Wq"/><NumberMatrix title="WK" :values="Wk"/><NumberMatrix title="WV" :values="Wv"/></details>
     <NumberMatrix title="完整 Q（分头前）" :values="data.q" :rows="words"/>
     <div class="formula">[B,T,C] → reshape [B,T,H,D] → transpose [B,H,T,D]<br/>C = H × D = 2 × 2 = 4</div>
     <p>Head 1 取投影结果的第 0、1 列，Head 2 取第 2、3 列。切分的是投影后的特征，不是把句子切成两半。</p>
     <div class="matrix-triple"><NumberMatrix title="当前头 Q" :values="current.q" :rows="words"/><NumberMatrix title="当前头 K" :values="current.k" :rows="words"/><NumberMatrix title="当前头 V" :values="current.v" :rows="words"/></div>
    </template>
    <template v-else-if="step===2">
     <p>对第 i 个 Query，与每个位置 j 的 Key 做点积，得到 T 个匹配分数。注意力表的行是“谁在读取”，列是“读取谁”。分数不是概率，可以为负数。</p>
     <div class="formula">Sᵢⱼ = (qᵢ · kⱼ) / √D = Σᵈ qᵢᵈ kⱼᵈ / √D</div>
     <p>这里 D=2，所以除以 √2。若各分量独立、零均值且方差约为 1，点积方差随 D 增大；缩放能避免分数过大让 Softmax 过于尖锐。</p>
     <div class="calculation">当前 Query {{words[query]}} 与 Key {{words[0]}}：<br/>({{current.q[query][0].toFixed(3)}} × {{current.k[0][0].toFixed(3)}} + {{current.q[query][1].toFixed(3)}} × {{current.k[0][1].toFixed(3)}}) / √2 = {{current.scores[query][0].toFixed(3)}}</div>
     <NumberMatrix title="缩放后的分数 S" :values="current.scores" :rows="words" :columns="words" :selected-row="query"/>
     <div class="formula">Lᵢⱼ = Sᵢⱼ / τ + Mᵢⱼ<br/>因果模式：j ≤ i 时 M=0；j &gt; i 时 M=−∞<br/>双向模式：所有位置 M=0（本例无 padding）</div>
     <NumberMatrix title="送入 Softmax 的 L（含温度与掩码）" :values="current.masked" :rows="words" :columns="words" :selected-row="query"/>
     <p>−∞ 对应 exp(−∞)=0，未来位置的概率因此为零。切换成双向模式，上三角也会参与计算。padding mask 则屏蔽补齐位置；它与因果 mask 是两种不同限制。</p>
    </template>
    <template v-else-if="step===3">
     <p>Softmax 沿每一行计算，得到非负且总和为 1 的权重。再用这些权重对 Value 求和：注意力不是只挑一个词，也不是把 Query 本身加权。</p>
     <div class="formula">Aᵢⱼ = exp(Lᵢⱼ − mᵢ) / Σₖ exp(Lᵢₖ − mᵢ)，mᵢ = maxⱼ Lᵢⱼ<br/>Zᵢ = Σⱼ Aᵢⱼ Vⱼ，即 Z = A V</div>
     <p>减去行最大值不改变结果，可避免指数溢出。降低温度通常使分布更集中，升高温度使其更平缓。本页的温度调节发生在注意力里，与生成时调节词表概率的温度不同。</p>
     <NumberMatrix title="注意力权重 A（行和为 1）" :values="current.weights" :rows="words" :columns="words" probability :selected-row="query"/>
     <figure class="attention-figure"><figcaption>Query {{words[query]}} 从各 Value 汇总信息 · 线宽表示权重</figcaption>
      <svg viewBox="0 0 640 210" role="img" :aria-label="'Query '+words[query]+' 的注意力连线，精确数值见下表'">
       <g v-for="(word,j) in words" :key="j"><line x1="320" y1="60" :x2="80+j*160" y2="144" :stroke="selectedWeights[j]===0?'#d1d5db':'#2563eb'" :stroke-width="selectedWeights[j]===0?1:1+selectedWeights[j]*12" :stroke-dasharray="selectedWeights[j]===0?'4 4':undefined"/><rect :x="15+j*160" y="144" width="130" height="52" rx="5" fill="#eff6ff"/><text :x="80+j*160" y="164" text-anchor="middle">{{word}}</text><text :x="80+j*160" y="184" text-anchor="middle">{{(selectedWeights[j]*100).toFixed(1)}}%</text></g>
       <rect x="245" y="8" width="150" height="52" rx="5" fill="#dbeafe"/><text x="320" y="38" text-anchor="middle">Q：{{words[query]}}</text>
      </svg>
     </figure>
     <p>当前行权重和：{{selectedWeights.reduce((a,b)=>a+b,0).toFixed(6)}}。灰色虚线表示权重为零。</p>
     <div class="matrix-pair"><NumberMatrix title="各位置的 V" :values="current.v" :rows="words"/><NumberMatrix title="当前 Query：每个 Aᵢⱼ × Vⱼ" :values="weightedValues" :rows="words"/></div>
     <NumberMatrix title="逐列求和得到 Zᵢ" :values="[current.context[query]]" :rows="[words[query]]"/>
     <p><strong>注意力如何产生？</strong>输入决定 Q/K，点积产生分数，掩码限制可见范围，Softmax 转成权重。训练损失通过这些运算反向传播到投影权重；注意力矩阵则随每次输入重新计算，并不是固定存储的一张关系表。权重高不等于严格的因果解释。</p>
    </template>
    <template v-else-if="step===4">
     <p>两个头各自计算一张注意力矩阵，每头得到 [T,D] 输出。把它们沿特征维拼接恢复 [T,C]，再由 WO 混合各头的信息。</p>
     <div class="formula">Z¹ = A¹V¹，Z² = A²V²<br/>O = Concat(Z¹, Z²) WO<br/>[4,2] +拼接 [4,2] → [4,4] → [4,4]</div>
     <div class="matrix-pair"><NumberMatrix title="Head 1 的 A" :values="data.heads[0].weights" :rows="words" :columns="words" probability/><NumberMatrix title="Head 2 的 A" :values="data.heads[1].weights" :rows="words" :columns="words" probability/></div>
     <div class="matrix-pair"><NumberMatrix title="Head 1 的 Z" :values="data.heads[0].context" :rows="words"/><NumberMatrix title="Head 2 的 Z" :values="data.heads[1].context" :rows="words"/></div>
     <NumberMatrix title="Concat(Z¹,Z²)" :values="data.concat" :rows="words"/>
     <details><summary>查看输出投影 WO</summary><NumberMatrix title="WO" :values="Wo"/></details>
     <NumberMatrix title="注意力子层输出 O" :values="data.projected" :rows="words"/>
     <p>不同头提供不同的投影子空间，但并没有预设“语法头”或“语义头”。多个头也不保证学到完全不同的功能。</p>
    </template>
    <template v-else-if="step===5">
     <p>注意力负责跨位置交换信息；FFN 对各位置分别应用同一套非线性变换。残差逐元素相加，保留原输入路径，所有 Block 的输入输出仍是 [B,T,C]。</p>
     <div class="block-diagram"><div>X ──────────────┐</div><div>↓ LayerNorm → 多头注意力 → ＋ → R</div><div>R ──────────────┐</div><div>↓ LayerNorm → Linear → GELU → Linear → ＋ → Y</div></div>
     <div class="formula">R = X + MHA(LN(X))<br/>F = GELU(LN(R) W₁) W₂<br/>Y = R + F</div>
     <NumberMatrix title="第一次残差 R = X + O" :values="data.residual" :rows="words"/>
     <div class="formula">LN(r) = γ ⊙ (r − μ) / √(σ² + ε) + β<br/>μ = (1/C)Σ rᵈ，σ² = (1/C)Σ(rᵈ − μ)²</div>
     <p>LayerNorm 对一个 token 的 C 个特征求均值与方差，不跨 token 或批次。本例 γ=1、β=0、ε=10⁻⁵。实际模型的 γ/β 可学习。单看归一化部分，均值约为零、方差接近 1；仿射变换后不一定如此。</p>
     <NumberMatrix title="LN(R)" :values="data.normalized" :rows="words"/>
     <p>本例 FFN：4 → 8 → 4；已有教学 Python 模型为 C → 4C → C。这里为减少表格宽度采用 2C，无 bias、无 dropout。</p>
     <details><summary>查看 W₁、W₂ 和扩展层的数值</summary><NumberMatrix title="W₁" :values="W1"/><NumberMatrix title="W₂" :values="W2"/><NumberMatrix title="LN(R) W₁" :values="data.expanded" :rows="words"/><NumberMatrix title="GELU 后" :values="data.activated" :rows="words"/></details>
     <div class="formula">GELU(x) ≈ ½x [1 + tanh(√(2/π)(x + 0.044715x³))]</div>
     <div class="matrix-pair"><NumberMatrix title="FFN 输出 F" :values="data.ffn" :rows="words"/><NumberMatrix title="第二次残差 Y = R + F" :values="data.output" :rows="words"/></div>
     <p>这里采用 GPT 风格 Pre-LN。项目的 BertBlock 使用 Post-LN：LN(X + Attention(X))，然后 LN(R + FFN(R))。切换顶部注意力范围不会改变此处归一化顺序。</p>
    </template>
    <template v-else>
     <p>多层 Block 后，每个位置仍是一条 C 维向量。语言模型头把它转换为 V 个词表分数（logits），Softmax 才把分数变成概率。本页只有一个 Block，词表仅 6 项。</p>
     <div class="formula">H = LN(Y)<br/>logits = H Eᵀ，P = softmax(logits)<br/>[T,C] × [C,V] → [T,V]</div>
     <p>这里输出投影与词嵌入表共享权重（weight tying）。这是同一组参数的两次使用，不是用 Embedding 的数学逆运算还原文字。</p>
     <NumberMatrix title="最终上下文向量 H" :values="data.final" :rows="words"/>
     <NumberMatrix title="词表 logits" :values="data.logits" :rows="words" :columns="vocabulary"/>
     <NumberMatrix title="词表概率 P" :values="data.probabilities" :rows="words" :columns="vocabulary" probability/>
     <p v-if="causal">因果模式下，第 0 行根据「我」预测下一个 token，第 1 行根据「我 喜欢」预测下一个 token。最后一行根据完整输入预测后续 token。它们不是对当前位置输入的复原。</p>
     <p v-else class="lesson-notice">当前是双向模式，较早位置已经看到了后续输入；不能把这些行当成无泄漏的自回归下一词预测。BERT 通常用被遮住位置的词表输出或 [CLS] 分类头，且有自己的预训练目标。</p>
     <div class="flow-strip"><b>末尾 logits</b><span>→</span><b>选择一个编号</b><span>→</span><b>追加至输入</b><span>→</span><b>再次前向</b><span>→</span><b>解码为文字</b></div>
     <p>训练时可用因果 mask 同时计算所有位置，并把预测与右移一位的目标对齐；生成时没有未来答案，需要逐个产生 token。实际推理常缓存历史 K/V 以避免重复计算。本页不训练、不采样，也不使用 KV cache。</p>
     <p><strong>这些概率没有语言能力。</strong>它们来自固定的未训练参数，只用于观察数据形状和运算过程。</p>
    </template>
    <details class="lesson-code"><summary>展开这一步的 PyTorch 代码</summary><p>下面是流程节选，B/T/C/H/D 表示维度，需放在模型上下文中阅读。</p><pre><code>{{code[step]}}</code></pre></details>
    <div class="lesson-pager"><button :disabled="step===0" @click="step--">← 上一步</button><span>{{step+1}} / {{steps.length}}</span><button :disabled="step===steps.length-1" @click="step++">下一步 →</button></div>
   </article>
   <section class="lesson-card"><h2>对照项目代码阅读</h2><ul><li><code>gpt_model.py</code>：TinyGPT.forward → GPTBlock.forward，跟踪输入编号到 logits。</li><li><code>bert_model.py</code>：TinyBERT.forward → BertBlock.forward，对照双向注意力、句段嵌入和分类头。</li><li><code>transformer_layers.py</code>：SelfAttention.forward 展开 Q/K/V、分头、掩码、Softmax 与加权求和。</li><li><code>frontend/src/transformerDemo.ts</code>：本页矩阵的实际计算，所有数字可回溯。</li></ul><p>两种实现遵循相同核心运算；本页刻意缩小维度，固定参数并省略 dropout。矩阵按 [in,out] 右乘、正弦位置编码、FFN 宽度等差异已在对应步骤标明。</p>
    <div class="lesson-code"><p>以下完整源码在构建时从项目文件直接读取，只展示文本，不执行 Python。</p><details><summary>完整代码：transformer_layers.py</summary><pre><code>{{attentionSource}}</code></pre></details><details><summary>完整代码：gpt_model.py</summary><pre><code>{{gptSource}}</code></pre></details><details><summary>完整代码：bert_model.py</summary><pre><code>{{bertSource}}</code></pre></details></div>
   </section>
  </div>
 </section>
</div>
</template>
