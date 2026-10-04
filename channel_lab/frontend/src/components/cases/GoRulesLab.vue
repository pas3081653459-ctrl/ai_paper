<script setup lang="ts">
import {computed,ref} from 'vue'
import GoBoard from './GoBoard.vue'
import {goMove} from '../../papers/boardRules'
import {goCoordinate} from '../../papers/searchTraces'
const kind=ref(0),error=ref(''),states=ref<number[][]>([]),moves=ref<(number|null)[]>([])
function reset(i=kind.value){kind.value=i;const b=Array<number>(81).fill(0);for(const p of [31,39,49])b[p]=1;b[40]=2;if(i===1)for(const p of [32,42,50])b[p]=2;states.value=[b];moves.value=[];error.value=''}
reset()
const board=computed(()=>states.value[states.value.length-1]),player=computed(()=>moves.value.length%2+1)
const captured=computed(()=>{if(states.value.length<2)return 0;const prev=states.value[states.value.length-2];return prev.filter((s,i)=>s!==0&&board.value[i]===0).length})
function play(m:number|null){try{if(moves.value.length>=12)throw Error('此局部练习最多12手，请撤销或复原');const b=goMove(board.value,9,m,player.value,states.value);states.value.push(b);moves.value.push(m);error.value=''}catch(e){error.value=String(e)}}
function undo(){if(moves.value.length){states.value.pop();moves.value.pop();error.value=''}}
</script>
<template><section><h4>先让一个分支真的改变棋盘</h4><div class="controls"><button :aria-pressed="kind===0" @click="reset(0)">最后一口气</button><button :aria-pressed="kind===1" @click="reset(1)">劫争：不能立即提回</button><button @click="reset()">复原</button><button :disabled="!moves.length" @click="undo">撤销一手</button><button @click="play(null)">PASS</button></div><p>{{kind===0?'黑先：白棋 E5 的最后一口气在哪里？点击棋盘尝试提子。':'黑先在 F5 提子，再让白在 E5 提回；观察为什么规则拒绝这个分支。'}}</p><GoBoard :board="board" :size="9" :mark="moves.length?moves[moves.length-1]:undefined" @choose="play"/><p>轮到{{player===1?'黑':'白'}}；上手提走 {{captured}} 子。{{moves.map(m=>goCoordinate(m,9)).join(' → ')}}</p><p v-if="error" role="alert">{{error}}</p><p class="note">这是本站构造的局部规则题，不是职业棋谱或 AlphaGo 输出。只检查落子、提子、自杀和位置超级劫；PASS不作重复局面禁着，不实现终局计分。提一子不能证明整盘更容易获胜。</p></section></template>
