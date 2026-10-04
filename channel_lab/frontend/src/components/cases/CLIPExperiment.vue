<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import source from '../../../../backend/clip_worker.py?raw'
type Result={texts:string[];cosine:number[];logits:number[];probabilities:number[];logit_scale:number;model_view:string;image_vector:number[];text_vectors:number[][];pixel_shape:number[];image_shape:number[];text_shape:number[];input_sha256:string;[key:string]:unknown}
const config=ref<{configured:boolean;problems:string[]}|null>(null)
const photo=ref(''),texts=ref('a photo of a cat\na photo of a dog\na photo of a bicycle'),error=ref(''),busy=ref(false)
const result=ref<Result|null>(null),previous=ref<Result|null>(null),dimension=ref(0),selected=ref(0)
let controller:AbortController|undefined,disposed=false,uploadId=0
const candidates=computed(()=>texts.value.split('\n').map(t=>t.trim()).filter(Boolean))
const ranking=computed(()=>result.value?result.value.texts.map((text,i)=>({text,i,score:result.value!.cosine[i]})).sort((a,b)=>b.score-a.score):[])
const dirty=computed(()=>!!result.value && JSON.stringify(result.value.texts)!==JSON.stringify(candidates.value))
async function refresh(){try{const r=await fetch('/api/experiments/clip/config');if(!r.ok)throw Error('无法读取 CLIP 配置');const c=await r.json();if(!disposed)config.value=c}catch(e){if(!disposed)error.value=String(e)}}
function cancel(){controller?.abort()}
async function upload(event:Event){
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return
 const ticket=++uploadId;error.value='';controller?.abort();result.value=null;previous.value=null
 if(file.size>10*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){error.value='请选择 10 MB 以内 PNG/JPEG/WebP';return}
 try{const bitmap=await createImageBitmap(file);if(disposed||ticket!==uploadId){bitmap.close();return}
  const c=document.createElement('canvas'),scale=Math.min(1,768/Math.max(bitmap.width,bitmap.height));c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale))
  const ctx=c.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();photo.value=c.toDataURL('image/jpeg',.92)
 }catch{error.value='图片无法解码'}
}
async function run(){
 if(busy.value)return;busy.value=true;error.value='';controller=new AbortController();const requestController=controller
 try{const response=await fetch('/api/experiments/clip/compare',{method:'POST',headers:{'Content-Type':'application/json'},signal:requestController.signal,body:JSON.stringify({image_base64:photo.value.split(',')[1],texts:candidates.value})});const data=await response.json();if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));if(!disposed&&!requestController.signal.aborted){previous.value=result.value;result.value=data;selected.value=0;dimension.value=0}}
 catch(e){if(!disposed&&!requestController.signal.aborted)error.value=String(e)}finally{if(!disposed)busy.value=false}
}
function download(){if(!result.value)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result.value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='clip-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
onMounted(refresh);onUnmounted(()=>{disposed=true;++uploadId;controller?.abort()})
</script>
<template>
 <section class="clip-lab">
  <h3>同一张照片，文字怎样改变候选类别？</h3>
  <p>先写下你认为最匹配的描述，再运行。试试把 “a dog” 改成 “a photo of a dog”，或添加另一条相近描述。</p>
  <div class="inputs"><div><input type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" aria-label="上传 CLIP 图片" @change="upload"><img v-if="photo" :src="photo" alt="上传后缩放的照片"><p>浏览器缩放至最长边 768，JPEG 编码；点击运行才发送给本机后端。</p></div><label>候选英文描述（每行一条，2–8 条）<textarea v-model="texts" rows="7" :disabled="busy"/></label></div>
  <p v-if="config&&!config.configured" class="notice">尚未配置：{{config.problems.join('；')}}。详见 channel_lab/REMAINING_SETUP.md。</p>
  <button :disabled="busy||!photo||!config?.configured||candidates.length<2||candidates.length>8" @click="run">{{busy?'实际编码中…':'比较真实图文相似度'}}</button> <button v-if="busy" @click="cancel">取消</button> <button @click="refresh">刷新配置</button>
  <p v-if="error" role="alert">{{error}}</p><p v-if="dirty" class="notice">描述已修改，下方仍是上一次真实结果，请重新运行。</p>
  <template v-if="result">
   <div class="inputs"><figure><img :src="result.model_view" alt="模型实际接收的裁剪图"><figcaption>模型实际看到的区域 · [{{result.pixel_shape.join(', ')}}]</figcaption></figure><div><p>图片向量 [{{result.image_shape.join(', ')}}]；文字向量 [{{result.text_shape.join(', ')}}]</p><p>cos = normalize(image) · normalize(text)；logit = cos × {{result.logit_scale.toFixed(3)}}；候选内概率 = softmax(logits)。</p><p>增加候选会改变概率分母。得分不是定位热图，也不是校准后的正确率。</p></div></div>
   <table><thead><tr><th>排名 / 描述</th><th>余弦</th><th>logit</th><th>候选内概率</th></tr></thead><tbody><tr v-for="(row,rank) in ranking" :key="row.i"><td><button @click="selected=row.i">{{rank+1}} · {{row.text}}</button></td><td>{{row.score.toFixed(4)}}</td><td>{{result.logits[row.i].toFixed(3)}}</td><td><meter min="0" max="1" :value="result.probabilities[row.i]"/> {{(result.probabilities[row.i]*100).toFixed(1)}}%</td></tr></tbody></table>
   <details><summary>沿一个维度检查实际点积</summary><label>维度 {{dimension}}<input v-model.number="dimension" type="range" min="0" :max="result.image_vector.length-1"></label><p>{{result.texts[selected]}}：{{result.image_vector[dimension].toFixed(6)}} × {{result.text_vectors[selected][dimension].toFixed(6)}} = {{(result.image_vector[dimension]*result.text_vectors[selected][dimension]).toFixed(6)}}；所有维度相加得到 {{result.cosine[selected].toFixed(6)}}。</p></details>
   <details v-if="previous"><summary>上一次运行：同图 {{previous.input_sha256===result.input_sha256?'是':'否'}}</summary><p v-for="(text,i) in previous.texts" :key="i">{{text}} · cos {{previous.cosine[i].toFixed(4)}} · {{(previous.probabilities[i]*100).toFixed(1)}}%</p></details>
   <button @click="download">导出本次真实记录</button><details><summary>来源、输入与模型指纹</summary><pre>{{JSON.stringify(result,null,2)}}</pre></details>
  </template>
  <details><summary>实际图文编码与分数计算源码</summary><pre>{{source}}</pre></details>
  <p class="note">这里不训练。批内正负配对解释训练目标，而本页候选描述用于推理；英语 checkpoint 的中文表现不能默认等效。</p>
 </section>
</template>
<style scoped>
.clip-lab{background:white;border:1px solid #dbe3ed;border-radius:12px;padding:22px}.inputs{display:flex;flex-wrap:wrap;gap:24px}.inputs>div,.inputs>label{flex:1;min-width:240px}img{display:block;max-width:280px;max-height:280px;object-fit:contain;margin:16px 0}textarea{display:block;width:100%;margin-top:10px;padding:10px;box-sizing:border-box}p{line-height:1.7}button{padding:8px;border:1px solid #cbd5e1;background:white;border-radius:6px;cursor:pointer}button:disabled{opacity:.5}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #e2e8f0;padding:10px}figure{margin:0}.notice{background:#fff7ed;padding:12px}.note{font-size:12px;color:#64748b}pre{max-height:350px;overflow:auto;font-size:12px}summary{padding:12px 0;cursor:pointer}meter{width:70px}
</style>
