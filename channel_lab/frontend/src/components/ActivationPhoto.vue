<script setup lang="ts">
import { computed, ref } from 'vue'
import Heatmap from './Heatmap.vue'
import { values, type Feature } from '../types'
const props=defineProps<{image:string; feature:Feature; channel:number; range:[number,number]; row:number; col:number; opacity:number; title:string}>()
const emit=defineEmits<{pick:[row:number,col:number]}>()
const surface=ref<HTMLButtonElement>()
const height=computed(()=>props.feature.shape[2])
const width=computed(()=>props.feature.shape[3])
const value=computed(()=>values(props.feature)[props.channel*height.value*width.value+props.row*width.value+props.col])
function pick(event:MouseEvent){
 // 子图不接收指针；offset 坐标位于按钮本地空间，不受 3D 视角投影缩放影响。
 if(event.detail===0)return // 键盘通过行/列滑块精确选点，不跳到屏幕原点。
 const target=surface.value!
 emit('pick',Math.max(0,Math.min(height.value-1,Math.floor(event.offsetY/target.clientHeight*height.value))),Math.max(0,Math.min(width.value-1,Math.floor(event.offsetX/target.clientWidth*width.value))))
}
</script>
<template>
 <figure class="activation-photo">
  <figcaption>{{title}} <code>[{{feature.shape.slice(1).join(', ')}}]</code></figcaption>
  <button ref="surface" class="activation-surface" :aria-label="`${title}，点击空间位置；也可用下方行列滑块选择`" @click="pick">
   <img :src="image" alt="模型实际接收的图片"/>
   <Heatmap :feature="feature" :channel="channel" scale="shared" :range="range" :signed="true" :style="{opacity}"/>
   <i :style="{left:`${(col+.5)/width*100}%`,top:`${(row+.5)/height*100}%`}"/>
  </button>
  <small>[CH {{channel}}, {{row}}, {{col}}] = {{value?.toFixed(6)}}</small>
 </figure>
</template>
<style scoped>
.activation-photo{margin:0;min-width:0}.activation-photo figcaption{display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between;margin-bottom:8px;font-size:13px}.activation-photo code{font-size:11px;color:#64748b}.activation-surface{position:relative;display:block;width:100%;aspect-ratio:1;padding:0;border:1px solid #cbd5e1;background:#fff;cursor:crosshair;overflow:hidden}.activation-surface img,.activation-surface :deep(canvas){position:absolute;inset:0;width:100%;height:100%;object-fit:fill;image-rendering:pixelated}.activation-surface i{position:absolute;width:14px;height:14px;border:2px solid white;outline:1px solid #111;transform:translate(-50%,-50%);pointer-events:none}.activation-photo small{display:block;margin-top:6px;font-family:monospace;font-size:11px}
</style>
<style scoped>
.activation-surface img,.activation-surface :deep(canvas){pointer-events:none}
</style>
