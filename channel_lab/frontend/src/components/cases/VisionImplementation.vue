<script setup lang="ts">
import worker from '../../../../backend/vision_worker.py?raw'
import api from '../../../../backend/vision_api.py?raw'
</script>
<template><details class="vision-code"><summary>本地模型如何计算？读取实际适配源码</summary><p>这是当前接口调用的PyTorch/Transformers适配器，不是模拟输出脚本。ViT显式读取patch投影与位置相加；SAM分开图像编码与提示解码；LLaVA逐token argmax解码。加载的是已有模型类，不复现论文训练。</p><details><summary>vision_worker.py：完整前向和记录生成</summary><pre><code>{{worker}}</code></pre></details><details><summary>vision_api.py：配置、输入校验与路由</summary><pre><code>{{api}}</code></pre></details></details></template>
<style scoped>.vision-code{margin:20px 0;padding:16px;border:1px solid #dbe3ed;border-radius:8px}.vision-code pre{max-height:480px;overflow:auto;white-space:pre;font-size:12px}.vision-code summary{cursor:pointer}</style>
