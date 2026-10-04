<script setup lang="ts">
import { onMounted,onUnmounted,ref } from 'vue'
import cat from '../../assets/vision-lab/cat.jpg'
import dog from '../../assets/vision-lab/dog.jpg'
import type { LabPhoto } from '../../papers/visionInputs'
const emit=defineEmits<{change:[photo:LabPhoto]}>()
const error=ref(''),loading=ref(false)
let ticket=0,disposed=false
async function decode(blob:Blob,source:string,id:number){
  const bitmap=await createImageBitmap(blob)
  try{
    if(disposed||id!==ticket)return
    if(bitmap.width*bitmap.height>20_000_000)throw Error('图片请不超过2000万像素')
    const scale=Math.min(1,768/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
    const c=canvas.getContext('2d')!;c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(bitmap,0,0,canvas.width,canvas.height)
    emit('change',{url:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,source})
  }finally{bitmap.close()}
}
async function sample(kind:'cat'|'dog'){
  const id=++ticket;loading.value=true;error.value=''
  try{const r=await fetch(kind==='cat'?cat:dog);if(!r.ok)throw Error('固定照片无法读取');await decode(await r.blob(),`Oxford-IIIT Pet / ${kind==='cat'?'Abyssinian_1':'beagle_1'}（仅作输入案例）`,id)}catch(e){if(!disposed&&id===ticket)error.value=String(e)}finally{if(!disposed&&id===ticket)loading.value=false}
}
async function upload(e:Event){
  const file=(e.target as HTMLInputElement).files?.[0];if(!file)return
  const id=++ticket;loading.value=true;error.value=''
  try{if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择10MB以内的PNG/JPEG/WebP');await decode(file,'用户本地图片',id)}catch(e){if(!disposed&&id===ticket)error.value=String(e)}finally{if(!disposed&&id===ticket)loading.value=false}
  ;(e.target as HTMLInputElement).value=''
}
onMounted(()=>sample('cat'));onUnmounted(()=>{disposed=true;++ticket})
</script>
<template><div class="photo-picker"><div class="controls"><button @click="sample('cat')">猫照片</button><button @click="sample('dog')">狗照片</button><label>换成自己的照片<input type="file" accept="image/png,image/jpeg,image/webp" @change="upload"></label></div><p v-if="loading" role="status">读取照片…</p><p v-if="error" role="alert">{{error}}</p><p class="note">照片按比例缩至最长边768，透明背景变白；这张实验图的像素坐标用于后续操作。只在点击模型运行时发送到当前网站后端，不调用第三方推理服务。</p></div></template>
