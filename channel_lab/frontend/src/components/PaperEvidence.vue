<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Evidence } from '../papers/researchTypes'
import {paperPdf} from '../papers/paperAssets'
const props=defineProps<{paperId:string;evidence:Evidence;hideSource?:boolean}>()
const metricIndex=ref(0),base=ref(0),candidate=ref(props.evidence.rows.length-1)
const sourceOpen=ref(false),pdfPage=ref(props.evidence.source.pages[props.evidence.source.pages.length-1])
const prediction=ref<number|null>(null),revealed=ref(false),tilt=ref(0)
const metric=computed(()=>props.evidence.metrics[metricIndex.value])
const maximum=computed(()=>Math.max(.000001,...props.evidence.rows.map(r=>r.values[metricIndex.value])))
const delta=computed(()=>props.evidence.rows[candidate.value].values[metricIndex.value]-props.evidence.rows[base.value].values[metricIndex.value])
const number=(v:number)=>Number(v.toFixed(4)).toString()
const difference=computed(()=>`${delta.value>0?'+':''}${number(delta.value)} ${metric.value.unit==='%'?'个百分点':metric.value.unit}`)
watch([metricIndex,base,candidate],()=>{prediction.value=null;revealed.value=false})
</script>
<template>
 <section class="research-evidence">
  <div class="research-label">原论文结果回放 · 非本机重跑</div>
  <h3>{{evidence.title}}</h3><p>{{evidence.question}}</p><details v-if="!hideSource"><summary>先核对实验条件</summary><p>{{evidence.setup}}</p><p><strong>保持不变：</strong>{{evidence.control}}</p><p><strong>改变：</strong>{{evidence.change}}</p></details>
  <div class="research-evidence-controls"><label>指标<select v-model.number="metricIndex"><option v-for="(m,i) in evidence.metrics" :key="m.name" :value="i">{{m.name}}</option></select></label><label>参照条件<select v-model.number="base"><option v-for="(row,i) in evidence.rows" :key="row.name" :value="i">{{row.name}}</option></select></label><label>比较条件<select v-model.number="candidate"><option v-for="(row,i) in evidence.rows" :key="row.name" :value="i">{{row.name}}</option></select></label></div>
  <div v-if="!revealed" class="research-prediction"><strong>可选：先预测数值变化</strong><div role="group" aria-label="预测数值变化"><button v-for="(choice,i) in ['更高','更低','相近或无法判断']" :key="choice" :aria-pressed="prediction===i" @click="prediction=i">{{choice}}</button></div><button class="paper-primary" @click="revealed=true">{{prediction===null?'直接查看论文结果':'核对我的预测'}}</button><small>无需答题也可以阅读；只预测方向，不把高低等同于好坏。</small></div>
  <template v-else>
   <p class="research-metric-direction">{{metric.name}}{{metric.unit?`（${metric.unit}）`:''}} · {{metric.better==='up'?'此指标通常越高越好':metric.better==='down'?'此指标通常越低越好':'这是描述量，不按高低排名'}} · 横轴从 0 开始</p>
   <div class="research-chart-viewport"><div class="research-bar-chart" :style="{transform:`rotateX(${tilt}deg)`}"><div v-for="(row,i) in evidence.rows" :key="row.name" class="research-result-row" :class="{reference:i===base,compared:i===candidate}"><span>{{row.name}}</span><div class="research-bar-track"><div class="research-bar" :style="{width:`${row.values[metricIndex]/maximum*100}%`}"></div></div><strong>{{number(row.values[metricIndex])}}</strong></div><div class="research-chart-axis"><span>0</span><span>{{number(maximum)}} {{metric.unit}}</span></div></div></div>
   <details><summary>调整图表视角</summary><label class="research-tilt">倾斜<input v-model.number="tilt" type="range" min="0" max="35" step="1"/><button @click="tilt=0">恢复正面</button></label><p>默认正面便于比较数值；立体效果不代表额外数据维度。</p></details>
   <div class="research-result-delta" role="status"><span>{{evidence.rows[candidate].name}} − {{evidence.rows[base].name}}</span><strong>{{difference}}</strong><small>原表数值的算术差；不表示统计显著性，也不自动构成因果归因。</small></div>
   <div class="research-reading"><h4>实验观察支持什么</h4><p>{{evidence.finding}}</p><h4>哪些结论还不能下</h4><p>{{evidence.boundary}}</p></div>
   <details class="research-table"><summary>逐列查看原表选取的数据</summary><div class="research-table-scroll" tabindex="0" aria-label="论文数值表"><table><thead><tr><th>条件</th><th v-for="m in evidence.metrics" :key="m.name">{{m.name}} {{m.unit}}</th></tr></thead><tbody><tr v-for="row in evidence.rows" :key="row.name"><th>{{row.name}}</th><td v-for="(v,i) in row.values" :key="i">{{number(v)}}</td></tr></tbody></table></div></details>
  </template>
  <div v-if="!hideSource" class="research-source-links"><span>{{evidence.source.label}}</span><a v-for="page in evidence.source.pages" :key="page" :href="paperPdf(paperId,page)" target="_blank" rel="noopener">PDF 第 {{page}} 页 ↗</a></div>
  <details v-if="!hideSource" class="research-original" @toggle="sourceOpen=($event.target as HTMLDetailsElement).open"><summary>在页内阅读原论文图表</summary><div v-if="sourceOpen"><label>PDF 页码 <select v-model.number="pdfPage"><option v-for="page in evidence.source.pages" :key="page" :value="page">{{page}}</option></select></label><a :href="paperPdf(paperId,pdfPage)" target="_blank" rel="noopener">在新标签页打开原文 ↗</a><iframe :key="pdfPage" :src="paperPdf(paperId,pdfPage)" :title="`${evidence.source.label} 原文第 ${pdfPage} 页`" loading="lazy"></iframe></div></details>
 </section>
</template>
