<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toolsLesson } from '../../papers/tools'
const props=defineProps<{id:string}>()
const count=ref(3),price=ref(4),wrong=ref(false),show=ref(0),marked=ref(-1)
const subtotal=computed(()=>count.value*price.value+(wrong.value?1:0))
const steps=computed(()=>[`买 ${count.value} 件，每件 ${price.value} 元`,`小计 ${count.value} × ${price.value} = ${subtotal.value}`,`减优惠 2 元：${subtotal.value} − 2 = ${subtotal.value-2}`])
watch([count,price,wrong],()=>{marked.value=-1;show.value=0})
const history=ref<{role:string;text:string;source?:string}[]>([]),failed=ref(true),consumed=ref(false),foundExhibit=ref(false),foundAuthor=ref(false),finished=ref(false)
function act(action:string){if(finished.value)return;history.value.push({role:'行动',text:action});if(failed.value&&!consumed.value){consumed.value=true;history.value.push({role:'观察',text:'服务暂不可用：本次没有返回记录。'});return}if(action==='查询展品：玻璃之舟'){foundExhibit.value=true;history.value.push({role:'观察',text:'玻璃之舟的作者是林岚。',source:'本地档案 E-01'})}else if(action==='查询作者：林岚'){foundAuthor.value=true;history.value.push({role:'观察',text:'林岚出生于海岚市。',source:'本地档案 A-07'})}else history.value.push({role:'观察',text:'没有匹配记录。请根据已有证据重新选择查询。'})}
function reset(){history.value=[];consumed.value=false;foundExhibit.value=false;foundAuthor.value=false;finished.value=false}
function answer(){if(!foundExhibit.value||!foundAuthor.value)return;history.value.push({role:'答案',text:'海岚市。证据链：玻璃之舟 → 林岚 → 海岚市。',source:'E-01 + A-07'});finished.value=true}
const candidate=ref(0),threshold=ref(.2),benefit=ref(.35),pipeline=ref(0)
const tool=computed(()=>toolsLesson('22',{threshold:threshold.value,benefit:benefit.value}))
const rows=(id:string)=>tool.value.stages.find(s=>s.id===id)!.slices[0]
const names=['Calculator(3×7) → 21','Search(天气) → 晴','Search(单位换算) → 资料']
watch([candidate,threshold,benefit],()=>pipeline.value=0)
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='14'">
   <div class="case-controls"><label>数量 {{count}}<input v-model.number="count" type="range" min="1" max="8"/></label><label>单价 {{price}}<input v-model.number="price" type="range" min="2" max="9"/></label><label><input v-model="wrong" type="checkbox"/> 注入乘法错误</label><button :disabled="show===3" @click="show++">展开一步</button></div>
   <div class="tokens"><span v-for="i in count" :key="i">📦<small>{{price}} 元</small></span><span>优惠 −2 元</span></div><div class="cards"><article><strong>只给最终值</strong><p>{{subtotal-2}} 元</p><small>同一个脚本产生答案，不是不同模型。</small></article><article><strong>公开中间算式</strong><ol><li v-for="(s,i) in steps.slice(0,show)" :key="i">{{s}} <button @click="marked=i">首个错误在这里</button></li></ol><p v-if="show===0">点击「展开一步」检查。</p></article></div>
   <p v-if="marked>=0" role="status">{{!wrong?'本例没有注入错误，各步成立。':marked===1?'找到了：乘积应为 '+count*price+'。后续减法沿用了错误小计。':'再区分“这一步本身算错”与“沿用了之前错误的数”。'}}</p><p>核验正确答案 = {{count*price-2}}。详细步骤可帮助定位错误，却不保证步骤正确；原文的 CoT 提示效果需看真实模型实验。</p>
  </template>
  <template v-else-if="props.id==='21'">
   <p class="callout">任务：展品「玻璃之舟」作者的出生城市是什么？（全部名称与档案为虚构教学数据）</p><div class="case-controls"><label><input v-model="failed" type="checkbox" :disabled="history.length>0"/> 首次请求失败</label><button @click="reset">重新开始</button></div>
   <div class="case-controls"><button :disabled="finished" @click="act('查询展品：玻璃之舟')">查展品</button><button :disabled="finished" @click="act('查询作者：林岚')">查作者林岚</button><button :disabled="finished" @click="act('查询天气')">试一个无关查询</button><button :disabled="!foundExhibit||!foundAuthor||finished" @click="answer">用证据提交答案</button></div>
   <div class="transcript" aria-live="polite"><article v-for="(h,i) in history" :key="i" :class="{'observation':h.role==='观察'}"><strong>{{h.role}}</strong><p>{{h.text}}</p><small v-if="h.source">来源 {{h.source}}</small></article><p v-if="!history.length">先选择一次行动，观察真实的本地返回。</p></div><p>已有证据：展品作者 {{foundExhibit?'✓':'未查到'}}；作者出生地 {{foundAuthor?'✓':'未查到'}}。错误返回不会自动变成事实。</p><details><summary>对应 ReAct 的关键差异</summary><p>无外部反馈的推导容易沿错误假设继续；只有行动而不组织证据也可能盲目查询。这里由你选择行动，展示的是环境闭环，不是声称运行了 ReAct 语言模型。</p></details>
  </template>
  <template v-else>
   <p class="callout">训练文本片段：“3 个物品，每个 7 元，总价是 ___。”正确目标 token 的概率用于衡量调用价值。</p><div class="case-controls"><label>候选调用<select v-model.number="candidate"><option v-for="(name,i) in names" :key="i" :value="i">{{name}}</option></select></label><label>阈值 τ={{threshold}}<input v-model.number="threshold" type="range" min="0" max="1" step=".05"/></label><label>候选 0 概率改善<input v-model.number="benefit" type="range" min="0" max=".65" step=".05"/></label><button :disabled="pipeline===3" @click="pipeline++">推进加工步骤</button></div>
   <div class="flowline"><span :class="{selected:pipeline===0}">采样候选</span>→<span :class="{selected:pipeline===1}">取得返回值</span>→<span :class="{selected:pipeline===2}">比较后续损失</span>→<span :class="{selected:pipeline===3}">保留或丢弃</span></div>
   <p>候选：{{names[candidate]}} {{pipeline>=1?'（这里使用固定教学返回）':'（尚未查看返回）'}}</p><table v-if="pipeline>=2"><thead><tr><th>上下文</th><th>P(正确 token)</th><th>−log P</th></tr></thead><tbody><tr v-for="(name,i) in ['无调用','有调用但无返回','调用与返回均有']" :key="i"><td>{{name}}</td><td>{{rows('probability')[candidate][i].toFixed(4)}}</td><td>{{rows('loss')[candidate][i].toFixed(4)}}</td></tr></tbody></table><div v-if="pipeline===3" class="equation">收益 = min(L无调用,L空返回) − L有返回 = {{rows('filter')[candidate][0].toFixed(4)}}<br/>与阈值 {{threshold}} 比较 → {{rows('filter')[candidate][2]?'保留':'丢弃'}}</div><p>为什么保留两个基线？如果仅插入调用文本就同样有帮助，不能把改善都归给外部返回。实际论文对后续多个 token 加权；这里缩成一个目标 token。</p>
  </template>
 </section>
</template>
<style scoped>.transcript{display:grid;gap:10px}.transcript article{padding:14px;background:#f8fafc;border-left:3px solid #64748b}.transcript .observation{border-color:#2563eb;background:#eff6ff}.transcript small{color:#64748b}</style>
