<script setup lang="ts">
import type { EvidenceBook } from '../../papers/evidenceNotebook'
defineProps<{ book: EvidenceBook; saved: boolean; completed: number; total: number }>()
defineEmits<{ notes: [value: string]; reset: []; download: [] }>()
</script>
<template>
  <footer class="evidence-notes">
    <p role="status">已核对 {{ completed }} / {{ total }} 项 · {{ saved ? '答案和笔记保存在此浏览器' : '本地保存不可用，可导出本次记录' }}</p>
    <label>我的结论：证据说明了什么，还不能说明什么？<textarea :value="book.notes" maxlength="4000" @input="$emit('notes', ($event.target as HTMLTextAreaElement).value)"/></label>
    <div class="controls"><button @click="$emit('download')">导出学习记录 JSON</button><button @click="$emit('reset')">清空本课记录并重做</button></div>
    <small>记录是你的判断，不是模型实验轨迹；操作参数刷新后回到固定案例。此进度不代替页面底部的“已学完”标记。</small>
  </footer>
</template>
<style scoped>.evidence-notes{border-top:1px solid #cbd5e1;margin-top:24px;padding-top:12px}.evidence-notes small{color:#64748b}</style>
