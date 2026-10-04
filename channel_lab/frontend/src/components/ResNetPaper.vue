<script setup lang="ts">
import {ref} from 'vue'
import App from '../App.vue'
import {paperPdf} from '../papers/paperAssets'
import modelSource from '../../../backend/models.py?raw'
import '../paperResearch.css'
const hypothesis=ref('')
</script>
<template><section class="resnet-story"><App paper-mode/>
<details class="resnet-question"><summary>图片响应能说明“深层更好训练”吗？</summary><p>刚才看到的是这张图片的一次前向。论文面对的另一个现象是：普通网络加深后，训练误差也升高。先选一种解释，再查看反馈。</p><div class="hypotheses"><button v-for="item in ['只是过拟合','更深就表达不了浅层函数','有好解，但优化未必找到']" :key="item" :aria-pressed="hypothesis===item" @click="hypothesis=item">{{item}}</button></div><p v-if="hypothesis" aria-live="polite">{{hypothesis==='只是过拟合'?'只用过拟合无法解释训练误差也升高；需要同时查看训练与验证曲线。':hypothesis==='更深就表达不了浅层函数'?'额外层如果实现恒等映射，理论上可以保留浅层解；关键在于是否容易学到。':'将目标写成H(x)=x+F(x)，让分支学习改变量。存在好解与优化能够找到它不同。'}}</p><a :href="paperPdf('01',2)" target="_blank" rel="noopener">核对原文退化问题与残差思路 ↗</a><p>主分支接近零时，恒等捷径可保留输入，但仍需考虑末尾ReLU。训练效果请继续看下方“原文对照”中的18/34层实验。</p></details>
<details class="resnet-question"><summary>这些照片响应对应哪段代码？</summary><p>上传图片 → /api/analyze → TinyClassifier.forward(trace=True) → Block.forward。record保存shortcut、main、sum、output，网页按同一通道和坐标读取。随机模式也是真实计算，但没有识别意义。</p><pre><code>{{modelSource}}</code></pre></details></section></template>
<style scoped>
.resnet-question{padding:20px;background:white;border:1px solid #dbe3ed;border-radius:12px;margin:18px 0}.resnet-question summary{cursor:pointer;font-weight:600}.resnet-story p{line-height:1.9;color:#475569}.hypotheses{display:flex;gap:10px;flex-wrap:wrap}.hypotheses button{padding:10px;border:1px solid #cbd5e1;border-radius:7px;background:white;cursor:pointer}.hypotheses button[aria-pressed=true]{background:#dbeafe;border-color:#2563eb}.resnet-question pre{max-height:520px;overflow:auto;padding:16px;background:#f8fafc;font-size:12px;line-height:1.6}.resnet-story :deep(.app-shell){min-height:0}.resnet-story :deep(.workspace){grid-template-columns:210px minmax(0,1fr) 220px}@media(max-width:1150px){.resnet-story :deep(.workspace){grid-template-columns:190px minmax(0,1fr)}.resnet-story :deep(.right-panel){grid-column:1/-1}}@media(max-width:750px){.resnet-story :deep(.workspace){grid-template-columns:1fr}}
</style>
