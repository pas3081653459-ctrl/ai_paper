<script setup lang="ts">
import {paperPdf} from '../papers/paperAssets'
import { computed, nextTick, ref, watch } from 'vue'
import { research } from '../papers/research'
import PaperEvidence from './PaperEvidence.vue'
import PaperComparison from './PaperComparison.vue'
import '../paperResearch.css'
const props=defineProps<{paperId:string}>()
const emit=defineEmits<{openModel:[]}>()
const lesson=research[props.paperId]
const progressKey=`channel-lab-research-v2-${props.paperId}`
const savedState={chapter:0,experimentIndex:0}
try {
 const stored=JSON.parse(localStorage.getItem(progressKey)??'{}')
 if(Number.isInteger(stored?.chapter)&&stored.chapter>=0&&stored.chapter<6)savedState.chapter=stored.chapter
 if(Number.isInteger(stored?.experimentIndex)&&stored.experimentIndex>=0&&stored.experimentIndex<lesson.experiments.length)savedState.experimentIndex=stored.experimentIndex
} catch { /* 禁用或损坏的本地存储不阻止阅读。 */ }
const chapter=ref(savedState.chapter),experimentIndex=ref(savedState.experimentIndex),content=ref<HTMLElement>(),saved=ref(true)
watch([chapter,experimentIndex],()=>{try{localStorage.setItem(progressKey,JSON.stringify({chapter:chapter.value,experimentIndex:experimentIndex.value}));saved.value=true}catch{saved.value=false}})
const chapters=['遇到的问题','思路怎样提出','如何设计实验','读结果与反例','亲手做对照','能得出什么结论']
const evidence=computed(()=>lesson.experiments[experimentIndex.value])
async function move(to:number){chapter.value=to;await nextTick();content.value?.focus({preventScroll:true});content.value?.scrollIntoView({block:'start',behavior:'auto'})}
</script>
<template>
 <section class="paper-research">
  <div class="research-heading"><div><span class="research-label">沿着论文的论证过程学习</span><h2>先问为什么，再看怎么做</h2></div><span>{{chapter+1}} / {{chapters.length}}</span></div>
  <nav class="research-chapters" aria-label="研究过程"><button v-for="(name,i) in chapters" :key="name" :aria-current="chapter===i?'step':undefined" @click="move(i)"><small>{{i+1}}</small>{{name}}</button></nav>
  <div ref="content" class="research-content" tabindex="-1" :aria-label="chapters[chapter]">
   <section v-if="chapter===0"><h3>{{chapters[chapter]}}</h3><p class="research-lead">{{lesson.problem}}</p><div class="research-prior-grid"><article v-for="prior in lesson.previous" :key="prior.name"><h4>{{prior.name}}</h4><p>{{prior.approach}}</p><div><strong>还没解决什么</strong><p>{{prior.gap}}</p></div></article></div><p class="research-reading-prompt">先想一想：这里缺少的是表示能力、优化方法、数据，还是评价方式？下一步看作者如何缩小问题。</p></section>
   <section v-else-if="chapter===1"><h3>{{chapters[chapter]}}</h3><p class="research-lead">{{lesson.insight}}</p><ol class="research-method"><li v-for="(step,i) in lesson.method" :key="step.title"><span>{{i+1}}</span><div><h4>{{step.title}}</h4><p>{{step.detail}}</p></div></li></ol><button class="research-open-model" @click="emit('openModel')">展开网络、公式与代码 →</button><p class="research-small">按论文的论证顺序整理；没有把未披露的研发过程补写成真实历史。</p></section>
   <section v-else-if="chapter===2||chapter===3"><div v-if="lesson.experiments.length>1" class="research-experiment-tabs" role="group" aria-label="选择论文实验"><button v-for="(exp,i) in lesson.experiments" :key="exp.title" :aria-pressed="experimentIndex===i" @click="experimentIndex=i">实验 {{i+1}} · {{exp.title}}</button></div><template v-if="chapter===2"><h3>{{evidence.title}}</h3><p class="research-lead">{{evidence.question}}</p><dl class="research-protocol"><div><dt>任务与评测协议</dt><dd>{{evidence.setup}}</dd></div><div><dt>控制了什么</dt><dd>{{evidence.control}}</dd></div><div><dt>改变了什么</dt><dd>{{evidence.change}}</dd></div><div><dt>测量什么</dt><dd><span v-for="m in evidence.metrics" :key="m.name" class="research-metric-tag">{{m.name}} {{m.unit}}</span></dd></div></dl><p class="research-reading-prompt">在看结果前，先区分：这是同设置消融，还是多个条件共同变化的系统比较？</p><div class="research-source-links"><span>{{evidence.source.label}}</span><a v-for="page in evidence.source.pages" :key="page" :href="paperPdf(paperId,page)" target="_blank" rel="noopener">PDF 第 {{page}} 页 ↗</a></div></template><PaperEvidence v-else :key="`${paperId}-${experimentIndex}`" :paper-id="paperId" :evidence="evidence"/></section>
   <PaperComparison v-else-if="chapter===4" :paper-id="paperId"/>
   <section v-else><h3>把结论限制在证据范围内</h3><p class="research-lead">{{lesson.conclusion}}</p><div class="research-conclusion-grid"><article><h4>继续追问</h4><p>{{lesson.openQuestion}}</p></article><article><h4>用自己的话解释</h4><p>作者解决的具体问题是什么？哪一组对照支持这个结论？有没有指标、条件或失败例子改变你的判断？</p></article></div><button class="research-open-model" @click="emit('openModel')">把结论对应到网络与代码 →</button></section>
  </div>
  <p v-if="!saved" class="research-storage-note" role="status">浏览器无法保存阅读位置，本次仍可继续。</p>
  <footer class="research-navigation"><button :disabled="chapter===0" @click="move(chapter-1)">← 上一步</button><span>{{chapters[chapter]}}</span><button v-if="chapter<chapters.length-1" class="paper-primary" @click="move(chapter+1)">下一步：{{chapters[chapter+1]}} →</button><button v-else @click="move(0)">重新梳理</button></footer>
 </section>
</template>
