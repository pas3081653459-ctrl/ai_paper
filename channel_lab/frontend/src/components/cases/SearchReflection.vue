<script setup lang="ts">
import {computed} from 'vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import {useEvidenceNotebook} from '../../papers/evidenceNotebook'
const props=defineProps<{paperId:string}>()
const questions:Record<string,{id:string;title:string;options:string[];correct:string;explanation:string}[]>={
 '02':[{id:'prior',title:'策略先验最高的落点，必然是搜索后访问最多的吗？',options:['不一定','必然'],correct:'不一定',explanation:'先验影响搜索资源分配，后续估值与回传会改变访问分布；要看同一局面的真实搜索记录。'},{id:'sign',title:'子节点的 to_play 价值很高，对父节点行动方一定有利吗？',options:['不是，要反号','是'],correct:'不是，要反号',explanation:'子节点轮到对手；在零和价值约定下换方反号。若记录按黑方视角，则根据父行动方转换，不能再盲目反号。'},{id:'capture',title:'提了一颗棋子，能证明整盘会赢吗？',options:['不能','能'],correct:'不能',explanation:'局部提子是规则结果，最终结果还涉及后续应手、全局局势和计分。规则题没有网络胜率。'}],
 '03':[{id:'target',title:'用于训练策略头的 π 来自哪里？',options:['搜索访问统计','直接复制网络 p'],correct:'搜索访问统计',explanation:'按约定温度对实际访问数归一化；p 是搜索前网络输出，π 是搜索后的监督目标。'},{id:'unfinished',title:'对局还未结束时，可以先把 z 填成0吗？',options:['不可以','可以'],correct:'不可以',explanation:'0代表已确定的平局，不代表未知。终局后还要按照每个样本当前行动方转换符号。'},{id:'training',title:'产生了 (s,π,z)，是否意味着网络已经变强？',options:['不是','是'],correct:'不是',explanation:'还没有执行训练更新。真实成长需要检查点和固定对手、固定协议的评估；原论文的跨棋类结果不能由井字棋示范替代。'}]
}
const {book,saved,answer,check,reset,download}=useEvidenceNotebook(props.paperId)
const items=computed(()=>questions[props.paperId]??[]),completed=computed(()=>items.value.filter(q=>book.checked[q.id]).length)
</script>
<template><EvidenceQuestion v-for="q in items" :key="q.id" v-bind="q" :value="book.answers[q.id]" :checked="book.checked[q.id]" @answer="answer(q.id,$event)" @check="check(q.id)"/><EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="items.length" @notes="book.notes=$event" @reset="reset" @download="download({category:'搜索与学习闭环'})"/></template>
