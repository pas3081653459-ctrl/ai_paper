<script setup lang="ts">
import { computed, ref } from 'vue'
import { multimodal } from '../../papers/multimodal'
import { attention, embedding, mm, weights, softmax } from '../../papers/math'
const props=defineProps<{id:string}>()
const swap=ref(0),temperature=ref(.2),image=ref(0),classification=ref(false)
const clip=computed(()=>multimodal('12',{swap:swap.value,temperature:temperature.value}))
const clipStage=(id:string)=>clip.value.stages.find(s=>s.id===id)!.slices
const labels=computed(()=>swap.value?['一只狗','一只猫','一辆自行车']:['一只猫','一只狗','一辆自行车'])
const phase=ref(0),variation=ref(0),patch=ref(0)
const llava=computed(()=>multimodal('19',{phase:phase.value,visual:variation.value}))
const llavaStage=(id:string)=>llava.value.stages.find(s=>s.id===id)!.slices[0]
const feature=ref(0),token=ref(0),dimension=ref(0),angle=ref(-12)
const moe=computed(()=>multimodal('23',{feature:feature.value}))
const moeStage=(id:string)=>moe.value.stages.find(s=>s.id===id)!.slices
const chosen=computed(()=>moeStage('chosen')[0][token.value])
const gates=computed(()=>moeStage('gate')[0][token.value])
const load=computed(()=>Array.from({length:8},(_,e)=>moeStage('chosen')[0].filter(row=>row.includes(e)).length))
const masked=ref([2,4,6]),position=ref(2),ar=ref(false),arStep=ref(2)
const targets=[1,2,3,4,5,6,7,8],names=['文本条件','图像条件','文本词2','文本词3','图像码4','图像码5','图像码6','图像码7']
const maskedIds=computed(()=>targets.map((v,i)=>masked.value.includes(i)?9:v))
const reconstruction=computed(()=>mm(attention(embedding(maskedIds.value)).out,weights(4,10,10)).map(softmax))
const nll=computed(()=>targets.map((v,i)=>masked.value.includes(i)?-Math.log(reconstruction.value[i][v]):0))
function toggle(i:number){position.value=i;if(i<2)return;masked.value=masked.value.includes(i)?masked.value.filter(j=>j!==i):[...masked.value,i]}
const f=(n:number)=>n.toFixed(4)
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='12'">
   <div class="case-controls"><button @click="swap=1-swap">交换前两张文字卡</button><label>温度 {{temperature.toFixed(2)}}<input v-model.number="temperature" type="range" min=".05" max="1" step=".05"/></label><button :aria-pressed="classification" @click="classification=!classification">{{classification?'当前：文字作为候选类别':'当前：批内训练配对'}}</button></div>
   <div class="clip-pairs"><div class="cards"><button v-for="(icon,i) in ['🐈','🐕','🚲']" :key="i" :aria-pressed="image===i" @click="image=i"><span class="icon">{{icon}}</span>图 {{i}}</button></div><div class="cards"><article v-for="(label,i) in labels" :key="i"><strong>{{label}}</strong><span>{{classification?'候选类别描述':`固定监督目标：图 ${i} 应配本列`}}</span></article></div></div>
   <table><thead><tr><th>图 {{image}} 与文本</th><th>余弦相似度</th><th>softmax 概率</th></tr></thead><tbody><tr v-for="(label,i) in labels" :key="i"><td>{{label}}</td><td>{{f(clipStage('scores')[0][image][i])}}</td><td><div class="bar" :style="{width:`${clipStage('probabilities')[0][image][i]*100}%`}"/>{{f(clipStage('probabilities')[0][image][i])}}</td></tr></tbody></table>
   <div class="equation" v-if="!classification">图找文 CE + 文找图 CE，取均值 = {{clip.metrics[0].value}}</div><p>{{classification?'此时每个文字描述是候选类别，顺序变化只重排候选；没有“第 i 张图必须配第 i 类”的训练标签。':'故意交换文字而不改对角标签，会制造错误监督。损失上升解释的是配对错误，不是模型突然不会识别。'}}</p><p>图标只标识三组手工四维特征；更换文字卡同时更换它对应的向量。没有真实图像编码或任意文字编码。</p>
  </template>
  <template v-else-if="props.id==='19'">
   <div class="case-controls"><button :aria-pressed="phase===0" @click="phase=0">阶段一：特征对齐</button><button :aria-pressed="phase===1" @click="phase=1">阶段二：指令微调</button><label>改变首块特征<input v-model.number="variation" type="range" min="0" max="2" step="1"/></label></div>
   <div class="flowline"><span class="frozen">视觉编码器 🔒</span>→<span class="trainable">线性投影 W · 可更新</span>→<span :class="phase?'trainable':'frozen'">语言模型 {{phase?'可更新':'🔒'}}</span>→<span>文本响应</span></div>
   <div class="spatial scroll"><div class="planes"><div v-for="(_,i) in llavaStage('vision')" :key="i" class="plane"><button :aria-pressed="patch===i" @click="patch=i">视觉块 {{i}}</button><p>{{llavaStage('vision')[i].map(f).join(' · ')}}</p></div></div></div>
   <div class="equation">视觉块 {{patch}}：[{{llavaStage('vision')[patch].map(f).join(', ')}}] ∈ R³<br/>× W [3,4]<br/>语言空间：[{{llavaStage('projection')[patch].map(f).join(', ')}}] ∈ R⁴</div>
   <div class="tokens"><span v-for="i in 7" :key="i" :class="{condition:i<=4}">{{i<=4?`视觉 ${i-1}`:`指令 ${i-5}`}}<small>4 维</small></span></div><p>长度 4+3=7，拼接的是序列轴。视觉块不需要先变成汉字；投影只是把维度与表示接到语言模型接口。阶段切换只改变可训练范围，输出数值不会自动“变聪明”。</p>
  </template>
  <template v-else-if="props.id==='23'">
   <div class="case-controls"><label>追踪 token<select v-model.number="token"><option v-for="i in 3" :key="i" :value="i-1">{{i-1}}</option></select></label><label>token 0 特征偏移 {{feature}}<input v-model.number="feature" type="range" min="-4" max="4" step=".25"/></label><label>空间视角<input v-model.number="angle" type="range" min="-25" max="25"/></label></div>
   <div class="spatial"><svg class="scene expert-scene" :style="{transform:`rotateY(${angle}deg)`}" viewBox="0 0 760 300" aria-label="当前 token 只进入两个专家，再汇合"><text x="15" y="150">token {{token}}</text><text x="675" y="150">加权和</text><g v-for="e in 8" :key="e"><path v-if="chosen.includes(e-1)" :d="`M85 145 L310 ${20+(e-1)*37} L650 145`" fill="none" stroke="#2563eb" :stroke-width="1+5*gates[e-1]"/><rect x="310" :y="3+(e-1)*37" width="125" height="29" rx="5" :fill="chosen.includes(e-1)?'#bfdbfe':'#f1f5f9'"/><text x="322" :y="23+(e-1)*37">E{{e-1}} · {{gates[e-1].toFixed(3)}}</text></g></svg></div>
   <label>检查输出维度<select v-model.number="dimension"><option v-for="i in 4" :key="i" :value="i-1">D{{i-1}}</option></select></label><div class="equation">{{f(gates[chosen[0]])}} × {{f(moeStage('experts')[0][token][dimension])}} + {{f(gates[chosen[1]])}} × {{f(moeStage('experts')[1][token][dimension])}} = {{f(moeStage('merge')[0][token][dimension])}}<br/>[1,3,4] → 两路 FFN → [1,3,4]，不是拼接成 8 维</div>
   <h3>同一批三个 token，各专家接到几次？</h3><div class="tokens"><span v-for="(n,e) in load" :key="e">E{{e}}<strong>{{n}}</strong></span></div><p>总计六次专家调用，仍须存储八套权重。本页仅执行被选中的小型 FFN；线条和调用计数不是硬件加速测试。</p>
  </template>
  <template v-else>
   <div class="case-controls"><button :aria-pressed="!ar" @click="ar=false">响应掩码训练</button><button :aria-pressed="ar" @click="ar=true">对照自回归顺序</button><button @click="masked=[2,3,4,5,6,7]">遮住全部响应</button><button @click="masked=[2,4,6]">恢复示例</button></div>
   <div v-if="!ar" class="tokens"><button v-for="(name,i) in names" :key="i" :class="{condition:i<2,masked:masked.includes(i)}" :aria-pressed="masked.includes(i)" :disabled="i<2" @click="toggle(i)">{{i<2?name:masked.includes(i)?'[MASK]':name}}</button></div>
   <template v-else><label>已追加 {{arStep}} 个响应 token<input v-model.number="arStep" type="range" min="0" max="6"/></label><div class="tokens"><span v-for="(name,i) in names" :key="i" :class="{condition:i<2,masked:i>=arStep+2}">{{i<arStep+2?name:'尚未生成'}}</span></div></template>
   <p>{{ar?'此处只对照生成位置顺序，不实际生成 token。自回归从已有前缀预测下一个位置。':'掩码可以散落在响应内部；条件始终可见。点击位置改变输入，固定小网络重新计算所有位置的分布。'}}</p>
   <table v-if="!ar"><thead><tr><th>响应位置</th><th>正确 token 概率</th><th>是否计损失</th><th>NLL</th></tr></thead><tbody><tr v-for="i in 6" :key="i" :class="{selected:position===i+1}"><td>{{names[i+1]}}</td><td>{{f(reconstruction[i+1][targets[i+1]])}}</td><td>{{masked.includes(i+1)?'是':'否'}}</td><td>{{f(nll[i+1])}}</td></tr></tbody></table>
   <div class="equation" v-if="!ar">本页所选位置平均 NLL = {{masked.length?(nll.reduce((a,b)=>a+b,0)/masked.length).toFixed(4):'没有掩码，未定义'}}<br/>这是手选 mask 的平均值，不代替论文完整随机 t 加权目标。</div><p>下一步应检查多阶段训练的实验：统一输入形式、长 CoT 数据与 UniGRPO 的作用不能只由掩码图说明。</p>
  </template>
 </section>
</template>
<style scoped>.icon{font-size:42px;display:block}.expert-scene{transform-style:preserve-3d}.clip-pairs .cards button{flex:1;min-width:90px}</style>
