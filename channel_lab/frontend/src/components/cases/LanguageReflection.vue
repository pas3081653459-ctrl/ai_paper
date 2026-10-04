<script setup lang="ts">
import { computed } from 'vue'
import { useEvidenceNotebook } from '../../papers/evidenceNotebook'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
const props=defineProps<{paperId:string}>()
const questions:Record<string,{id:string;title:string;options:string[];correct:string;explanation:string}[]>={
 '05':[{id:'pair',title:'两条曲线标签预算一样，但训练划分不同，可以归因于预训练吗？',options:['不能','可以'],correct:'不能',explanation:'还要配对架构、标签子集、优化配置与步数。页面检查的是记录声明，不能验证记录真实性。'},{id:'avg',title:'辅助 LM 被移除后 Avg 上升，能说明每个任务都变好吗？',options:['不能','能'],correct:'不能',explanation:'现有 Table 5 中 Avg 与 QNLI 的变化方向不同。单次结果也没有提供种子间不确定性。'}],
 '06':[{id:'mask',title:'输入中的 [MASK] 是否等于 attention_mask=0？',options:['不是','是'],correct:'不是',explanation:'[MASK] 仍是可见有效 token；attention_mask 的 0 通常排除 padding 键。当前无 padding 时各项为 1。'},{id:'right',title:'删掉后文后运行 BERT，是否变成单向预训练模型？',options:['不是','是'],correct:'不是',explanation:'只改变输入长度和可见证据，模型权重与双向结构不变；不能用这组结果替代论文 LTR 预训练消融。'}],
 '07':[{id:'task',title:'从续写切到摘要时，模型发生了什么变化？',options:['条件文本变化','训练出新的任务头'],correct:'条件文本变化',explanation:'同一组参数，前缀不同；每条件独立初始化 KV 缓存，模型继续预测下一个 token。'},{id:'prob',title:'输出 token 概率高，是否说明句子事实正确？',options:['不能保证','能保证'],correct:'不能保证',explanation:'p(token|prefix) 是语言条件概率。事实核查需要返回原文证据；失败摘要必须保留。'}],
 '08':[{id:'weight',title:'增加两张示例卡，会更新模型权重吗？',options:['不会','会'],correct:'不会',explanation:'示例加入提示，影响条件分布和上下文长度；这里没有反向传播。'},{id:'score',title:'4 道固定题全对，可以称为 GPT-3 基准成绩吗？',options:['不可以','可以'],correct:'不可以',explanation:'页面运行的是标明来源的替代模型和本站小题集；不代表原 GPT-3，也不能推出稳定泛化能力。'}]
}
const {book,saved,answer,check,reset,download}=useEvidenceNotebook(props.paperId)
const items=computed(()=>questions[props.paperId]??[])
const completed=computed(()=>items.value.filter(q=>book.checked[q.id]).length)
</script>
<template><section><EvidenceQuestion v-for="q in items" :key="q.id" v-bind="q" :value="book.answers[q.id]" :checked="book.checked[q.id]" @answer="answer(q.id,$event)" @check="check(q.id)"/><EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="items.length" @notes="book.notes=$event" @reset="reset" @download="download({category:'语言上下文'})"/></section></template>
