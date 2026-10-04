<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import type { CellIndex, TensorNode } from '../transformerTrace'
const props=defineProps<{ node: Pick<TensorNode, 'title'|'slices'|'axes'|'probability'> & { key: string }; selection: CellIndex; words: string[]; planeLabels?: string[]; note?: string }>()
const emit=defineEmits<{ select: [cell: CellIndex] }>()
const viewport=ref<HTMLDivElement>()
const angleX=ref(-18), angleY=ref(-28), zoom=ref(1), spread=ref(true), width=ref(600), height=ref(360)
const rows=computed(()=>props.node.slices[0].length), cols=computed(()=>props.node.slices[0][0].length)
const planeWidth=computed(()=>cols.value*44), planeHeight=computed(()=>rows.value*44)
const totalWidth=computed(()=>spread.value?props.node.slices.length*(planeWidth.value+66)-66:planeWidth.value)
const fit=computed(()=>Math.min(1,Math.max(120,width.value-115)/(totalWidth.value+70),Math.max(100,height.value-120)/(planeHeight.value+60)))
const max=computed(()=>Math.max(.001,...props.node.slices.flat(2).filter(Number.isFinite).map(Math.abs)))
const transform=computed(()=>`translate(-50%,-50%) scale(${fit.value*zoom.value}) rotateX(${angleX.value}deg) rotateY(${angleY.value}deg)`)
const numeric=(v:number)=>Number.isFinite(v)?v.toFixed(2):'−∞'
function cellStyle(v:number):CSSProperties {
  const intensity=Math.min(1,Math.abs(v)/(props.node.probability?1:max.value))
  const color=!Number.isFinite(v)?'#d5d9df':v>=0?`hsl(214 78% ${94-intensity*48}%)`:`hsl(28 85% ${94-intensity*44}%)`
  return {'--cell-color':color,color:intensity>.6?'white':'#1e293b'} as CSSProperties
}
function planeStyle(h:number):CSSProperties {
  const x=spread.value?h*(planeWidth.value+66):0
  const z=spread.value?0:(props.node.slices.length-1-h)*80
  return {width:`${planeWidth.value}px`,height:`${planeHeight.value}px`,transform:`translate3d(${x}px,0,${z}px)`}
}
function chosen(h:number,r:number,c:number) {return props.selection.slice===h&&props.selection.row===r&&props.selection.col===c}
let observer:ResizeObserver|undefined
let down:{x:number;y:number;ax:number;ay:number;id:number}|null=null
let dragged=false
function start(e:PointerEvent) {
  if(e.button!==0 || (e.target as HTMLElement).closest('input,select')) return
  down={x:e.clientX,y:e.clientY,ax:angleX.value,ay:angleY.value,id:e.pointerId}; dragged=false
  // 容器捕获拖动；抬起时按实际命中的格子选择，键盘选择单独处理。
  viewport.value?.setPointerCapture(e.pointerId)
}
function move(e:PointerEvent) {
  if(!down||e.pointerId!==down.id) return
  const dx=e.clientX-down.x,dy=e.clientY-down.y
  if(Math.hypot(dx,dy)>5) dragged=true
  if(dragged) {angleX.value=Math.max(-65,Math.min(55,down.ax-dy*.35));angleY.value=Math.max(-70,Math.min(70,down.ay+dx*.35))}
}
function end(e:PointerEvent) {
  if(!down) return
  if(!dragged && e.type!=='pointercancel') {
    // 容器 pointer capture 会改变 click target；用实际抬起位置找当前格子。
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-cell]')
    if(target&&viewport.value?.contains(target)) {
      const [slice,row,col]=(target.dataset.cell??'').split(',').map(Number)
      emit('select',{slice,row,col})
    }
  }
  if(viewport.value?.hasPointerCapture(e.pointerId)) viewport.value.releasePointerCapture(e.pointerId)
  down=null
}
function keyboardSelect(event:MouseEvent,h:number,r:number,c:number) {if(event.detail===0)emit('select',{slice:h,row:r,col:c})}
function cancelDrag() {down=null}
function reset() {angleX.value=-18;angleY.value=-28;zoom.value=1;spread.value=true}
onMounted(()=>{if(viewport.value){observer=new ResizeObserver(entries=>{width.value=entries[0].contentRect.width;height.value=entries[0].contentRect.height});observer.observe(viewport.value)}})
onUnmounted(()=>observer?.disconnect())
</script>

