<script setup lang="ts">
import { computed, ref } from 'vue'
import { learning } from '../../papers/learning'
const props=defineProps<{id:string}>()
const visits=ref(1),mix=ref(.5),chosen=ref(0),step=ref(0)
const lab=computed(()=>learning('02',{visits:visits.value,mix:mix.value,explore:1}))
const stats=computed(()=>lab.value.stages.find(s=>s.id==='search')!.slices[0])
const history=computed(()=>lab.value.stages.find(s=>s.id==='trajectory')!.slices[0])
const points=[[2,2],[4,1],[3,4]],stones=[[1,2,0],[2,1,0],[3,1,1],[1,3,1],[4,3,0]]
// 合法的 X 获胜教学对局；π 是手工构造的搜索访问记录，不声称来自网络。
const moves=[0,3,1,4,2]
const board=computed(()=>Array.from({length:9},(_,i)=>{const n=moves.slice(0,step.value).indexOf(i);return n<0?'':n%2?'O':'X'}))
const turn=computed(()=>step.value%2?'O':'X')
const counts=computed(()=>Array.from({length:9},(_,i)=>board.value[i]?0:i===moves[step.value]?12:2))
const total=computed(()=>counts.value.reduce<number>((a,b)=>a+b,0))
const reveal=ref(false)
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='02'">
   <div class="case-controls"><label>网络价值占比 λ = {{mix.toFixed(1)}}<input v-model.number="mix" type="range" min="0" max="1" step=".1"/></label><button :disabled="visits===1" @click="visits--">回退一次</button><button :disabled="visits===80" @click="visits++">模拟一次</button><button @click="visits=40">查看 40 次后</button><button @click="visits=1">重置</button></div>
   <div class="search-layout"><svg viewBox="0 0 300 300" class="scene" aria-label="围棋候选点示意，不计算围棋规则"><rect x="15" y="15" width="270" height="270" fill="#eed6aa"/><g v-for="i in 7" :key="i"><path :d="`M 30 ${30+(i-1)*40} H270 M ${30+(i-1)*40} 30 V270`" stroke="#93764a"/></g><circle v-for="(s,i) in stones" :key="i" :cx="30+s[0]*40" :cy="30+s[1]*40" r="15" :fill="s[2]?'white':'#1e293b'" stroke="#64748b"/><g v-for="(p,i) in points" :key="i"><circle :cx="30+p[0]*40" :cy="30+p[1]*40" r="17" :fill="chosen===i?'#2563eb':'#bfdbfe'"/><text :x="30+p[0]*40" :y="35+p[1]*40" text-anchor="middle" :fill="chosen===i?'white':'#1e293b'">{{['A','B','C'][i]}}</text></g></svg>
   <div><h3>先验 A/B/C = 0.6 / 0.3 / 0.1</h3><div class="case-controls"><button v-for="i in 3" :key="i" :aria-pressed="chosen===i-1" @click="chosen=i-1">观察 {{['A','B','C'][i-1]}}</button></div><p>该叶子的两种意见：网络 {{[.15,.5,.8][chosen]}}，rollout {{[.7,.2,-.1][chosen]}}。</p><div class="equation">混合评价 = λ v + (1−λ) z = {{(mix*[.15,.5,.8][chosen]+(1-mix)*[.7,.2,-.1][chosen]).toFixed(3)}}</div></div></div>
   <svg class="scene" viewBox="0 0 720 190" aria-label="根节点及三个候选行动的访问统计"><circle cx="360" cy="25" r="20" fill="#1e293b"/><g v-for="(s,i) in stats" :key="i"><path :d="`M360 45 L${120+i*240} 105`" stroke="#93c5fd" :stroke-width="2+12*s[1]/visits"/><rect :x="30+i*240" y="105" width="180" height="75" rx="8" :fill="chosen===i?'#dbeafe':'#f1f5f9'"/><text :x="120+i*240" y="132" text-anchor="middle">{{['A','B','C'][i]}} · N={{s[1]}}</text><text :x="120+i*240" y="156" text-anchor="middle">Q={{s[2].toFixed(2)}} U={{s[3].toFixed(2)}}</text></g></svg>
   <p>下一次选择比较 Q+U，不仅看先验。线宽表示访问比例，不表示获胜概率。</p><div class="scroll"><table><thead><tr><th>最近模拟</th><th>选择</th><th>回传值</th><th>访问 A/B/C</th></tr></thead><tbody><tr v-for="h in history" :key="h[0]"><td>{{h[0]}}</td><td>{{['A','B','C'][h[1]]}}</td><td>{{h[2].toFixed(3)}}</td><td>{{h.slice(3).join(' / ')}}</td></tr></tbody></table></div>
  </template>
  <template v-else>
   <div class="case-controls"><button :disabled="step===0" @click="step--">上一手</button><button :disabled="step===5" @click="step++">落下一手</button><button @click="reveal=!reveal">{{reveal?'隐藏终局标签':'把终局结果回填'}}</button><button @click="step=0;reveal=false">重放</button></div>
   <div class="search-layout"><div class="tic-board"><div v-for="(v,i) in board" :key="i" :class="{next:i===moves[step]}">{{v||i}}</div></div><div><h3>{{step===5?'终局：X 获胜':`落子前 s${step}：轮到 ${turn}`}}</h3><p v-if="step<5">高亮格是记录中的下一手。π 来自该局面的访问分布，不是把最终胜者当成每一步的行动标签。</p><div v-if="step<5" class="equation">π = [{{counts.map(n=>(n/total).toFixed(2)).join(', ')}}]<br/>已占用格的访问数为 0</div><p v-if="reveal&&step<5">当前行动者视角的 z = {{turn==='X'?'+1':'−1'}}；同一盘棋的不同样本，符号会交替。</p></div></div>
   <div class="flowline"><span>局面 s → 网络 p,v</span>→<span>搜索访问 → π</span>→<span>自我对弈 → 终局</span>→<span>(s,π,z) → 下一轮训练</span></div>
   <table><thead><tr><th>样本时刻</th><th>行动者</th><th>策略监督</th><th>价值监督 z</th></tr></thead><tbody><tr v-for="(_,i) in moves" :key="i" :class="{selected:i===step}"><td>s{{i}}</td><td>{{i%2?'O':'X'}}</td><td>该时刻 π，而非 one-hot 胜者</td><td>{{reveal?(i%2?'−1':'+1'):'等待终局'}}</td></tr></tbody></table>
   <p>这里使用井字棋是为了完整看清一个回合。它没有人工高手标签；但本页对局是作者构造的教学记录，不是已经训练出的自我对弈结果。</p>
  </template>
 </section>
</template>
<style scoped>
.search-layout{display:grid;grid-template-columns:minmax(200px,320px) 1fr;gap:25px;align-items:center}.tic-board{display:grid;grid-template-columns:repeat(3,1fr);aspect-ratio:1;background:#cbd5e1;gap:3px}.tic-board div{display:grid;place-items:center;background:white;font-size:30px}.tic-board .next{background:#dbeafe}@media(max-width:650px){.search-layout{grid-template-columns:1fr}}
</style>
