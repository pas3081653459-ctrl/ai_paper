<script setup lang="ts">
import {computed} from 'vue'
import {readingGuides} from '../papers/readingGuide'
import {bilingual} from '../papers/terminology'
import {relatedMath} from '../papers/mathLessons'
import '../studyReference.css'
const props=defineProps<{paperId:string}>()
const guide=computed(()=>readingGuides[props.paperId])
</script>
<template><aside v-if="guide" class="learning-guide" aria-label="本课操作指引"><div class="guide-first"><span class="guide-label">从这里开始</span><p>{{guide.action}}</p></div><details><summary>操作后看哪里？<span>观察提示、原因与术语</span></summary><div class="guide-explanation"><h3>只追踪这一个变化</h3><p>{{guide.observe}}</p><h3>为什么这样观察</h3><p>{{guide.explain}}</p><h3>容易误解的地方</h3><p>{{guide.mistake}}</p><dl><template v-for="[term,meaning] in guide.terms" :key="term"><dt><a :href="`#/glossary?paper=${paperId}&term=${encodeURIComponent(term)}`" target="_blank" rel="noopener">{{bilingual[term]?.zh??term}} ↗</a><span class="term-english" lang="en">{{bilingual[term]?.en}}</span></dt><dd>{{meaning}}</dd></template></dl></div></details><details><summary>术语出处与数学原理<span>在独立页面学习，保留当前实验</span></summary><div class="guide-explanation"><div class="term-links"><a :href="`#/glossary?paper=${paperId}`" target="_blank" rel="noopener">本课中英文词典与出处 ↗</a><a v-for="m in relatedMath(paperId)" :key="m.id" :href="`#/math/${m.id}?from=${paperId}`" target="_blank" rel="noopener">{{m.title}} ↗</a><a v-if="!relatedMath(paperId).length" href="#/math" target="_blank" rel="noopener">浏览数学基础 ↗</a></div><p class="reference-note">在新标签页打开；数学小算例不代表当前模型结果。</p></div></details></aside></template>
