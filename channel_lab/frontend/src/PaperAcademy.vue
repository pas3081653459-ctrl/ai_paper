<script setup lang="ts">
import { computed, ref } from 'vue'
import { papers } from './papers/catalog'
import SiteNav from './components/SiteNav.vue'
import {courseTopics} from './papers/courseTopics'
import { readProgress } from './papers/progress'
import { casePlans } from './papers/casePlans'
import { experimentPlans } from './papers/experimentPlans'
import './paperAcademy.css'
const props=defineProps<{initialTopic?:string;initialSearch?:string}>()
const search=ref(props.initialSearch??''), category=ref(courseTopics.some(t=>t.id===props.initialTopic)?props.initialTopic!:'全部')
const currentTopic=computed(()=>courseTopics.find(t=>t.id===category.value))
const progress=readProgress()
const completed=computed(()=>papers.filter(p=>progress.lessons[p.id]?.complete).length)
const last=papers.find(p=>p.id===progress.last)
const filtered=computed(()=>papers.filter(p=>(category.value==='全部'||currentTopic.value?.papers.includes(p.id))&&`${p.name} ${p.title} ${p.question} ${experimentPlans[p.id]?.title??casePlans[p.id]?.title??''} ${courseTopics.find(t=>t.papers.includes(p.id))?.name??''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const paths=[{name:'从图像到注意力',ids:['01','04','10','12','19','20']},{name:'语言模型如何演变',ids:['04','05','06','07','08','17','23']},{name:'训练与推理方法',ids:['02','03','13','14','21','22','24']},{name:'规模与生成',ids:['09','15','11','25','18']}]
const paperName=(id:string)=>papers.find(p=>p.id===id)?.name
const caseTitle=(id:string)=>id==='01'?'从照片响应追踪残差相加':id==='04'?'改一个词，沿 3D 网络追踪变化':experimentPlans[id]?.title??casePlans[id]?.title
const availability=(id:string)=>['04','09','15','17','18'].includes(id)?'可直接学习 · 无需权重':id==='01'?'照片推理需后端 · 可查看讲解': ['05'].includes(id)?'原文可直接读 · 曲线需导入记录':'基础练习可直接用 · 模型或记录按需配置'
</script>
<template>
 <div class="paper-page">
  <SiteNav active="courses"/>
  <main class="paper-main">
   <section class="paper-intro"><a href="#/">← 学习首页</a><h1>{{currentTopic?.name??'全部课程'}}</h1><p>{{currentTopic?.description??'按方向选择课程，或搜索你想理解的问题。每课都有实验指引、原理解释和论文对照。'}}</p><div class="paper-actions"><a v-if="last" class="paper-primary" :href="`#/papers/${last.id}`">继续 {{last.name}}</a><span>已标记学完 {{completed}} / {{papers.length}}</span></div></section>
   <details class="paper-paths"><summary>按学习路线探索</summary><div v-for="path in paths" :key="path.name"><strong>{{path.name}}</strong><nav><template v-for="(id,i) in path.ids" :key="id"><span v-if="i" aria-hidden="true">→</span><a :href="`#/papers/${id}`">{{paperName(id)}}</a></template></nav></div></details>
   <div class="paper-filter"><label><span class="sr-only">搜索论文</span><input v-model="search" type="search" placeholder="搜索名称或想理解的问题" /></label><label>学习方向<select v-model="category"><option value="全部">全部课程</option><option v-for="topic in courseTopics" :key="topic.id" :value="topic.id">{{topic.name}} · {{topic.papers.length}}课</option></select></label></div>
   <div class="catalog-toolbar"><span role="status">{{filtered.length}} 篇课程 · 先操作，再解释，再核对原文</span><button v-if="search||category!=='全部'" @click="search='';category='全部'">清除筛选</button></div>
   <p v-if="!filtered.length" class="paper-empty">没有匹配的课程。清除筛选，或试试“图片”“注意力”等关键词。</p>
   <div class="paper-catalog"><a v-for="paper in filtered" :key="paper.id" :href="`#/papers/${paper.id}`" class="paper-card"><span class="paper-card-top"><small>{{paper.group}} · {{paper.year}}</small><span v-if="progress.lessons[paper.id]?.complete" class="paper-done">已学</span></span><h2><span>{{paper.id}}</span>{{paper.name}}</h2><p>{{caseTitle(paper.id)}}</p><small class="catalog-status">{{availability(paper.id)}}</small><span class="paper-card-bottom">开始学习 <span aria-hidden="true">→</span></span></a></div>
   <p class="paper-bottom-note">每课使用可读的小规模演示。原论文结论与教学简化分别说明；研究报告与方法论文展示状态或统计量，不虚构网络层。</p>
  </main>
 </div>
</template>
