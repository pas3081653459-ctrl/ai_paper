<script setup lang="ts">
import {computed,ref,shallowRef,watch} from 'vue'
import {ticWinner} from '../../papers/boardRules'
import {searchTic,downloadSearch} from '../../papers/ticSearch'
import {policyFromVisits} from '../../papers/searchTraces'
const budget=ref(128),seed=ref(7),temperature=ref(1),error=ref(''),step=ref(0)
const entries=ref<{board:number[];player:number;move:number;visits:number[];pi:number[];temperature:number;seed:number;budget:number}[]>([])
const board=ref(Array<number>(9).fill(0)),pending=shallowRef<ReturnType<typeof searchTic>|null>(null)
const player=computed(()=>entries.value.length%2+1),winner=computed(()=>ticWinner(board.value)),ended=computed(()=>winner.value!==0||!board.value.includes(0))
const pi=computed(()=>pending.value?policyFromVisits(pending.value.visits,temperature.value):Array<number>(9).fill(0))
const sample=computed(()=>entries.value[step.value])
function reset(){board.value=Array<number>(9).fill(0);entries.value=[];pending.value=null;step.value=0;error.value=''}
function search(){try{pending.value=searchTic(board.value,player.value,budget.value,seed.value+entries.value.length);error.value=''}catch(e){error.value=String(e);pending.value=null}}
function play(m:number){if(!pending.value||ended.value||board.value[m]||pi.value[m]===0)return
 entries.value.push({board:[...board.value],player:player.value,move:m,visits:[...pending.value.visits],pi:[...pi.value],temperature:temperature.value,seed:seed.value+entries.value.length,budget:budget.value})
 board.value[m]=entries.value[entries.value.length-1].player;pending.value=null;step.value=entries.value.length-1
}
function finish(){try{while(!ended.value){search();if(!pending.value)break;const max=Math.max(...pending.value.visits);play(pending.value.visits.indexOf(max))}}catch(e){error.value=String(e)}}
function exportSamples(){if(!ended.value)return;downloadSearch({kind:'rule-search-samples-v1',paper_id:'03',source:'browser-UCT-uniform-rollouts-no-network-no-training',version:'ticSearch-v1',created_at:new Date().toISOString(),selection:'reader selection or visit-argmax; ties use lowest index',samples:entries.value.map(s=>({...s,z:winner.value===0?0:winner.value===s.player?1:-1}))},'tic-rule-search-samples.json')}
function settingsChanged(){pending.value=null;error.value=''}
watch([budget,seed],settingsChanged,{flush:'sync'})
</script>
<template><section><h4>亲手走完一盘，训练标签才完整</h4><p>这是浏览器实际执行的井字棋 UCT＋均匀随机 rollout，没有神经网络、没有参数更新。用它理解访问数与终局标签；真实训练检查点在下方另行导入。</p><div class="controls"><label>每手模拟次数<select v-model.number="budget" @change="settingsChanged"><option :value="32">32</option><option :value="128">128</option><option :value="512">512</option></select></label><label>seed<input v-model.number="seed" type="number" min="0" max="99999990" @change="settingsChanged"></label><label>π 温度 τ<input v-model.number="temperature" type="range" min="0.1" max="2" step="0.1"></label><button @click="reset">新的一盘</button></div><p>τ={{temperature}}；π(a)=N(a)^(1/τ) / Σ N^(1/τ)。改变τ只重算当前访问数分布，不重新搜索。下一手可手动选π非零的位置，或按访问最多自动走完。</p><div class="cards"><article><div class="tic-grid"><button v-for="(s,i) in board" :key="i" :disabled="!!s||!pending||pi[i]===0||ended" :aria-label="`落点${i}`" @click="play(i)">{{s===1?'X':s===2?'O':i}}</button></div><p>{{ended?(winner===0?'平局':winner===1?'X 获胜':'O 获胜'):`轮到 ${player===1?'X':'O'}`}}</p><button :disabled="ended" @click="search">只搜索当前一手</button> <button :disabled="ended" @click="finish">按访问最多走完</button></article><article><p v-if="!pending">搜索后展示真实模拟计数，不预填概率。</p><template v-else><table><thead><tr><th>落点</th><th>N</th><th>π</th></tr></thead><tbody><tr v-for="(n,i) in pending.visits" :key="i"><td>{{i}}</td><td>{{n}}</td><td>{{pi[i].toFixed(4)}}</td></tr></tbody></table><p>完成 {{pending.visits.reduce((a,b)=>a+b,0)}} 次模拟；当前方 rollout 平均回报 {{pending.value.toFixed(4)}}。这是规则模拟值，不是网络 v。</p></template></article></div><p v-if="error" role="alert">{{error}}</p>
<template v-if="sample"><label>抽取落子前样本 {{step+1}}<input v-model.number="step" type="range" min="0" :max="entries.length-1"></label><div class="cards"><article><div class="tic-grid"><span v-for="(s,i) in sample.board" :key="i">{{s===1?'X':s===2?'O':i}}</span></div><p>s：落子前局面，当前方 {{sample.player===1?'X':'O'}}</p></article><article><p>π：{{sample.pi.map(p=>p.toFixed(3)).join(' · ')}}</p><p v-if="ended">z = {{winner===0?0:winner===sample.player?1:-1}}；同一终局，换到对手视角就反号。</p><p v-else>z 尚未确定。不能把尚未结束的对局当作平局标签0。</p><p>实际落子 {{sample.move}}；预算 {{sample.budget}}，seed {{sample.seed}}，τ={{sample.temperature}}。</p></article></div><button :disabled="!ended" @click="exportSamples">导出 (s,π,z) 规则搜索样本</button></template><p class="note">这里导出的 kind 与真实训练档案不同，不能导入为“已训练检查点”。UCT 使用 Q+√(2 ln N父/N子)，不是 AlphaZero 的网络先验 PUCT；有限预算可能走坏棋，保留失败。页面不会调用训练。</p></section></template>
<style scoped>.tic-grid{display:grid;grid-template-columns:repeat(3,64px);width:192px}.tic-grid button,.tic-grid span{height:64px;display:grid;place-items:center;border:1px solid #94a3b8;font-size:24px}</style>
