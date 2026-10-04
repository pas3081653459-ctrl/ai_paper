<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ActivationPhoto from './ActivationPhoto.vue'
import { values, type Result, type Feature } from '../types'
const props=defineProps<{result:Result; block:number}>()
const channel=ref(0),row=ref(0),col=ref(0),opacity=ref(.65),angle=ref(-16),spatial=ref(false)
const nodes=[{key:'shortcut',name:'① 捷径 s(x)'},{key:'main',name:'② 主分支 F(x)'},{key:'sum',name:'③ 逐元素相加'},{key:'output',name:'④ ReLU 输出'}]
const feature=(key:string):Feature=>props.result.models.resnet.features[`block${props.block}.${key}`]
const output=computed(()=>feature('output'))
const range=computed<[number,number]>(()=>{
 const fs=nodes.map(n=>feature(n.key));const limit=Math.max(1e-8,...fs.map(f=>Math.max(Math.abs(f.min),Math.abs(f.max))))
 return [-limit,limit]
})
const scalar=(key:string)=>values(feature(key))[channel.value*output.value.shape[2]*output.value.shape[3]+row.value*output.value.shape[3]+col.value]
const n=(v:number)=>v.toFixed(6)
watch(()=>[props.result,props.block],()=>{channel.value=0;row.value=0;col.value=0},{flush:'sync'})
function pick(r:number,c:number){row.value=r;col.value=c}
</script>
<template>
 <section class="photo-lab">
  <h3>同一张照片，追踪一个通道、一处位置</h3>
  <p>先把叠加透明度拉到 0 找到照片部位，再逐渐显示响应。点击任意一张图，四个节点一起定位。</p>
  <div class="photo-lab-controls">
   <label>通道 {{channel}}<input v-model.number="channel" type="range" min="0" :max="output.shape[1]-1"/></label>
   <label>行 {{row}}<input v-model.number="row" type="range" min="0" :max="output.shape[2]-1"/></label>
   <label>列 {{col}}<input v-model.number="col" type="range" min="0" :max="output.shape[3]-1"/></label>
   <label>响应叠加 {{Math.round(opacity*100)}}%<input v-model.number="opacity" type="range" min="0" max="1" step=".05"/></label>
   <label><input v-model="spatial" type="checkbox"/> 展开为空间面板</label>
   <label v-if="spatial">视角<input v-model.number="angle" type="range" min="-35" max="25"/></label>
  </div>
  <div class="photo-lab-viewport"><div class="photo-lab-grid" :class="{spatial}" :style="{'--photo-angle':`${angle}deg`}">
   <ActivationPhoto v-for="node in nodes" :key="node.key" :image="result.preprocessed" :feature="feature(node.key)" :channel="channel" :range="range" :row="row" :col="col" :opacity="opacity" :title="node.name" @pick="pick"/>
  </div></div>
  <div class="photo-equation" aria-live="polite"><strong>当前像素的真实前向数值</strong><code>s(x) + F(x) = {{n(scalar('shortcut'))}} + {{n(scalar('main'))}} ≈ {{n(scalar('sum'))}}</code><code>max(0, {{n(scalar('sum'))}}) = {{n(scalar('output'))}}</code><span>{{scalar('sum')<0?'这里相加后的负响应被 ReLU 置零。':scalar('main')*scalar('shortcut')<0?'两条路径符号相反，响应在这里相互抵消。':'两条路径在这里相加；亮度本身不说明对猫或狗的分类贡献。'}}</span></div>
  <p class="photo-lab-note">统一色标：蓝色 −{{range[1].toFixed(3)}}，深色 0，橙色 +{{range[1].toFixed(3)}}。这是通道激活，不是 Grad-CAM。图片与特征图按空间坐标叠加，不代表精确感受野或物体边界。{{block===1?'本块 s(x)=x。':'本块 s(x) 经 1×1 卷积和 BN 对齐，不能直接与原输入逐点相加。'}}空间厚度只区分面板，不是新数据维度。</p>
 </section>
</template>
<style scoped>
.photo-lab{margin:20px 0;padding:20px;background:#f8fafc;border:1px solid #dbe3ed;border-radius:12px;color:#172033}.photo-lab h3{margin:0 0 8px}.photo-lab p{line-height:1.7;font-size:13px}.photo-lab-controls{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0}.photo-lab-controls label{font-size:12px;display:grid;gap:5px}.photo-lab-viewport{perspective:1200px;overflow:auto;padding:12px 3px}.photo-lab-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:16px}.photo-lab-grid.spatial{transform:rotateX(var(--photo-angle));transform-style:preserve-3d}.spatial :deep(figure){box-shadow:6px 8px 0 #dbe3ed}.photo-equation{display:grid;gap:8px;padding:14px;background:white;margin-top:12px;overflow-wrap:anywhere}.photo-equation code{white-space:normal;font-size:12px}.photo-equation span,.photo-lab-note{font-size:12px;color:#475569}@media(max-width:700px){.photo-lab-grid{grid-template-columns:repeat(2,minmax(110px,1fr))}}
</style>
