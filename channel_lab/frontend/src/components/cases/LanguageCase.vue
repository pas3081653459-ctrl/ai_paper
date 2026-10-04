<script setup lang="ts">
import { computed, ref } from 'vue'
import { language } from '../../papers/language'
import { attention, embedding, mm, weights, softmax } from '../../papers/math'
import { languageResearch } from '../../papers/researchLanguage'
const props=defineProps<{id:string}>()
const phase=ref(0),task=ref(0),mask=ref(3),replacement=ref('mask'),causal=ref(false)
const gpt=computed(()=>language('05',{task:phase.value?1:0}))
const bertWords=['[CLS]','我','喜欢','猫','。'],original=[0,1,2,3,4]
const ids=computed(()=>original.map((id,i)=>i!==mask.value?id:replacement.value==='mask'?8:replacement.value==='random'?5:id))
const words=computed(()=>bertWords.map((w,i)=>i!==mask.value?w:replacement.value==='mask'?'[MASK]':replacement.value==='random'?'狗':w))
const bert=computed(()=>attention(embedding(ids.value),causal.value))
const probs=computed(()=>softmax(mm([bert.value.out[mask.value]],weights(4,9,8))[0]))
const suffix=ref(1),shots=ref(1),swap=ref(false),guess=ref(''),revealed=ref(false)
const article='阿明上午去了公园。下午下雨，他带伞回家。'
const suffixes=['','\nTL;DR:','\nQuestion: 阿明下午为什么带伞？\nAnswer:']
const positive=computed(()=>swap.value?'wug':'dax'),negative=computed(()=>swap.value?'dax':'wug')
const examples=computed(()=>[`这顿饭很好吃 → ${positive.value}`,`服务很糟糕 → ${negative.value}`].slice(0,shots.value))
const positionQ=ref(2),positionK=ref(4),offset=ref(0)
const rotate=(v:number[],p:number)=>[v[0]*Math.cos(p)-v[1]*Math.sin(p),v[0]*Math.sin(p)+v[1]*Math.cos(p)]
const q=computed(()=>rotate([1,0],(positionQ.value+offset.value)*.3))
const k=computed(()=>rotate([.5,.8],(positionK.value+offset.value)*.3))
const dot=computed(()=>q.value[0]*k.value[0]+q.value[1]*k.value[1])
const model=ref(1),metric=ref(0)
const llama=computed(()=>languageResearch['17'].experiments[0])
function resetGuess(){guess.value='';revealed.value=false}
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='05'">
   <div class="case-controls"><button :aria-pressed="phase===0" @click="phase=0">无标注预训练</button><button :aria-pressed="phase===1" @click="phase=1">带标签任务微调</button></div>
   <div class="cards"><article><strong>数据托盘</strong><p>{{phase?'“这部电影很好看” → 正面':'“这部电影很好看” → 用前文预测下一个 token'}}</p><label v-if="phase">任务组织<select v-model.number="task"><option :value="0">单句分类</option><option :value="1">句对判断</option></select></label><code>{{phase&&task?'[Start] 句子A [Delim] 句子B [Extract]':'[Start] 文本 [Extract]'}}</code></article><article><strong>同一个 Transformer 主干</strong><p class="trainable">{{phase?'继续更新主干参数':'更新主干参数，学习语言建模'}}</p><p>{{phase?'末尾表示 → 分类头 → 标签损失':'各位置表示 → 词表头 → 下一个 token 损失'}}</p></article><article><strong>输出接口</strong><code>{{phase?'[B, K]':'[B, T, V]'}}</code><p>{{phase?'分类头新增参数；主干不是默认冻结的特征提取器。':'监督来自文本本身，不需要给整句贴“正面/负面”标签。'}}</p></article></div>
   <details><summary>查看缩小后的真实计算形状</summary><p>固定四个教学 token，不对应上面的自然语言语义。</p><div v-for="s in gpt.stages.filter(s=>['ids','ffn','output'].includes(s.id))" :key="s.id" class="equation">{{s.title}} [{{s.shape.join(',')}}]</div></details><p>切换阶段改变了学习目标与数据组织。原始 GPT-1 的迁移会微调参数；它与 GPT-3 在提示中提供示例不同。</p>
  </template>
  <template v-else-if="props.id==='06'">
   <p>原句：我 / 喜欢 / 猫 / 。 点击要监督的位置。</p><div class="tokens"><button v-for="(w,i) in bertWords" :key="i" :disabled="i===0" :aria-pressed="mask===i" @click="mask=i">{{w}}</button></div>
   <div class="case-controls"><label>选中位置的输入<select v-model="replacement"><option value="mask">80% 分支：换成 [MASK]</option><option value="random">10% 分支：随机词（例：狗）</option><option value="keep">10% 分支：保留原词</option></select></label><label><input v-model="causal" type="checkbox"/> 对照：限制为单向</label></div>
   <div class="tokens"><span v-for="(w,i) in words" :key="i" :class="{masked:i===mask}">{{w}}<small>{{i===mask?'此位置计入 MLM 损失':'不计 MLM 损失'}}</small></span></div>
   <svg class="scene" viewBox="0 0 600 170" aria-label="被监督位置读取两侧上下文"><g v-for="(w,i) in words" :key="i"><path :d="`M ${60+mask*120} 30 Q ${60+i*120} 65 ${60+i*120} 120`" :stroke="causal&&i>mask?'#cbd5e1':'#2563eb'" :stroke-dasharray="causal&&i>mask?'4 5':undefined" :stroke-width="1+8*bert.a[mask][i]" fill="none"/><text :x="60+i*120" y="148" text-anchor="middle">{{w}}</text></g></svg>
   <div class="equation">监督目标始终为原词「{{bertWords[mask]}}」；不因输入换成狗而改为狗。<br/>固定小网络 P(原词) = {{probs[original[mask]].toFixed(5)}}<br/>该位置 loss = −log P = {{(-Math.log(probs[original[mask]])).toFixed(5)}}</div>
   <p>[MASK] 是一个输入符号，不是删除注意力的一列。即使输入保持原词，该被选位置仍有监督。上图线宽来自固定小网络，不表示已学到语义。</p>
  </template>
  <template v-else-if="props.id==='07'">
   <div class="case-controls"><button v-for="(name,i) in ['继续文章','提示摘要','提示问答']" :key="name" :aria-pressed="suffix===i" @click="suffix=i">{{name}}</button></div>
   <div class="document-strip"><article><small>相同文章</small><p>{{article}}</p></article><article class="prompt-piece"><small>追加的任务线索</small><pre>{{suffixes[suffix]||'（无）'}}</pre></article><article class="blank-piece"><small>下一个 token 的生成位置</small><strong>▌ 待模型续写</strong></article></div>
   <div class="flowline"><span>整段前缀 → 编码为编号</span>→<span>相同权重的语言模型</span>→<span>末尾词表分布</span></div><p>文章没有变，后缀让待续写部分的形式不同。没有额外摘要头，也没有在这个步骤提供摘要标签或执行微调。</p><div class="callout">本页故意不填入假模型生成的摘要。论文用 ROUGE 等评测检验 TL;DR 是否真正有效；点击下方原文结果比较有提示与无提示。</div>
  </template>
  <template v-else-if="props.id==='08'">
   <div class="case-controls"><label>示例数 {{shots}}<input v-model.number="shots" type="range" min="0" max="2" @input="resetGuess"/></label><button @click="swap=!swap;resetGuess()">交换 dax / wug 含义</button></div>
   <div class="document-strip"><article v-for="(e,i) in examples" :key="i"><small>示例 {{i+1}}</small><strong>{{e}}</strong></article><article class="blank-piece"><small>新问题</small><strong>这家店很棒 → ?</strong></article></div>
   <div class="case-controls"><button v-for="s in ['dax','wug','信息不足']" :key="s" :aria-pressed="guess===s" @click="guess=s;revealed=true">{{s}}</button></div>
   <p v-if="revealed">{{shots===0?'没有示例时，dax / wug 的约定没有被提供，无法唯一确定。':`按这套“正负情感映射”的教学规则，正面对应 ${positive}。${guess===positive?'你的选择符合约定。':'再检查示例中的标签映射。'}`}}</p>
   <div class="equation">提示 = {{examples.length}} 条示例 + 1 条问题<br/>模型权重：未改变；梯度更新次数：0</div><p>自然语言示例不唯一确定所有可能规则，这里限定为二类情感映射来帮助读者体验。不是用网页规则的正确率证明 GPT-3 的 few-shot 能力。</p>
  </template>
  <template v-else>
   <h3>先选部署取舍，再拆开其中一个算子</h3><div class="case-controls"><label>模型<select v-model.number="model"><option :value="0">GPT-3 175B</option><option :value="1">LLaMA 13B</option></select></label><label>原文任务<select v-model.number="metric"><option v-for="(m,i) in llama.metrics" :key="m.name" :value="i">{{m.name}}</option></select></label></div><div class="equation">{{llama.rows[model].name}} · {{llama.metrics[metric].name}} = {{llama.rows[model].values[metric]}} %<br/>{{model?'13B 参数':'175B 参数'}} ≠ 实测推理延迟</div>
   <h3>位置进入 Q/K：观察两个旋转指针</h3><div class="case-controls"><label>Q 位置 {{positionQ}}<input v-model.number="positionQ" type="range" min="0" max="10"/></label><label>K 位置 {{positionK}}<input v-model.number="positionK" type="range" min="0" max="10"/></label><label>共同平移 {{offset}}<input v-model.number="offset" type="range" min="0" max="10"/></label></div>
   <svg class="scene" viewBox="0 0 440 240" aria-label="Q 和 K 的一对分量绕原点旋转"><circle cx="220" cy="120" r="90" fill="#f8fafc" stroke="#cbd5e1"/><path d="M110 120H330 M220 10V230" stroke="#cbd5e1"/><line x1="220" y1="120" :x2="220+q[0]*90" :y2="120-q[1]*90" stroke="#2563eb" stroke-width="4"/><line x1="220" y1="120" :x2="220+k[0]*90" :y2="120-k[1]*90" stroke="#ea580c" stroke-width="4"/><text x="15" y="25" fill="#2563eb">Q</text><text x="15" y="48" fill="#ea580c">K</text></svg>
   <div class="equation">相对位置 = {{positionK-positionQ}}；旋转后点积 = {{dot.toFixed(6)}}<br/>R(m)q · R(n)k = qᵀ R(n−m) k</div><p>只改共同平移，两支指针一起转，点积保持不变。此处频率取 0.3 便于观察；真实 RoPE 有多对不同频率。归一化与门控 FFN 可在下方代码区继续拆解，但不能把整套模型成绩归因于这一个算子。</p>
  </template>
 </section>
</template>
<style scoped>
.document-strip{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.document-strip article{padding:20px;background:#f8fafc;border:1px solid #cbd5e1;flex:1;min-width:170px}.document-strip small{display:block;color:#64748b;margin-bottom:12px}.document-strip .prompt-piece{background:#dbeafe}.document-strip .blank-piece{border-style:dashed}.document-strip pre{white-space:pre-wrap;margin:0;background:transparent}
</style>
