<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { values, type Feature } from '../types'
const props = defineProps<{feature: Feature; channel: number; scale: 'channel' | 'shared'; range?: [number, number]; signed?: boolean}>()
const canvas = ref<HTMLCanvasElement>()
function draw() {
  if (!canvas.value) return
  const [, , h, w] = props.feature.shape
  canvas.value.width = w; canvas.value.height = h
  const ctx = canvas.value.getContext('2d')!
  const pixels = ctx.createImageData(w, h)
  const stats = props.feature.channels[props.channel]
  if (!stats) return
  const [min, max] = props.scale === 'shared' && props.range ? props.range : [stats.min, stats.max]
  const signed = props.signed ?? min < 0
  const extent = Math.max(Math.abs(min), Math.abs(max), 1e-8)
  const data = values(props.feature)
  for (let i = 0; i < w*h; i++) {
    const v = data[props.channel*w*h+i]!
    let color: number[]
    if (signed) {
      const t = Math.min(1, Math.abs(v)/extent)
      const end = v >= 0 ? [242,174,79] : [74,149,234]
      color = [29,34,36].map((x,j) => x+(end[j]!-x)*t)
    } else {
      const t = max-min < 1e-8 ? 0 : Math.max(0, Math.min(1, (v-min)/(max-min)))
      const stops = [[18,24,30], [52,61,117], [44,125,143], [99,184,145], [224,235,145]]
      const idx = Math.min(3, Math.floor(t*4)); const part = t*4-idx
      color = stops[idx]!.map((x,j) => x+(stops[idx+1]![j]!-x)*part)
    }
    pixels.data.set([...color.map(Math.round),255],i*4)
  }
  ctx.putImageData(pixels,0,0)
}
onMounted(draw)
watch(() => [props.feature, props.channel, props.scale, props.range, props.signed], draw)
</script>
<template><canvas ref="canvas" class="heatmap" role="img" :aria-label="`通道 ${channel + 1} 特征热力图`" /></template>
