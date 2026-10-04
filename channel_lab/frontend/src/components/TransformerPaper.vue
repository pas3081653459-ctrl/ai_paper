<script setup lang="ts">
import TransformerLesson from '../TransformerLesson.vue'
import {paperPdf} from '../papers/paperAssets'
import '../paperResearch.css'
defineEmits<{openModel:[]}>()
</script>
<template><section class="transformer-story"><TransformerLesson paper-mode/>
<details class="translation-bridge"><summary>刚才的自注意力，与原文翻译器有什么不同？</summary><p>上方是Pre-LN单块算例。原文是Post-LN Encoder–Decoder：目标端不仅读取自己的历史，还通过交叉注意力读取源句。网页词表输出不能当作训练好的翻译。</p><div class="translation-path"><div><strong>源句 · 3 个位置</strong><span>Encoder 输出 K / V</span><code>[B, 3, C]</code></div><b>→ 被读取</b><div><strong>目标前缀 · 2 个位置</strong><span>Decoder 提供 Q</span><code>[B, 2, C]</code></div><b>→</b><div><strong>目标 × 源位置</strong><span>每个目标Query在源端找信息</span><code>[B, H, 2, 3]</code></div></div><button @click="$emit('openModel')">打开交叉注意力算例 →</button><a :href="paperPdf('04',3)" target="_blank" rel="noopener">原文Figure 1：Encoder–Decoder ↗</a><p>较短的信息路径不等于实测更快。翻译成绩、头数消融和实际控制条件请展开下方“原文对照”。</p></details></section></template>
<style scoped>
.translation-bridge{padding:20px;background:white;border:1px solid #dbe3ed;border-radius:12px;margin:18px 0}.translation-bridge summary{cursor:pointer;font-weight:600}.transformer-story p{color:#475569;line-height:1.8}.transformer-story :deep(.lesson-layout){padding:18px 0;grid-template-columns:160px minmax(0,1fr)}.translation-path{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:20px 0}.translation-path div{display:grid;gap:8px;padding:18px;background:#eff6ff}.translation-path span{font-size:13px}.translation-bridge button{padding:12px;border:1px solid #93c5fd;background:#eff6ff;border-radius:6px;cursor:pointer}.translation-bridge a{display:block;margin:14px 0}@media(max-width:850px){.transformer-story :deep(.lesson-layout){grid-template-columns:1fr}.transformer-story :deep(.lesson-sidebar){position:static}}
</style>
