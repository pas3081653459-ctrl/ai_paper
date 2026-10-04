<script setup lang="ts">
defineProps<{ title: string; options: readonly string[]; value?: string; checked?: boolean; correct: string; explanation: string }>()
defineEmits<{ answer: [value: string]; check: [] }>()
</script>
<template>
  <fieldset class="evidence-question">
    <legend>{{ title }}</legend>
    <div class="controls"><button v-for="option in options" :key="option" :aria-pressed="value === option" @click="$emit('answer', option)">{{ option }}</button><button :disabled="!value || checked" @click="$emit('check')">核对判断</button></div>
    <p v-if="checked" role="status"><strong>{{ value === correct ? '判断成立。' : '再检查证据：' }}</strong>{{ explanation }}</p>
  </fieldset>
</template>
<style scoped>.evidence-question{border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin:22px 0}.evidence-question legend{font-weight:600;padding:0 6px}</style>
