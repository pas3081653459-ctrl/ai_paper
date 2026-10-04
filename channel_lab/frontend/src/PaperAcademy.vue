<script setup lang="ts">
import { computed, ref } from 'vue'
import { groups, papers } from './papers/catalog'
import { readProgress } from './papers/progress'
import { casePlans } from './papers/casePlans'
import { experimentPlans } from './papers/experimentPlans'
import { lessonCategories } from './papers/lessonCategories'
import './paperAcademy.css'
const search=ref(''), category=ref('全部')
const progress=readProgress()
const completed=computed(()=>papers.filter(p=>progress.lessons[p.id]?.complete).length)
const last=papers.find(p=>p.id===progress.last)
const filtered=computed(()=>papers.filter(p=>(category.value==='全部'||p.group===category.value||lessonCategories.find(c=>c.name===category.value)?.papers.some(c=>c.id===p.id))&&`${p.name} ${p.title} ${p.question} ${experimentPlans[p.id]?.title??casePlans[p.id]?.title??''}`.toLowerCase().includes(search.value.trim().toLowerCase())))
const paths=[{name:'从图像到注意力',ids:['01','04','10','12','19','20']},{name:'语言模型如何演变',ids:['04','05','06','07','08','17','23']},{name:'训练与推理方法',ids:['02','03','13','14','21','22','24']},{name:'规模与生成',ids:['09','15','11','25','18']}]
const paperName=(id:string)=>papers.find(p=>p.id===id)?.name
const caseTitle=(id:string)=>id==='01'?'从照片响应追踪残差相加':id==='04'?'改一个词，沿 3D 网络追踪变化':experimentPlans[id]?.title??casePlans[id]?.title
const availability=(id:string)=>['04','09','15','17','18'].includes(id)?'可直接学习 · 无需权重':id==='01'?'照片推理需后端 · 可查看讲解': ['05'].includes(id)?'原文可直接读 · 曲线需导入记录':'基础练习可直接用 · 模型或记录按需配置'
</script>
<template>
 <div class="paper-page">
  <header class="paper-header"><a href="#/">← CNN / ResNet</a><strong>论文实验室</strong><nav class="reference-links"><a href="#/glossary">中英文术语</a><a href="#/math">数学原理</a><a href="#/transformer">Transformer 详解</a></nav></header>
  <main class="paper-main">
   <section class="paper-intro"><span class="paper-eyebrow">24 篇论文 · 各自的案例与证据</span><h1>从看得见的变化，理解论文</h1><p>在照片中追踪响应，在棋盘上观察搜索，在文本中检查上下文，在预算曲线上寻找取舍。每篇从自己的案例进入，再回到原文实验。</p><div class="paper-actions"><a class="paper-primary" :href="`#/papers/${last?.id??'01'}`">{{last?`继续 ${last.name}`:'从残差连接开始'}}</a><span>已学 {{completed}} / {{papers.length}}</span></div></section>
   <details class="paper-paths"><summary>按学习路线探索</summary><div v-for="path in paths" :key="path.name"><strong>{{path.name}}</strong><nav><template v-for="(id,i) in path.ids" :key="id"><span v-if="i" aria-hidden="true">→</span><a :href="`#/papers/${id}`">{{paperName(id)}}</a></template></nav></div></details>
   <div class="paper-filter"><label><span class="sr-only">搜索论文</span><input v-model="search" type="search" placeholder="搜索名称或想理解的问题" /></label><label>按实验体验筛选<select v-model="category"><option value="全部">全部课程</option><optgroup label="实验分类"><option v-for="c in lessonCategories" :key="c.name">{{c.name}}</option></optgroup><optgroup label="研究主题"><option v-for="g in groups" :key="g">{{g}}</option></optgroup></select></label></div>
   <div class="catalog-toolbar"><span role="status">{{filtered.length}} 篇课程 · 先操作，再解释，再核对原文</span><button v-if="search||category!=='全部'" @click="search='';category='全部'">清除筛选</button></div>
   <p v-if="!filtered.length" class="paper-empty">没有匹配的课程。清除筛选，或试试“图片”“注意力”等关键词。</p>
   <div class="paper-catalog"><a v-for="paper in filtered" :key="paper.id" :href="`#/papers/${paper.id}`" class="paper-card"><span class="paper-card-top"><small>{{paper.group}} · {{paper.year}}</small><span v-if="progress.lessons[paper.id]?.complete" class="paper-done">已学</span></span><h2><span>{{paper.id}}</span>{{paper.name}}</h2><p>{{caseTitle(paper.id)}}</p><small class="catalog-status">{{availability(paper.id)}}</small><span class="paper-card-bottom">开始学习 <span aria-hidden="true">→</span></span></a></div>
   <p class="paper-bottom-note">每课使用可读的小规模演示。原论文结论与教学简化分别说明；研究报告与方法论文展示状态或统计量，不虚构网络层。</p>
  </main>
 </div>
</template>
