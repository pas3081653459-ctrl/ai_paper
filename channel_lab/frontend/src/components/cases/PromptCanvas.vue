<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import type { LabPhoto,PromptBox,PromptPoint } from '../../papers/visionInputs'
const props=defineProps<{photo:LabPhoto;tool:'positive'|'negative'|'box';points?:PromptPoint[];box?:PromptBox|null;mask?:string;opacity?:number}>()
const emit=defineEmits<{point:[point:PromptPoint];box:[box:PromptBox]}>()
const start=ref<[number,number]|null>(null),end=ref<[number,number]|null>(null)
const draft=computed<PromptBox|null>(()=>start.value&&end.value?[Math.min(start.value[0],end.value[0]),Math.min(start.value[1],end.value[1]),Math.max(start.value[0],end.value[0]),Math.max(start.value[1],end.value[1])]:null)
function xy(event:PointerEvent):[number,number]{const r=(event.currentTarget as SVGSVGElement).getBoundingClientRect();return [Math.max(0,Math.min(props.photo.width-1,Math.round((event.clientX-r.left)/r.width*props.photo.width))),Math.max(0,Math.min(props.photo.height-1,Math.round((event.clientY-r.top)/r.height*props.photo.height)))]}
function down(e:PointerEvent){if(e.button!==0)return;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);start.value=xy(e);end.value=start.value}
function move(e:PointerEvent){if(start.value)end.value=xy(e)}
function up(e:PointerEvent){if(!start.value)return;end.value=xy(e);if(props.tool==='box'){if(draft.value&&draft.value[2]-draft.value[0]>=2&&draft.value[3]-draft.value[1]>=2)emit('box',draft.value)}else emit('point',{x:end.value[0],y:end.value[1],label:props.tool});start.value=null;end.value=null}
watch(()=>[props.photo,props.tool],()=>{start.value=null;end.value=null})
</script>
<template><svg class="prompt-canvas" :viewBox="`0 0 ${photo.width} ${photo.height}`" :style="{aspectRatio:`${photo.width}/${photo.height}`}" role="img" aria-label="照片提示画布；可点击添加点或拖动框，也可使用下方数值输入" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="start=null;end=null"><image :href="photo.url" :width="photo.width" :height="photo.height"/><image v-if="mask" :href="mask" :width="photo.width" :height="photo.height" :opacity="opacity??.6"/><rect v-if="box" :x="box[0]" :y="box[1]" :width="box[2]-box[0]" :height="box[3]-box[1]" fill="none" stroke="#f59e0b" stroke-width="3" vector-effect="non-scaling-stroke"/><rect v-if="draft&&tool==='box'" :x="draft[0]" :y="draft[1]" :width="draft[2]-draft[0]" :height="draft[3]-draft[1]" fill="#f59e0b33" stroke="#f59e0b" stroke-width="2" vector-effect="non-scaling-stroke"/><g v-for="(p,i) in points??[]" :key="i"><circle :cx="p.x" :cy="p.y" :r="Math.max(photo.width/85,3)" :fill="p.label==='positive'?'#22c55e':'#ef4444'" stroke="white"/><text :x="p.x" :y="p.y+photo.width/200" text-anchor="middle" :font-size="Math.max(photo.width/65,5)" fill="black">{{p.label==='positive'?'+':'−'}}</text></g></svg></template>
<style scoped>.prompt-canvas{display:block;max-width:680px;width:100%;height:auto;touch-action:none;cursor:crosshair;user-select:none;background:#f1f5f9}</style>
