<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
const props=withDefaults(defineProps<{pixels:number[][];label:string;min?:number;max?:number}>(),{min:0,max:1})
const canvas=ref<HTMLCanvasElement>()
function draw(){if(!canvas.value)return;const h=props.pixels.length,w=props.pixels[0].length;canvas.value.width=w;canvas.value.height=h;const ctx=canvas.value.getContext('2d')!;const image=ctx.createImageData(w,h);props.pixels.flat().forEach((v,i)=>{const gray=Math.round(Math.max(0,Math.min(1,(v-props.min)/Math.max(1e-9,props.max-props.min)))*255);image.data.set([gray,gray,gray,255],i*4)});ctx.putImageData(image,0,0)}
onMounted(draw);watch(()=>[props.pixels,props.min,props.max],draw)
</script>
<template><figure class="pixel-plane"><canvas ref="canvas" role="img" :aria-label="label"/><figcaption>{{label}}</figcaption></figure></template>
<style scoped>.pixel-plane{margin:0;min-width:120px}.pixel-plane canvas{width:100%;aspect-ratio:1;image-rendering:pixelated;display:block;border:1px solid #cbd5e1}.pixel-plane figcaption{font-size:12px;margin-top:8px}</style>
