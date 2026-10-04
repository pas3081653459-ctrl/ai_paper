<script setup lang="ts">
import {computed,ref} from 'vue'
import {glossary} from './papers/terminology'
import {papers} from './papers/catalog'
import {paperPdf} from './papers/paperAssets'
import {relatedMath} from './papers/mathLessons'
import './paperAcademy.css'
import './studyReference.css'
const props=defineProps<{paper?:string;term?:string}>()
const search=ref(props.term??''),filter=ref(papers.some(p=>p.id===props.paper)?props.paper!:'')
const results=computed(()=>glossary.filter(t=>(!filter.value||t.paper.id===filter.value)&&`${t.name} ${t.zh} ${t.en} ${t.meaning}`.toLowerCase().includes(search.value.trim().toLowerCase())))
</script>
<template><div class="paper-page"><header class="paper-header"><a href="#/papers">← 论文实验室</a><strong>中英文术语词典</strong><a href="#/math">数学原理</a></header><main class="paper-main reference-page"><h1>这个词，在论文里是什么意思？</h1><p class="reference-intro">先读直白解释，再看本课语境和相关原文。引用位置说明用法，不自动代表历史上的首次提出。</p><div class="reference-filters"><label>搜索中文、英文或缩写<input v-model="search" type="search" placeholder="例如 Query、掩码、NLL"></label><label>论文<select v-model="filter"><option value="">全部论文</option><option v-for="p in papers" :key="p.id" :value="p.id">{{p.name}}</option></select></label><button @click="search='';filter=''">清除筛选</button></div><p role="status">{{results.length}} 条释义 · 同一词在不同论文中可能有不同语境</p><p v-if="!results.length">没有找到。可以清除课程限制，或只输入缩写的一部分。</p><article v-for="t in results" :key="t.id" class="term-card"><small>{{t.paper.name}} · {{t.paper.year}}</small><h2>{{t.zh}} <span lang="en">{{t.en}}</span></h2><p>{{t.meaning}}</p><details><summary>展开语境、例子和论文出处</summary><h3>在这课中怎么理解</h3><p>{{t.context}}</p><h3>用什么现象检验理解</h3><p>{{t.example}}</p><h3>相关原文</h3><p>{{t.paper.title}} · {{t.paper.section}}</p><p class="reference-note">{{t.origin}} 下方是本课相关章节，部分数学基础的原始历史来源未在本站考据；解释为中文释义，不是英文逐字引文。</p><div class="reference-links"><a v-for="page in t.paper.pages" :key="page" :href="paperPdf(t.paper.id,page)" target="_blank" rel="noopener">PDF第{{page}}页 ↗</a><a :href="`#/papers/${t.paper.id}`">进入 {{t.paper.name}} 实验</a></div><div v-if="relatedMath(t.paper.id).length" class="reference-links"><a v-for="m in relatedMath(t.paper.id)" :key="m.id" :href="`#/math/${m.id}?from=${t.paper.id}`">学习数学：{{m.title}} →</a></div></details></article></main></div></template>
