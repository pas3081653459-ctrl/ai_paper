<script setup lang="ts">
import rules from '../../papers/boardRules.ts?raw'
import search from '../../papers/ticSearch.ts?raw'
import traces from '../../papers/searchTraces.ts?raw'
</script>
<template><details class="paper-lab"><summary>实际代码：落子规则、UCT搜索和记录校验</summary><p>围棋规则只处理局部合法性；井字棋 UCT 使用随机 rollout，没有神经网络；真实网络输出仅来自外部记录。页面中损失数值是前向计算，不执行训练。</p><details><summary>boardRules.ts：提子、自杀、超级劫与井字棋终局</summary><pre><code>{{rules}}</code></pre></details><details><summary>ticSearch.ts：选择、扩展、模拟、回传</summary><pre><code>{{search}}</code></pre></details><details><summary>searchTraces.ts：树、访问数、π、检查点校验</summary><pre><code>{{traces}}</code></pre></details></details></template>
