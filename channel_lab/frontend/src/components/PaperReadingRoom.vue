<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {papers} from '../papers/catalog'
import {research} from '../papers/research'
import {paperPdf} from '../papers/paperAssets'
import {readingGuides} from '../papers/readingGuide'
import {experimentPlans} from '../papers/experimentPlans'
import {casePlans} from '../papers/casePlans'
import PaperEvidence from './PaperEvidence.vue'
const props=defineProps<{paperId:string}>()
const paper=computed(()=>papers.find(p=>p.id===props.paperId)!),study=computed(()=>research[props.paperId])
const selected=ref(0),showPdf=ref(false),page=ref(1),readerOpen=ref(false)
const evidence=computed(()=>study.value.experiments[selected.value])
const boundary=computed(()=>props.paperId==='01'?'本站使用小型CNN/ResNet的一次前向，未重复训练18/34层对照；同编号通道不代表同语义。':props.paperId==='04'?'本站是固定参数的Pre-LN小算例；原文是Post-LN Encoder–Decoder，网页未训练翻译器。':(experimentPlans[props.paperId]??casePlans[props.paperId]).boundary)
const pages=computed(()=>Array.from(new Set([...paper.value.pages,...evidence.value.source.pages])).sort((a,b)=>a-b))
watch(evidence,e=>{page.value=e.source.pages[0];showPdf.value=false},{immediate:true})
function toggle(event:Event){readerOpen.value=(event.target as HTMLDetailsElement).open;if(!readerOpen.value)showPdf.value=false}
</script>
<template><div class="paper-reading-room">
<details id="lesson-explain" class="lesson-disclosure"><summary><span>理解原因</span><small>问题 → 旧方法 → 新思路 → 方法步骤</small></summary><div class="reading-prose"><h2>作者要解决什么问题？</h2><p>{{study.problem}}</p><details v-for="prior in study.previous" :key="prior.name"><summary>以前怎么做：{{prior.name}}</summary><p>{{prior.approach}}</p><p><strong>仍然存在的问题：</strong>{{prior.gap}}</p></details><h2>新思路从哪里来？</h2><p>{{study.insight}}</p><ol class="method-reading"><li v-for="step in study.method" :key="step.title"><h3>{{step.title}}</h3><p>{{step.detail}}</p></li></ol><aside class="reading-caution"><strong>回到刚才的操作</strong><p>{{readingGuides[paperId].explain}}</p><p>{{readingGuides[paperId].mistake}}</p></aside></div></details>
<details id="lesson-original" class="lesson-disclosure" @toggle="toggle"><summary><span>对照论文原文</span><small>实验条件、结果、解释与本地 PDF</small></summary><div v-if="readerOpen" class="reading-content"><p class="reading-caption">{{paper.title}} · 下方为中文导读与原表选取数据，非逐字翻译或本机重跑。页码指 PDF 文件页序。</p><label class="reading-selector">选择要核对的实验<select v-model.number="selected"><option v-for="(e,i) in study.experiments" :key="e.title" :value="i">{{e.title}}</option></select></label>
<details><summary>本站操作和这篇论文，分别能回答什么？</summary><dl class="evidence-protocol"><dt>本站先观察</dt><dd>{{readingGuides[paperId].observe}}</dd><dt>机制解释</dt><dd>{{readingGuides[paperId].explain}}</dd><dt>原文实际检验</dt><dd>{{evidence.question}}</dd><dt>不能混同的部分</dt><dd>{{boundary}}</dd></dl></details>
<div class="reading-toolbar"><a :href="paperPdf(paperId,page)" target="_blank" rel="noopener">打开原文 ↗</a><a :href="paperPdf(paperId)" :download="paper.file">下载本篇 PDF</a><button :aria-pressed="showPdf" @click="showPdf=!showPdf">{{showPdf?'收起原文并排视图':'并排阅读原文'}}</button></div>
<div class="reading-columns" :class="{'with-pdf':showPdf}"><div><dl class="evidence-protocol"><dt>原文定位</dt><dd>{{evidence.source.label}} · PDF {{evidence.source.pages.join('、')}} 页</dd><dt>作者问什么</dt><dd>{{evidence.question}}</dd><dt>实验怎么安排</dt><dd>{{evidence.setup}}</dd><dt>保持哪些条件</dt><dd>{{evidence.control}}</dd><dt>改变哪些条件</dt><dd>{{evidence.change}}</dd></dl><details><summary>按什么顺序读这一组结果？</summary><ol><li>先在原文找到上方图表或章节，核对模型、数据集与评测设置。</li><li>确认参照组与比较组改变了什么；多项条件一起变时，不把差异全归给一个因素。</li><li>检查指标单位与好坏方向，再对照数据。百分数相减得到的是百分点。</li><li>最后读结论与限制；样本内现象、论文基准与普遍结论分开判断。</li></ol></details><PaperEvidence :key="`${paperId}-${selected}`" :paper-id="paperId" :evidence="evidence" hide-source/><details><summary>作者的结论，以及还能追问什么</summary><p>{{study.conclusion}}</p><p>{{study.openQuestion}}</p></details></div>
<aside v-if="showPdf" class="original-pdf"><label>PDF文件页码<select v-model.number="page"><option v-for="p in pages" :value="p" :key="p">第 {{p}} 页{{evidence.source.pages.includes(p)?' · 当前证据':''}}</option></select></label><iframe :key="`${paperId}-${page}`" :src="paperPdf(paperId,page)" :title="`${paper.name}原论文第${page}页`" loading="lazy"/><p>浏览器不支持内嵌PDF或没有跳到指定页时，请用上方“打开原文”或下载后按页序查找。</p></aside></div></div></details>
</div></template>
