<script setup lang="ts">
import type {VisionConfig} from '../../papers/useVisionModel'
defineProps<{config:VisionConfig|null;busy:boolean;error:string}>()
defineEmits<{refresh:[];cancel:[]}>()
</script>
<template><aside class="vision-status" :aria-busy="busy"><p role="status">{{busy?'正在加载模型或计算结果…':config?.configured?'模型文件已配置，可尝试运行':config?'未配置模型，可先操作照片或导入记录':'正在等待模型配置状态；照片操作仍可使用'}}</p><p v-if="error" role="alert">{{error}}</p><div class="controls"><button :disabled="busy" @click="$emit('refresh')">检查配置</button><button v-if="busy" @click="$emit('cancel')">取消当前推理</button></div><details><summary>{{config&&!config.configured?'启用真实推理需要什么？':'查看设备、时限与配置详情'}}</summary><p>照片编辑不需要模型；实际分类、分割或回答需要匹配的本地权重。文件存在检查通过不代表加载已成功。</p><ul v-if="config&&!config.configured"><li v-for="problem in config.problems" :key="problem">{{problem}}</li></ul><p v-if="config">设备 {{config.device}} / {{config.dtype}} · 最长等待 {{config.timeout_seconds}} 秒</p><p>按项目 channel_lab/IMAGE_CATEGORY.md 配置后点击“检查配置”。网页不会下载权重。</p></details></aside></template>
<style scoped>.vision-status{padding:14px;border:1px solid #dbe3ed;border-radius:8px;margin:16px 0;background:#f8fafc}.vision-status p{font-size:13px}.vision-status ul{font-size:12px;overflow-wrap:anywhere}</style>
