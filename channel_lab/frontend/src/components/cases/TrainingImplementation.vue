<script setup lang="ts">
import api from '../../../../backend/training_api.py?raw'
import worker from '../../../../backend/training_worker.py?raw'
import decoder from '../../../../backend/language_worker.py?raw'
import validation from '../../papers/trainingTraces.ts?raw'
</script>
<template><details class="paper-lab"><summary>实际代码：评分、生成、答案核验与组内标准化</summary><p>13只做读者评价/真实记录回放；14/22/24按需使用已有本地GPT-2替代模型，没有训练入口。公开输出、工具实际返回与模型损失不混为一种数据。</p><details><summary>training_api.py：输入限制与离线worker</summary><pre>{{api}}</pre></details><details><summary>training_worker.py：采样与对齐NLL</summary><pre>{{worker}}</pre></details><details><summary>language_worker.py：复用的显式贪心解码</summary><pre>{{decoder}}</pre></details><details><summary>trainingTraces.ts：独立核验</summary><pre>{{validation}}</pre></details></details></template>
