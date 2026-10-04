<script setup lang="ts">
import { computed, ref } from 'vue'
import { learning } from '../../papers/learning'
import { softmax } from '../../papers/math'
const props=defineProps<{id:string}>()
const preferred=ref(0),shift=ref(0),beta=ref(.5),phase=ref(0)
const lab=computed(()=>learning('13',{preferred:preferred.value,shift:shift.value,beta:beta.value}))
const data=(id:string)=>lab.value.stages.find(s=>s.id===id)!.slices[0]
const allCorrect=ref(false),route=ref('zero'),stage=ref(0),change=ref(0)
const answers=computed(()=>allCorrect.value?[45,45,45,45]:[45,46,45,44])
const rewards=computed(()=>answers.value.map(v=>v===17+28?1:0))
const mean=computed(()=>rewards.value.reduce<number>((a,b)=>a+b,0)/4)
const std=computed(()=>Math.sqrt(rewards.value.reduce<number>((s,r)=>s+(r-mean.value)**2,0)/4))
const advantages=computed(()=>rewards.value.map(r=>std.value?(r-mean.value)/std.value:0))
const ratios=computed(()=>softmax([change.value,0,0,0]).map(v=>v/.25))
const routes={zero:['基础模型','直接强化学习','观察推理表现与可读性问题'],r1:['少量冷启动数据','推理强化学习','拒绝采样与监督微调','面向更多任务的强化学习']}
const routeSteps=computed(()=>route.value==='zero'?routes.zero:routes.r1)
function switchRoute(value:string){route.value=value;stage.value=0}
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='13'">
   <div class="case-controls"><button v-for="(name,i) in ['写示范','排列偏好','策略与参考']" :key="i" :aria-pressed="phase===i" @click="phase=i">{{name}}</button></div>
   <p class="callout">用户请求：用一句话解释“残差连接”。</p>
   <div v-if="phase===0"><h3>人工示范是要学习的文本</h3><div class="equation">示范：“把输入绕过若干层，与主分支的输出相加。”<br/>SFT：对示范 token 计算交叉熵，更新策略。</div><p>此阶段不需要比较两条回答；它提供的是“应该怎么回答”的具体样本。</p></div>
   <div v-else-if="phase===1"><div class="cards"><article><strong>A · 回答请求</strong><p>把输入与主分支输出逐元素相加，传给下一层。</p><button :aria-pressed="preferred===0" @click="preferred=0">更喜欢 A</button></article><article><strong>B · 偏离请求</strong><p>深度学习非常重要，计算机也很重要。</p><button :aria-pressed="preferred===1" @click="preferred=1">更喜欢 B</button></article></div><div class="equation">固定奖励模型：r(A)=0.7，r(B)=−0.2<br/>你选 {{preferred?'B':'A'}} 为 chosen<br/>−log σ(r_chosen−r_rejected) = {{lab.metrics[0].value}}</div><p>切换偏好改变排序损失，却没有自动修改奖励分数。这正是“给监督信号”与“执行训练”的区别。</p></div>
   <div v-else><div class="case-controls"><label>策略偏移 δ={{shift}}<input v-model.number="shift" type="range" min="-2" max="2" step=".2"/></label><label>KL 系数 β={{beta}}<input v-model.number="beta" type="range" min="0" max="2" step=".1"/></label></div><table><thead><tr><th>回答</th><th>参考策略</th><th>当前策略</th><th>奖励</th></tr></thead><tbody><tr v-for="i in 2" :key="i"><td>{{i===1?'A':'B'}}</td><td>0.5</td><td>{{data('policy')[0][i-1].toFixed(4)}}</td><td>{{i===1?.7:-.2}}</td></tr></tbody></table><div class="equation">E[r] {{data('objective')[0][0].toFixed(4)}} − βKL {{data('objective')[0][2].toFixed(4)}} = {{data('objective')[0][3].toFixed(4)}}</div><p>提高 β 只改变当前目标的代价，网页没有运行 PPO，概率不会自己退回参考分布。奖励模型偏好也不等于独立人类评价。</p></div>
   <div class="flowline"><span>示范 → SFT 策略</span>→<span>比较 → 奖励模型</span>→<span>奖励 + 参考约束 → 策略优化</span></div>
  </template>
  <template v-else>
   <p class="callout">同一道题：17 + 28 = ?　这里使用能直接检验的答案奖励。</p><div class="case-controls"><label><input v-model="allCorrect" type="checkbox"/> 四份答案全部正确</label><label>第一候选策略偏移 {{change}}<input v-model.number="change" type="range" min="-2" max="2" step=".2"/></label></div>
   <div class="cards"><article v-for="(answer,i) in answers" :key="i"><strong>候选 {{i+1}}：{{answer}}</strong><span>{{rewards[i]?'校验通过':'校验失败'}} → 奖励 {{rewards[i]}}</span><p :class="advantages[i]>=0?'good':'bad'">优势 {{advantages[i].toFixed(3)}}</p></article></div>
   <div class="equation">组均值 μ={{mean.toFixed(3)}}，标准差 σ={{std.toFixed(3)}}<br/>Aᵢ = (rᵢ−μ)/σ；σ=0 时本页定义 A=0</div><table><thead><tr><th>候选</th><th>新/旧概率比 ρ</th><th>ρA</th><th>裁剪 surrogate</th></tr></thead><tbody><tr v-for="(a,i) in advantages" :key="i"><td>{{i+1}}</td><td>{{ratios[i].toFixed(3)}}</td><td>{{(ratios[i]*a).toFixed(3)}}</td><td>{{Math.min(ratios[i]*a,Math.max(.8,Math.min(1.2,ratios[i]))*a).toFixed(3)}}</td></tr></tbody></table><p>全部答对时没有组内相对优劣，不等于答案没有价值。此处把完整回答当作四个离散行动，省略序列逐 token 与 KL 项。</p>
   <h3>不要把 R1-Zero 和 R1 混成一条路线</h3><div class="case-controls"><button :aria-pressed="route==='zero'" @click="switchRoute('zero')">R1-Zero</button><button :aria-pressed="route==='r1'" @click="switchRoute('r1')">R1</button></div><div class="tokens"><button v-for="(name,i) in routeSteps" :key="i" :aria-pressed="stage===i" @click="stage=i">{{i+1}} · {{name}}</button></div><p>{{route==='zero'?'直接强化学习用于检验不依赖冷启动示范能否出现推理表现；论文也报告其可读性等问题。':'R1 使用冷启动与多阶段训练，不能把最终成绩直接归给一个 GRPO 公式。'}}当前定位：{{routeSteps[stage]}}。</p>
  </template>
 </section>
</template>
