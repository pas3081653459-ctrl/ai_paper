<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import App from './App.vue'
import LearningHome from './LearningHome.vue'
import TransformerLesson from './TransformerLesson.vue'
import PaperAcademy from './PaperAcademy.vue'
import PaperLesson from './PaperLesson.vue'
import GlossaryPage from './GlossaryPage.vue'
import MathStudyPage from './MathStudyPage.vue'
import { papers } from './papers/catalog'
const hash=ref(window.location.hash)
const routePath=computed(()=>hash.value.split('?')[0])
const routeQuery=computed(()=>new URLSearchParams(hash.value.split('?')[1]??''))
const mathTopic=computed(()=>routePath.value.startsWith('#/math/')?routePath.value.slice('#/math/'.length):undefined)
const lessonId=computed(()=>routePath.value.match(/^#\/papers\/(\d{2})$/)?.[1])
const validLesson=computed(()=>papers.some(p=>p.id===lessonId.value))
function title(){const paper=papers.find(p=>p.id===lessonId.value);document.title=paper?`${paper.name} · 论文实验室`:routePath.value==='#/vision'?'CNN / ResNet · Channel Lab':hash.value.startsWith('#/math')?'数学原理 · Channel Lab':hash.value.startsWith('#/glossary')?'中英文术语 · Channel Lab':hash.value.startsWith('#/transformer')?'Transformer 数据流 · Channel Lab':hash.value.startsWith('#/papers')?'全部课程 · Channel Lab':['','#','#/'].includes(routePath.value)?'学习首页 · Channel Lab':'页面不存在 · Channel Lab'}
async function route(){hash.value=window.location.hash;title();await nextTick();window.scrollTo({top:0,behavior:'instant'});const heading=document.querySelector('h1');if(heading instanceof HTMLElement){heading.tabIndex=-1;heading.focus({preventScroll:true})}}
onMounted(()=>{title();window.addEventListener('hashchange',route)})
onUnmounted(()=>window.removeEventListener('hashchange',route))
</script>
<template>
 <LearningHome v-if="['','#','#/'].includes(routePath)"/>
 <App v-else-if="routePath==='#/vision'"/>
 <GlossaryPage v-else-if="routePath==='#/glossary'" :key="hash" :paper="routeQuery.get('paper')??undefined" :term="routeQuery.get('term')??undefined"/>
 <MathStudyPage v-else-if="routePath==='#/math'||routePath.startsWith('#/math/')" :key="hash" :topic="mathTopic" :from="routeQuery.get('from')??undefined"/>
 <TransformerLesson v-else-if="routePath==='#/transformer'" />
 <PaperAcademy v-else-if="routePath==='#/papers'||routePath==='#/papers/'" :key="hash" :initial-topic="routeQuery.get('topic')??undefined" :initial-search="routeQuery.get('q')??undefined" />
 <PaperLesson v-else-if="lessonId&&validLesson" :id="lessonId" :key="lessonId" />
 <div v-else-if="hash.startsWith('#/papers')" class="paper-page"><main class="paper-main"><h1>课程不存在</h1><a href="#/papers">返回论文实验室</a></main></div>
 <div v-else class="paper-page"><main class="paper-main"><h1>页面不存在</h1><p>请从学习首页选择课程或工具。</p><a href="#/">返回学习首页</a></main></div>
</template>
