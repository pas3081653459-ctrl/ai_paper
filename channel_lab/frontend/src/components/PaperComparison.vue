<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TensorVolume from './TensorVolume.vue'
import { comparison } from '../papers/comparisons'
import type { CellIndex } from '../transformerTrace'
const props=defineProps<{paperId:string}>()
const variant=ref(0)
const data=computed(()=>comparison(props.paperId,variant.value))
const cells=ref<CellIndex[]>([{slice:0,row:0,col:0},{slice:0,row:0,col:0}])
watch(variant,()=>{cells.value=[{slice:0,row:0,col:0},{slice:0,row:0,col:0}]},{flush:'sync'})
function choose(index:number,cell:CellIndex){cells.value[index]=cell}
const number=(v:number)=>Number.isFinite(v)?v.toPrecision(6):'−∞'
</script>
<template>
 <section class="research-comparison">
  <div class="research-label">固定小案例 · 现场数值计算 · 不代替论文训练</div><h3>{{data.title}}</h3>
  <div v-if="data.cases.length>1" class="research-case-tabs" role="group" aria-label="选择固定输入案例"><button v-for="(name,i) in data.cases" :key="name" :aria-pressed="variant===i" @click="variant=i">{{name}}</button></div>
  <dl class="research-protocol"><div><dt>保持不变</dt><dd>{{data.fixed}}</dd></div><div><dt>只比较这些变化</dt><dd>{{data.changed}}</dd></div></dl><p class="research-action">{{data.action}}</p>
  <div class="research-comparison-grid"><article v-for="(p,i) in data.panels" :key="p.name" class="research-comparison-panel"><header><small>{{i===0?'条件 A':'条件 B'}}</small><h4>{{p.name}}</h4><p>{{p.explanation}}</p><code>[{{p.node.shape.join(', ')}}]</code></header><TensorVolume :node="{...p.node,key:p.node.id}" :selection="cells[i]" :words="p.node.rows??p.node.slices[0].map((_,r)=>String(r))" :plane-labels="p.node.planes??p.node.slices.map((_,h)=>`平面 ${h}`)" :note="`${p.node.kind==='state'?'状态/连接记录':p.node.kind==='measurement'?'统计数据':'教学张量'}；每格一个标量，立体厚度不代表新维度。`" @select="choose(i,$event)"/><p class="research-case-value">所选 [{{cells[i].slice}}, {{cells[i].row}}, {{cells[i].col}}] = <strong>{{number(p.node.slices[cells[i].slice][cells[i].row][cells[i].col])}}</strong></p><div class="research-case-metrics"><div v-for="m in p.metrics" :key="m.label"><small>{{m.label}}</small><strong>{{m.value}}</strong></div></div></article></div>
  <div class="research-reading"><h4>应该观察到什么</h4><p>{{data.observation}}</p><h4>回到原论文前，记住这个区别</h4><p>{{data.boundary}}</p></div>
 </section>
</template>
