<script setup lang="ts">
import {computed} from 'vue'
import EvidenceQuestion from './EvidenceQuestion.vue'
import EvidenceNotes from './EvidenceNotes.vue'
import {useEvidenceNotebook} from '../../papers/evidenceNotebook'
const props=defineProps<{paperId:string}>()
const items=computed(()=>props.paperId==='23'?[
{id:'storage',title:'每次只选两个专家，是否只需存储两个专家的权重？',options:['不是','是'],correct:'不是',explanation:'其他token或其他层仍可能选择其余专家。稀疏调用不等于稀疏存储。'},
{id:'context',title:'两次都选择 E3，能断定 E3 是银行专家吗？',options:['不能','能'],correct:'不能',explanation:'选择依赖层、隐藏状态和输入；少量样例不足以证明固定语义分工。'}]:[
{id:'rewrite',title:'一个位置从可见变回MASK，记录一定坏了吗？',options:['不一定','一定'],correct:'不一定',explanation:'采样策略可能重新遮蔽不确定位置，应检查真实采样配置；固定条件位置则必须保持不变。'},
{id:'stages',title:'一段采样动画能证明UniGRPO带来多少收益吗？',options:['不能','能'],correct:'不能',explanation:'需要原文训练阶段消融、指标和实验条件；生成步骤与训练阶段是不同轴。'}])
const {book,saved,answer,check,reset,download}=useEvidenceNotebook(props.paperId)
const completed=computed(()=>items.value.filter(q=>book.checked[q.id]).length)
</script>
<template><EvidenceQuestion v-for="q in items" :key="q.id" v-bind="q" :value="book.answers[q.id]" :checked="book.checked[q.id]" @answer="answer(q.id,$event)" @check="check(q.id)"/><EvidenceNotes :book="book" :saved="saved" :completed="completed" :total="items.length" @notes="book.notes=$event" @reset="reset" @download="download({category:'稀疏路由与多模态生成'})"/></template>
