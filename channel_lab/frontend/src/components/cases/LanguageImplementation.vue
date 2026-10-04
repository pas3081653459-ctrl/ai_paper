<script setup lang="ts">
import worker from '../../../../backend/language_worker.py?raw'
import api from '../../../../backend/language_api.py?raw'
import cases from '../../../../backend/context_cases.json?raw'
</script>
<template><details class="paper-lab"><summary>实际执行代码：分词、模型前向、解码和评分</summary><p>06/07/08 的本地适配代码；05 只读取外部训练记录，没有训练入口。模型类使用 Transformers，前向、softmax、argmax、KV 缓存和提示拼接在这里显式展开。</p><details><summary>language_worker.py</summary><pre><code>{{worker}}</code></pre></details><details><summary>language_api.py</summary><pre><code>{{api}}</code></pre></details><details><summary>固定示例与测试题（本站编写，答案仅用于评分）</summary><pre>{{cases}}</pre></details></details></template>
