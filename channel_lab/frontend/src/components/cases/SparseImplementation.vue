<script setup lang="ts">
import routing from '../../../../recorders/export_mixtral.py?raw'
import recorder from '../../../../recorders/denoise_recorder.py?raw'
import validation from '../../papers/sparseTraces.ts?raw'
import loader from '../../papers/useRoutingPack.ts?raw'
</script>
<template><details class="paper-lab"><summary>代码与配置：离线记录如何进入页面</summary><p>配置见 channel_lab/SPARSE_CATEGORY.md。Mixtral导出工具需要用户自行准备本地权重；MMaDA适配器只记录真实采样状态，不负责生成，也未替代官方采样器。</p><details><summary>Mixtral：捕获gate、计算Top-k、导出分层文件</summary><pre>{{routing}}</pre></details><details><summary>MMaDA：实际状态快照适配器</summary><pre>{{recorder}}</pre></details><details><summary>记录校验</summary><pre>{{validation}}</pre></details><details><summary>层文件按需读取与SHA256校验</summary><pre>{{loader}}</pre></details></details></template>