<template>
 <div class="tensor-volume">
  <div class="volume-toolbar"><strong>3D 张量 · {{node.title}}</strong><div><button :aria-pressed="!spread" :disabled="node.slices.length===1" @click="spread=!spread">{{spread?'叠放平面':'展开平面'}}</button><button @click="angleX=0;angleY=0">正面</button><button @click="reset">重置视角</button></div></div>
  <div ref="viewport" class="volume-viewport" @pointerdown="start" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="cancelDrag">
   <div class="volume-grid-floor" aria-hidden="true"></div>
   <div class="tensor-world" :style="{width:`${totalWidth}px`,height:`${planeHeight}px`,transform}">
    <div v-for="(matrix,h) in node.slices" :key="h" class="tensor-plane" :class="{'active-plane':selection.slice===h}" :style="planeStyle(h)">
     <div class="plane-caption">{{planeLabels?.[h] ?? (node.slices.length>1?`H=${h} · Head ${h+1}`:'B=0')}} <span>[{{rows}}, {{cols}}]</span></div>
     <span class="axis-horizontal">→ {{node.key==='ids'?'编号':node.axes[node.axes.length-1]}}（{{cols}}）</span>
     <span class="axis-vertical">↓ {{node.key==='ids'?'T':node.axes[node.axes.length-2]}}（{{rows}}）</span>
     <template v-for="(row,r) in matrix" :key="r">
      <span class="tensor-row-label" :title="words[r]" :style="{top:`${r*44+12}px`}">{{words[r]}}</span>
      <div v-for="(value,c) in row" :key="c" class="tensor-voxel" :class="{selected:chosen(h,r,c), 'query-row':selection.row===r,masked:!Number.isFinite(value)}" :style="{left:`${c*44}px`,top:`${r*44}px`,...cellStyle(value)}">
       <button class="voxel-front" :data-cell="`${h},${r},${c}`" :aria-pressed="chosen(h,r,c)" :aria-label="`${node.title}，平面${h}，行${r}，列${c}，值${numeric(value)}`" @click="keyboardSelect($event,h,r,c)">{{numeric(value)}}</button>
       <span class="voxel-right" aria-hidden="true"></span><span class="voxel-top" aria-hidden="true"></span>
      </div>
     </template>
    </div>
   </div>
   <span class="volume-drag-hint">拖动旋转 · 点击格子追踪数值</span>
  </div>
  <div class="volume-controls"><label>左右旋转 <input v-model.number="angleY" type="range" min="-70" max="70" aria-label="张量左右旋转"/></label><label>上下旋转 <input v-model.number="angleX" type="range" min="-65" max="55" aria-label="张量上下旋转"/></label><label>缩放 <input v-model.number="zoom" type="range" min="0.5" max="1.7" step="0.05" aria-label="张量缩放"/></label></div>
  <div class="volume-legend"><span><i class="legend-negative"></i>负值</span><span><i class="legend-zero"></i>接近零</span><span><i class="legend-positive"></i>正值</span><span><i class="legend-mask"></i>−∞ 遮罩</span><span>色标：{{node.probability?'0…1':`±${max.toFixed(2)}（当前张量）`}}</span></div>
  <p v-if="note" class="volume-footnote">{{note}}</p>
  <p v-else class="volume-footnote">每个小块代表一个标量；行是 token{{node.key==='ids'?'，每行展示一个编号':node.axes.includes('T_key')?'，列是被读取的 token':'，列是特征或候选词'}}。{{node.slices.length>1?'每个平面是一个注意力头，批次 B=1 未展开。':'仅展示批次 B=0。'}}立体厚度用于辨认格子，不是额外张量维度。</p>
 </div>
</template>
