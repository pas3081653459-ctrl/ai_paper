<script setup lang="ts">
import SiteNav from './components/SiteNav.vue'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import TensorVolume from './components/TensorVolume.vue'
import NumberMatrix from './components/NumberMatrix.vue'
import PaperCaseLesson from './components/PaperCaseLesson.vue'
import ResNetPaper from './components/ResNetPaper.vue'
import TransformerPaper from './components/TransformerPaper.vue'
import LearningGuide from './components/LearningGuide.vue'
import PaperReadingRoom from './components/PaperReadingRoom.vue'
import {paperPdf} from './papers/paperAssets'
import { papers } from './papers/catalog'
import { experiment } from './papers/experiments'
import { readProgress, saveProgress } from './papers/progress'
import { fmt } from './papers/math'
import { inspectCell } from './papers/inspect'
import mathSource from './papers/math.ts?raw'
import torchSource from '../../teaching_models.py?raw'
import type { CellIndex } from './transformerTrace'
import type { Settings, Stage } from './papers/types'
import './transformerLesson.css'
import './transformerExplorer.css'
import './paperAcademy.css'
const networkOpen=ref(false),networkDetails=ref<HTMLDetailsElement>()
async function openModel(){networkOpen.value=true;await nextTick();networkDetails.value?.scrollIntoView({block:'start',behavior:'auto'});networkDetails.value?.querySelector('summary')?.focus({preventScroll:true})}
const props=defineProps<{ id: string }>()
const torchEntry:Record<string,string>={'01':'ResidualBlock','04':'Attention.forward：context 分支','10':'TinyViT → EncoderBlock → Attention','11':'ddpm_forward_noise','12':'clip_pair_loss','17':'LlamaBlock → RMSNorm / rope / SwiGLU','19':'VisualConnector','23':'SparseMoE → SwiGLU'}
const paper=papers.find(p=>p.id===props.id)!
const initial=experiment(paper.id,{})
const stored=readProgress().lessons[paper.id]
const settings=reactive<Settings>({})
for(const knob of initial.knobs) {
 const value=stored?.settings[knob.key]??knob.initial
 settings[knob.key]=Math.min(knob.max,Math.max(knob.min,knob.min+Math.round((value-knob.min)/knob.step)*knob.step))
}
if(stored?.settings.pixel!==undefined&&Number.isInteger(stored.settings.pixel)&&stored.settings.pixel>=0&&stored.settings.pixel<36)settings.pixel=stored.settings.pixel
const lab=computed(()=>experiment(paper.id,settings))
const graphViewport=ref<HTMLDivElement>()
const active=ref(Math.min(stored?.step??0,initial.stages.length-1)),complete=ref(stored?.complete??false)
const current=computed(()=>lab.value.stages[active.value])
const selection=ref<CellIndex>({slice:0,row:0,col:0})
const node=computed(()=>({...current.value,key:current.value.id}))
const inspection=computed(()=>inspectCell(paper.id,settings,lab.value,current.value,selection.value))
const contributionMax=computed(()=>Math.max(.00001,...(inspection.value?.terms??[]).map(t=>Math.abs(t.value))))
const matrix=computed(()=>current.value.slices[selection.value.slice])
const value=computed(()=>matrix.value[selection.value.row][selection.value.col])
const parents=computed(()=>current.value.parents.map(id=>lab.value.stages.find(n=>n.id===id)!).filter(Boolean))
const compare=ref(false), upstream=ref(0)
const parent=computed(()=>parents.value[Math.min(upstream.value,parents.value.length-1)])
const planeLabels=(stage:Stage)=>stage.planes??stage.slices.map((_,i)=>stage.axes.length===4?`${stage.axes[1]}=${i}`:'单个平面')
const words=(stage:Stage)=>stage.rows??stage.slices[0].map((_,i)=>String(i))
const note=(stage:Stage)=>`${stage.kind==='state'?'这是状态记录，不是网络激活。':stage.kind==='measurement'?'这是统计量或损失，不是网络激活。':''}每个小块是一个标量；平面展示最后两个数据方向${stage.shape.length===2?'（编号向量额外用单列显示）':''}，其他方向在上方形状中标出。立体厚度只用于辨认格子。`
const kind=computed(()=>current.value.kind==='state'?'状态记录':current.value.kind==='measurement'?'统计量':'张量')
const playing=ref(false),saved=ref(true),answer=ref<number|null>(null)
let timer:ReturnType<typeof setInterval>|undefined
function networkToggle(event:Event){networkOpen.value=(event.target as HTMLDetailsElement).open;if(!networkOpen.value)stop()}
function stop(){playing.value=false;if(timer){clearInterval(timer);timer=undefined}}
function selectStage(index:number){stop();active.value=index}
function selectStageById(id:string){const index=lab.value.stages.findIndex(s=>s.id===id);if(index>=0)selectStage(index)}
function play(){if(playing.value){stop();return}if(active.value===lab.value.stages.length-1)active.value=0;playing.value=true;timer=setInterval(()=>{if(active.value<lab.value.stages.length-1)active.value++;else stop()},2400)}
function persist(){saved.value=saveProgress(paper.id,{step:active.value,settings:{...settings},complete:complete.value})}
watch([active,complete],persist)
async function centerStage(){await nextTick();const viewport=graphViewport.value;if(viewport)viewport.scrollTo({left:Math.max(0,24+active.value*192-viewport.clientWidth/2+83),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
watch(active,centerStage)
watch(settings,()=>{stop();persist()},{deep:true})
watch(current,()=>{selection.value={slice:0,row:0,col:0};upstream.value=0},{flush:'sync'})
onMounted(()=>{persist();void centerStage()})
onUnmounted(stop)
function reset(){stop();for(const key of Object.keys(settings))delete settings[key];for(const knob of initial.knobs)settings[knob.key]=knob.initial;active.value=0;answer.value=null;persist()}
const canEdit=computed(()=>['01','10','20'].includes(paper.id))
function pixel(index:number){if(!canEdit.value)return;settings.pixel=paper.id==='20'?index:settings.pixel===index?-1:index}
const graphWidth=computed(()=>lab.value.stages.length*192+24)
const edges=computed(()=>lab.value.stages.flatMap((stage,j)=>stage.parents.map(id=>{const i=lab.value.stages.findIndex(s=>s.id===id);const x1=24+i*192+166,x2=24+j*192;return {id:`${id}-${stage.id}`,d:`M ${x1} 98 C ${x1+30} ${i===j-1?98:20}, ${x2-30} ${i===j-1?98:20}, ${x2} 98`,active:stage.id===current.value.id,skip:i<j-1}})))
const index=papers.findIndex(p=>p.id===paper.id)
const related=computed(()=>paper.dependencies.map(id=>papers.find(p=>p.id===id)!).filter(Boolean))
const sourceHref=(page:number)=>paperPdf(paper.id,page)
async function goTo(section:string){
 if(section==='lesson-advanced'){await openModel();return}
 const target=document.getElementById(section)
 if(target instanceof HTMLDetailsElement)target.open=true
 await nextTick()
 target?.scrollIntoView({block:'start',behavior:'auto'})
 const focus=target instanceof HTMLDetailsElement?target.querySelector('summary'):target
 if(focus instanceof HTMLElement){if(focus.tagName!=='SUMMARY')focus.tabIndex=-1;focus.focus({preventScroll:true})}
}
const patchStyle=(r:number,c:number)=>paper.id==='10'?{borderRight:(c+1)%settings.patch===0?'2px solid #3b82f6':undefined,borderBottom:(r+1)%settings.patch===0?'2px solid #3b82f6':undefined}:{}
</script>
<template>
 <div class="paper-page">
  <SiteNav active="courses"/>
  <header class="paper-header"><a href="#/papers">← 全部课程</a><strong>{{paper.name}}</strong><a :href="`#/glossary?paper=${paper.id}`" target="_blank" rel="noopener">本课术语 ↗</a></header>
  <main class="paper-main paper-lesson">
   <section class="paper-lesson-intro"><span class="paper-eyebrow">{{paper.group}} · {{paper.year}} · 第 {{index+1}} / {{papers.length}} 课</span><h1>{{paper.question}}</h1><details><summary>这节课要理解什么？</summary><p>{{paper.principle}}</p><nav v-if="related.length" class="paper-prerequisites">相关基础：<a v-for="p in related" :key="p.id" :href="`#/papers/${p.id}`">{{p.name}}</a></nav></details></section>
   <nav class="lesson-outline" aria-label="本课阅读导航"><button @click="goTo('lesson-experiment')">1 动手实验</button><button @click="goTo('lesson-explain')">2 理解原因</button><button @click="goTo('lesson-original')">3 原文对照</button><button v-if="paper.id!=='01'" @click="goTo('lesson-advanced')">进阶算子</button><small>可自由跳转，已有实验保留</small></nav>
   <section id="lesson-experiment" tabindex="-1" aria-label="动手实验">
   <LearningGuide :paper-id="paper.id"/>
   <ResNetPaper v-if="paper.id==='01'"/>
   <TransformerPaper v-else-if="paper.id==='04'" @open-model="openModel"/>
   <PaperCaseLesson v-else :key="paper.id" :paper-id="paper.id" @open-model="openModel"/>
   </section>
   <PaperReadingRoom :paper-id="paper.id"/>
   <details v-if="paper.id!=='01'" id="lesson-advanced" ref="networkDetails" class="research-network-details" :open="networkOpen" @toggle="networkToggle">
    <summary>深入网络：逐层数据流、数学与代码<small>沿用小参数实验，可自由改输入；与上面的论文结果分开阅读。</small></summary>
   <section class="paper-control-panel" aria-label="实验参数">
    <div v-if="lab.image" class="paper-image-input"><div class="paper-pixel-grid"><template v-for="(row,r) in lab.image" :key="r"><button v-for="(v,c) in row" :key="c" :disabled="!canEdit" :aria-label="`像素 ${r},${c}，值 ${fmt(v)}`" :aria-pressed="paper.id==='20'&&(settings.pixel??14)===r*6+c" :style="{backgroundColor:`rgb(${Math.round(Math.min(1,Math.max(0,v))*230+15)} ${Math.round(Math.min(1,Math.max(0,v))*230+15)} ${Math.round(Math.min(1,Math.max(0,v))*230+15)})`,...patchStyle(r,c)}" @click="pixel(r*6+c)"><span v-if="paper.id==='20'&&(settings.pixel??14)===r*6+c">＋</span></button></template></div><small>{{lab.imageHint}}</small></div>
    <div class="paper-knobs"><label v-for="knob in lab.knobs" :key="knob.key"><span>{{knob.title}} <output>{{knob.labels?.[settings[knob.key]]??fmt(settings[knob.key])}}</output></span><input v-model.number="settings[knob.key]" type="range" :min="knob.min" :max="knob.max" :step="knob.step" /></label><button class="paper-subtle" @click="reset">重置实验</button></div>
    <div class="paper-metrics"><div v-for="metric in lab.metrics" :key="metric.label"><small>{{metric.label}}</small><strong>{{metric.value}}</strong></div></div>
   </section>
   <section class="paper-flow" aria-label="逐步数据流">
    <div class="paper-flow-toolbar"><div><button class="paper-primary" :aria-pressed="playing" @click="play">{{playing?'暂停':'播放数据流'}}</button><button :disabled="active===0" @click="selectStage(active-1)">上一步</button><button :disabled="active===lab.stages.length-1" @click="selectStage(active+1)">下一步</button></div><label>步骤 <select :value="active" @change="selectStage(Number(($event.target as HTMLSelectElement).value))"><option v-for="(stage,i) in lab.stages" :key="stage.id" :value="i">{{i+1}}. {{stage.title}}</option></select></label></div>
    <div ref="graphViewport" class="paper-flow-scroll" tabindex="0" aria-label="数据流关系图，可横向滚动"><div class="paper-flow-graph" :style="{width:`${graphWidth}px`}"><svg :width="graphWidth" height="178" aria-hidden="true"><defs><marker id="paper-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs><path v-for="edge in edges" :key="edge.id" :d="edge.d" :class="{active:edge.active,skip:edge.skip,flowing:playing&&edge.active}" marker-end="url(#paper-arrow)" /></svg><button v-for="(stage,i) in lab.stages" :key="stage.id" class="paper-flow-node" :class="{active:active===i,upstream:current.parents.includes(stage.id)}" :style="{left:`${24+i*192}px`}" :aria-current="active===i?'step':undefined" @click="selectStage(i)"><span class="paper-mini-tensor" aria-hidden="true"><i/><i/><i/></span><small>{{String(i+1).padStart(2,'0')}}</small><strong>{{stage.title}}</strong><code>[{{stage.shape.join(', ')}}]</code></button></div></div>
    <div class="paper-step-title"><span>{{active+1}} / {{lab.stages.length}} · {{kind}}</span><h2>{{current.title}}</h2><div class="paper-shape"><span v-for="(dimension,i) in current.shape" :key="i"><small>{{current.axes[i]??`dim ${i}`}}</small><strong>{{dimension}}</strong></span></div><p>{{current.description}}</p></div>
    <div v-if="parents.length" class="paper-parent-links"><span>相关输入与前置步骤：</span><button v-for="p in parents" :key="p.id" @click="selectStage(lab.stages.findIndex(s=>s.id===p.id))">{{p.title}} <code>[{{p.shape.join(',')}}]</code></button><label><input v-model="compare" type="checkbox"/> 对照输入</label><select v-if="compare&&parents.length>1" v-model.number="upstream" aria-label="选择要对照的输入"><option v-for="(p,i) in parents" :key="p.id" :value="i">{{p.title}}</option></select></div>
    <div v-if="compare&&parent" class="paper-upstream"><TensorVolume :key="`input-${parent.id}`" :node="{...parent,key:parent.id}" :selection="{slice:0,row:0,col:0}" :words="words(parent)" :plane-labels="planeLabels(parent)" :note="note(parent)" @select="selectStageById(parent.id)"/><span class="paper-input-arrow">↓ {{current.operation}}</span></div>
    <div class="paper-detail-grid"><TensorVolume :node="node" :selection="selection" :words="words(current)" :plane-labels="planeLabels(current)" :note="note(current)" @select="selection=$event"/><aside class="paper-scalar"><h3>点开一个数字</h3><div class="paper-cell-select"><label>平面<select v-model.number="selection.slice"><option v-for="(_,i) in current.slices" :key="i" :value="i">{{planeLabels(current)[i]}}</option></select></label><label>行<select v-model.number="selection.row"><option v-for="(_,i) in matrix" :key="i" :value="i">{{current.rows?.[i]??i}}</option></select></label><label>列<select v-model.number="selection.col"><option v-for="(_,i) in matrix[0]" :key="i" :value="i">{{i}}</option></select></label></div><div class="paper-selected"><code>平面 {{selection.slice}} · [{{selection.row}}, {{selection.col}}]</code><strong>{{Number.isFinite(value)?value.toPrecision(8):'−∞'}}</strong></div><template v-if="inspection"><h3>{{inspection.title}}</h3><pre class="paper-formula">{{inspection.equation}}</pre><div v-if="inspection.terms" class="paper-contributions"><div v-for="(term,i) in inspection.terms" :key="i"><span>{{term.label}}</span><code>{{fmt(term.value)}}</code><i :style="{width:`${Math.abs(term.value)/contributionMax*100}%`,backgroundColor:term.value<0?'#edb88c':'#b3cdf5'}" /></div></div><p v-if="inspection.note" class="paper-inspect-note">{{inspection.note}}</p></template><h3>这一步怎么算</h3><pre class="paper-formula">{{current.formula}}</pre><p v-if="current.note">{{current.note}}</p><small>核心运算示意（省略上下文；完整数值实现见下方源码）</small><pre><code>{{current.code}}</code></pre></aside></div>
    <details class="paper-matrix"><summary>展开数值表 · 平面 {{selection.slice}}</summary><NumberMatrix :title="current.title" :values="matrix" :rows="current.rows" :selected-row="selection.row" :probability="current.probability" /></details>
   </section>
   <section class="paper-practice"><div><h2>动手试试</h2><p>{{paper.exercise}}</p><ul><li v-for="observation in lab.observations" :key="observation">{{observation}}</li></ul></div><div class="paper-quiz"><h2>检查理解</h2><p>{{paper.quiz.question}}</p><div role="group" :aria-label="paper.quiz.question"><button v-for="(option,i) in paper.quiz.options" :key="i" :aria-pressed="answer===i" :class="{chosen:answer===i}" @click="answer=i">{{option}}</button></div><p v-if="answer!==null" class="paper-quiz-feedback" role="status">{{answer===paper.quiz.answer?'答对了。':'再想一下。'}} {{paper.quiz.explanation}}</p></div></section>
   </details>
   <section class="paper-source">
    <h2>原文下载与算例源码</h2><p>{{paper.title}}</p>
    <div class="paper-source-links"><a v-for="page in paper.pages" :key="page" :href="sourceHref(page)" target="_blank" rel="noopener">PDF 第 {{page}} 页 ↗</a><span>{{paper.section}}</span></div>
    <p v-if="paper.id==='01'" class="paper-limit"><strong>教学边界：</strong>照片响应来自本地 TinyClassifier 的真实前向，不是原论文 ResNet-18/34；分类能力取决于所选权重。这里没有重新训练模型、关闭捷径或计算反向梯度。原论文的训练效果由上方原表单独说明。</p>
    <template v-else>
     <p class="paper-limit"><strong>{{paper.id==='04'?'交叉注意力小实验边界：':'独立算子示例的边界（不描述主案例）：'}}</strong>{{paper.limitation}}</p>
     <details v-if="torchEntry[paper.id]"><summary>原生 PyTorch 学习代码 · {{torchEntry[paper.id]}}</summary><p>只定义网络与运算，不训练、不下载权重。阅读入口：{{torchEntry[paper.id]}}。这是独立的结构示例，默认维度和初始化与网页的固定小矩阵不同；网页数值请对照下面的计算源码。</p><pre><code>{{torchSource}}</code></pre></details>
     <p v-else-if="['05','06','07','08'].includes(paper.id)" class="paper-code-link"><a href="#/transformer">阅读已有 TinyBERT / TinyGPT 原生 PyTorch 网络代码 →</a></p>
     <details><summary>{{paper.id==='04'?'交叉注意力算例源码':'查看独立算子完整计算源码'}}</summary><p>独立算子示例的数值计算，使用固定小权重；按课程编号查找对应分支。主案例使用的专用组件源码在案例区域展示。</p><pre><code>{{lab.sourceCode}}</code></pre></details>
     <details><summary>查看共用矩阵运算：卷积、注意力、归一化</summary><pre><code>{{mathSource}}</code></pre></details>
    </template>
   </section>
   <footer class="paper-lesson-footer"><div><button :class="{'paper-primary':!complete}" :aria-pressed="complete" @click="complete=!complete">{{complete?'✓ 已标记学完':'标记已学完'}}</button><small v-if="!saved" role="status">浏览器无法保存进度；本次仍可继续学习。</small><small v-else>进度保存在此浏览器</small></div><nav><a v-if="index>0" :href="`#/papers/${papers[index-1].id}`">← {{papers[index-1].name}}</a><a v-if="index<papers.length-1" :href="`#/papers/${papers[index+1].id}`">{{papers[index+1].name}} →</a></nav></footer>
  </main>
 </div>
</template>
