<script setup lang="ts">
import {computed} from 'vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import {useEvidenceNotebook} from '../../papers/evidenceNotebook'
const props=defineProps<{paperId:string}>()
const questions:Record<string,{id:string;title:string;options:string[];correct:string;explanation:string}[]>={
 '13':[{id:'reward',title:'奖励分数更高，是否足以证明回答更真实？',options:['不能','能'],correct:'不能',explanation:'奖励是偏好代理，需要独立评价事实与指令遵循，不能用奖励模型给自己的优化背书。'},{id:'blind',title:'已经揭示过来源后重新排序，算独立盲评吗？',options:['不算','算'],correct:'不算',explanation:'本页会标为已知来源复评；多轮也不等于多位评审者。'}],
 '14':[{id:'final',title:'最终答案正确，公开步骤就一定正确吗？',options:['不一定','一定'],correct:'不一定',explanation:'手写反例的最终数字正确但算式错误。最终答案校验与步骤核查是两项不同证据。'},{id:'format',title:'没有输出FINAL标记，能直接断定模型不会算吗？',options:['不能','能'],correct:'不能',explanation:'这首先是格式失败。模型是否理解题意需要再看公开输出；不能由字符串解析器代替全部能力评价。'}],
 '22':[{id:'baseline',title:'只比较无调用和有返回，能排除调用文本本身的作用吗？',options:['不能','能'],correct:'不能',explanation:'还需空返回条件，取两个基线总损失较小值，再与有返回比较。'},{id:'trained',title:'筛选保留了一条候选，模型是否已经学会用工具？',options:['没有','已经学会'],correct:'没有',explanation:'这里仅生成评分/筛选记录；原文还有候选采样与微调，本页没有执行这些训练。'}],
 '24':[{id:'equal',title:'候选奖励全相同，组内标准化能区分好坏吗？',options:['不能','能'],correct:'不能',explanation:'方差为0，本课约定优势为0；这不是原文全部奖励或完整GRPO目标。'},{id:'length',title:'同一道题回答更长，应该自动给更多奖励吗？',options:['不应该','应该'],correct:'不应该',explanation:'本课只按答案核验给0/1。长度是观测值，不作为正确性或训练收益的替代。'}]
}
const {book,saved,answer,check,reset,download}=useEvidenceNotebook(props.paperId)
const items=computed(()=>questions[props.paperId]??[]),completed=computed(()=>items.value.filter(q=>book.checked[q.id]).length)
</script>
<template><EvidenceQuestion v-for="q in items" :key="q.id" v-bind="q" :value="book.answers[q.id]" :checked="book.checked[q.id]" @answer="answer(q.id,$event)" @check="check(q.id)"/><EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="items.length" @notes="book.notes=$event" @reset="reset" @download="download({category:'训练信号与推理对照'})"/></template>
