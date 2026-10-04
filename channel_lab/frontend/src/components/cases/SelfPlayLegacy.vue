<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,integer,probability } from '../../papers/traceValidation'
import { ticWinner } from '../../papers/boardRules'
const schema=fields({checkpoints:list(fields({name:text,policy:list(probability,9,9),visits:list(integer,9,9)}),2,20),moves:list(integer,5,9),targets:list(list(probability,9,9),5,9)})
function parse(v:unknown){const d=schema(v);if(d.moves.length!==d.targets.length)throw Error('每步需要对应π');const b=Array(9).fill(0) as number[];for(let i=0;i<d.moves.length;i++){const m=d.moves[i];if(m>8||b[m]||ticWinner(b))throw Error('对局不合法或终局后继续落子');const pi=d.targets[i];if(Math.abs(pi.reduce((a,c)=>a+c,0)-1)>1e-4||pi.some((p,j)=>b[j]!==0&&p>1e-6))throw Error('π归一化或合法落点错误');b[m]=i%2+1}if(!ticWinner(b)&&b.includes(0))throw Error('对局未结束，不能回填z');for(const c of d.checkpoints)if(Math.abs(c.policy.reduce((a,b)=>a+b,0)-1)>1e-4||c.visits.reduce((a,b)=>a+b,0)===0)throw Error('检查点策略/访问统计错误');return d}
const data=shallowRef<ReturnType<typeof parse>|null>(null),step=ref(0),checkpoint=ref(0)
const board=computed(()=>{const b=Array(9).fill(0) as number[];data.value?.moves.slice(0,step.value).forEach((m,i)=>b[m]=i%2+1);return b})
const winner=computed(()=>{const b=Array(9).fill(0) as number[];data.value?.moves.forEach((m,i)=>b[m]=i%2+1);return ticWinner(b)})
const z=computed(()=>winner.value===0?0:winner.value===step.value%2+1?1:-1)
function accept(v:unknown){data.value=parse(v);step.value=0;checkpoint.value=0}
</script>
<template><section class="paper-lab"><h3>把一盘结束的自我对弈，拆回训练样本</h3><TraceLoader paper-id="03" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data"><label>落子前第 {{step+1}} 步<input v-model.number="step" type="range" min="0" :max="data.moves.length-1"></label><div class="cards"><article><div class="ttt"><span v-for="(s,i) in board" :key="i">{{s===1?'X':s===2?'O':''}}</span></div><p>当前方 {{step%2===0?'X':'O'}}；终局{{winner===0?'平局':winner===1?'X胜':'O胜'}}，回填 z={{z}}。</p></article><article><strong>此状态的搜索目标 π</strong><p v-for="(p,i) in data.targets[step]" :key="i">位置 {{i}}：{{p.toFixed(4)}}</p></article></div><h4>同一空棋盘，不同训练检查点的策略与搜索</h4><select v-model.number="checkpoint"><option v-for="(c,i) in data.checkpoints" :key="i" :value="i">{{c.name}}</option></select><table><thead><tr><th>空棋盘位置</th><th>网络策略</th><th>搜索访问次数</th></tr></thead><tbody><tr v-for="(p,i) in data.checkpoints[checkpoint].policy" :key="i"><td>{{i}}</td><td>{{p.toFixed(4)}}</td><td>{{data.checkpoints[checkpoint].visits[i]}}</td></tr></tbody></table></template><p class="note">井字棋是明确标注的替代实验；此处只校验和回放，不执行训练。检查点比较固定为空棋盘，不能把它当成当前回放局面的网络输出。记录应说明 π 来源与搜索温度。</p></section></template>
<style scoped>.ttt{display:grid;grid-template-columns:repeat(3,55px);width:165px}.ttt span{height:55px;border:1px solid #64748b;display:grid;place-items:center;font-size:28px}</style>
