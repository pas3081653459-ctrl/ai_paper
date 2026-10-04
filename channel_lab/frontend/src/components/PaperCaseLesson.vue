<script setup lang="ts">
import {computed} from 'vue'
import {casePlans} from '../papers/casePlans'
import {experimentPlans} from '../papers/experimentPlans'
import {scenes} from './cases/registry'
import VisionImplementation from './cases/VisionImplementation.vue'
import LanguageImplementation from './cases/LanguageImplementation.vue'
import LanguageReflection from './cases/LanguageReflection.vue'
import SearchReflection from './cases/SearchReflection.vue'
import SearchImplementation from './cases/SearchImplementation.vue'
import TrainingReflection from './cases/TrainingReflection.vue'
import TrainingImplementation from './cases/TrainingImplementation.vue'
import SparseImplementation from './cases/SparseImplementation.vue'
import SparseReflection from './cases/SparseReflection.vue'
import {lessonCategories} from '../papers/lessonCategories'
import './cases/caseScene.css'
import './cases/lab.css'
import '../paperResearch.css'
const props=defineProps<{paperId:string}>()
defineEmits<{openModel:[]}>()
const plan=computed(()=>experimentPlans[props.paperId]??casePlans[props.paperId])
const scene=computed(()=>scenes[props.paperId])
const category=computed(()=>lessonCategories.find(c=>c.papers.some(p=>p.id===props.paperId)))
</script>
<template><section class="paper-case-lesson">
<details v-if="category" class="course-neighbors"><summary>{{category.name}} · 同类课程</summary><nav :aria-label="category.name"><a v-for="p in category.papers" :key="p.id" :href="`#/papers/${p.id}`" :aria-current="p.id===paperId?'page':undefined">{{p.name}}</a></nav><p>{{category.note}}</p></details>
<component :is="scene.component" :id="paperId" :key="paperId"/>
<details class="case-support"><summary>实验说明与结果边界</summary><p>{{plan.start}}</p><p><strong>能说明到哪里：</strong>{{plan.boundary}}</p><p><strong>怎样与原文衔接：</strong>{{plan.bridge}}</p></details>
<details v-if="['05','06','07','08','02','03','13','14','22','24','23','25'].includes(paperId)" class="case-support"><summary>检查理解与保存笔记</summary><LanguageReflection v-if="['05','06','07','08'].includes(paperId)" :paper-id="paperId"/><SearchReflection v-if="['02','03'].includes(paperId)" :paper-id="paperId"/><TrainingReflection v-if="['13','14','22','24'].includes(paperId)" :paper-id="paperId"/><SparseReflection v-if="['23','25'].includes(paperId)" :paper-id="paperId"/></details>
<details class="case-support"><summary>深入：本实验的实际代码与配置</summary><p>先完成一次操作，再按需要核对输入检查、计算与输出。下方算子示例使用另一套小参数，不是这里结果的隐藏执行过程。</p><VisionImplementation v-if="['10','19','20'].includes(paperId)"/><LanguageImplementation v-if="['05','06','07','08'].includes(paperId)"/><SearchImplementation v-if="['02','03'].includes(paperId)"/><TrainingImplementation v-if="['13','14','22','24'].includes(paperId)"/><SparseImplementation v-if="['23','25'].includes(paperId)"/><details><summary>交互组件 · {{scene.file}}</summary><pre><code>{{scene.source}}</code></pre></details><button class="paper-primary" @click="$emit('openModel')">打开独立算子练习 →</button></details>
</section></template>
<style scoped>
.course-neighbors,.case-support{padding:14px 20px;border:1px solid #dbe3ed;border-radius:10px;background:white;margin:14px 0}.course-neighbors summary,.case-support summary{font-weight:600;cursor:pointer;padding:5px 0}.course-neighbors nav{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}.course-neighbors a[aria-current=page]{font-weight:700}.course-neighbors p,.case-support p{font-size:14px;line-height:1.9;color:#526579}.case-support pre{max-height:500px;overflow:auto;font-size:12px;background:#f8fafc;padding:16px}
</style>
