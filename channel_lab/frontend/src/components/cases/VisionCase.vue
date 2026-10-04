<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { vision } from '../../papers/vision'
import { grid } from '../../papers/math'
import PixelPlane from './PixelPlane.vue'
const props=defineProps<{id:string}>()
const patch=ref(3),pixel=ref(-1),selected=ref(0),spread=ref(true)
const vit=computed(()=>vision('10',{patch:patch.value,pixel:pixel.value}))
const stage=(id:string)=>vit.value.stages.find(s=>s.id===id)!.slices[0]
watch(patch,()=>selected.value=0,{flush:'sync'})
const cat=grid(24,24,(r,c)=>{const head=(r-13)**2+(c-12)**2<75,ears=r>=3&&r<10&&((c>=4&&c<=4+(r-3))||(c<=20&&c>=20-(r-3)));const eye=r===11&&(c===9||c===15);return eye ? .05 : (head||ears) ? .85 : .12})
const picture=ref(cat),imageName=ref('程序绘制的猫形灰度图'),imageError=ref('')
let generation=0
onUnmounted(()=>generation++)
function resetPicture(){generation++;picture.value=cat;imageName.value='程序绘制的猫形灰度图';imageError.value=''}
async function upload(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;imageError.value='';if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){imageError.value='请选择 10MB 内的 PNG/JPG/WebP。';return}const current=++generation,url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(current!==generation)return;const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,24,24);const data=ctx.getImageData(0,0,24,24).data;picture.value=grid(24,24,(r,c)=>{const i=(r*24+c)*4;return (.299*data[i]+.587*data[i+1]+.114*data[i+2])/255});imageName.value=`${file.name} → 24×24 灰度`}catch{if(current===generation)imageError.value='无法读取该图片。'}finally{URL.revokeObjectURL(url)}}
const t=ref(6),error=ref(0),phase=ref('forward')
const noise=grid(24,24,(r,c)=>{const i=r*24+c+1;const frac=(n:number)=>n-Math.floor(n);const u=Math.max(1e-8,frac(Math.sin(i*127.1+17)*43758.5453)),v=frac(Math.sin(i*311.7+41)*12515.873);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)})
const abar=computed(()=>Array.from({length:t.value},(_,i)=>1-(.02+i*.18/19)).reduce((a,b)=>a*b,1))
const noisy=computed(()=>grid(24,24,(r,c)=>Math.sqrt(abar.value)*picture.value[r][c]+Math.sqrt(1-abar.value)*noise[r][c]))
const restored=computed(()=>grid(24,24,(r,c)=>(noisy.value[r][c]-Math.sqrt(1-abar.value)*(noise[r][c]+error.value*Math.sin(r+c+1)))/Math.sqrt(abar.value)))
const mse=computed(()=>restored.value.flat().reduce((s,v,i)=>s+(v-picture.value.flat()[i])**2,0)/576)
const prompts=ref<{x:number;y:number;positive:boolean}[]>([]),positive=ref(true),box=ref('none'),candidate=ref(0)
const regions=[{name:'整个人',x:55,y:30,w:95,h:195,contains:(x:number,y:number)=>((x-102)**2+(y-55)**2<25**2)||(x>=65&&x<=140&&y>=80&&y<=225)}, {name:'上衣',x:65,y:80,w:75,h:80,contains:(x:number,y:number)=>x>=65&&x<=140&&y>=80&&y<=160}, {name:'树冠',x:190,y:45,w:80,h:95,contains:(x:number,y:number)=>(x-230)**2/40**2+(y-92)**2/47**2<=1}]
const allowed=computed(()=>regions.map((r,i)=>prompts.value.every(p=>r.contains(p.x,p.y)===p.positive)&&(box.value==='none'||box.value==='person'&&i<2||box.value==='tree'&&i===2)))
function point(event:MouseEvent){const svg=event.currentTarget as SVGSVGElement,matrix=svg.getScreenCTM();if(!matrix)return;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());prompts.value=[...prompts.value,{x:p.x,y:p.y,positive:positive.value}]}
function preset(){prompts.value=[{x:102,y:115,positive:true},{x:100,y:190,positive:false}];box.value='none';candidate.value=1}
</script>
<template>
 <section class="case-scene">
  <template v-if="props.id==='10'">
   <div class="case-controls"><label>patch 边长<select v-model.number="patch"><option :value="2">2</option><option :value="3">3</option></select></label><label><input v-model="spread" type="checkbox"/> 空间展开</label><button @click="pixel=-1;selected=0">恢复图片</button></div>
   <div class="vision-layout"><div><h3>原图：点击改一个像素</h3><div class="gridimage" style="grid-template-columns:repeat(6,1fr)"><template v-for="(row,r) in vit.image" :key="r"><button v-for="(v,c) in row" :key="c" :aria-label="`像素 ${r},${c}`" :style="{background:`rgb(${Math.min(1,v)*255},${Math.min(1,v)*255},${Math.min(1,v)*255})`,borderRight:(c+1)%patch===0?'3px solid #60a5fa':'none',borderBottom:(r+1)%patch===0?'3px solid #60a5fa':'none'}" @click="pixel=pixel===r*6+c?-1:r*6+c"/></template></div></div><div><h3>选择一块，跟踪空间到序列</h3><div class="tokens"><button v-for="(_,i) in stage('patches')" :key="i" :aria-pressed="selected===i" @click="selected=i">patch {{i}}</button></div><p>所选块左上角：行 {{Math.floor(selected/(6/patch))*patch}}，列 {{selected%(6/patch)*patch}}。</p><div class="equation">按行展开 [{{stage('patches')[selected].map(v=>v.toFixed(2)).join(', ')}}]<br/>乘 W [{{patch*patch}},4] → [{{stage('embedding')[selected].map(v=>v.toFixed(3)).join(', ')}}]</div></div></div>
   <div class="spatial scroll"><div :class="spread?'planes':'tokens'"><div v-for="(row,i) in stage('embedding')" :key="i" class="plane" :style="{border:i===selected?'2px solid #2563eb':'1px solid #cbd5e1'}"><strong>patch {{i}}</strong><div v-for="(v,c) in row" :key="c">D{{c}}: {{v.toFixed(3)}}</div></div></div></div>
   <div class="equation">原图 [1,1,6,6] → patches [1,{{(6/patch)**2}},{{patch**2}}] → tokens [1,{{(6/patch)**2}},4]<br/>加 CLS 后 T={{(6/patch)**2+1}}，注意力关系数 T²={{((6/patch)**2+1)**2}}</div><p>被改像素只改变所属 patch 的初始嵌入；进入全局注意力后才可能影响其他位置。patch 越小，输入像素总数没变，关系表却变大。</p>
  </template>
  <template v-else-if="props.id==='11'">
   <div class="case-controls"><label>换成本地图片<input type="file" accept="image/png,image/jpeg,image/webp" @change="upload"/></label><button @click="resetPicture">恢复示例</button><label>t={{t}}<input v-model.number="t" type="range" min="1" max="20"/></label><label>预测误差 {{error.toFixed(2)}}<input v-model.number="error" type="range" min="0" max="1" step=".05"/></label></div><p v-if="imageError" role="alert">{{imageError}}</p><p>{{imageName}}；图片只在浏览器内缩放。</p>
   <div class="diffusion-images"><PixelPlane :pixels="picture" label="干净图 x₀" :min="-2" :max="2"/><PixelPlane :pixels="noisy" label="加噪图 xₜ" :min="-2" :max="2"/><PixelPlane :pixels="restored" label="由教学 ε̂ 估计的 x₀" :min="-2" :max="2"/></div><p class="hint">三图统一映射 −2…2 到灰度；超出范围只在显示时截断，MSE 使用未截断数值。</p>
   <div class="equation">xₜ = {{Math.sqrt(abar).toFixed(3)}} x₀ + {{Math.sqrt(1-abar).toFixed(3)}} ε<br/>ε̂ = 已知 ε + 人为误差<br/>重建 MSE = {{mse.toFixed(6)}}</div>
   <div class="case-controls"><button v-for="(label,key) in {forward:'训练取样',reverse:'生成过程'}" :key="key" :aria-pressed="phase===key" @click="phase=key">{{label}}</button></div><div class="flowline" v-if="phase==='forward'"><span>数据集 x₀</span>→<span>随机 t、随机 ε</span>→<span>算 xₜ，预测 ε̂</span>→<span>ε 与 ε̂ 的损失</span></div><div v-else class="flowline"><span>未知 x₀，从高斯噪声开始</span>→<span>网络预测 ε̂</span>→<span>采样 xₜ₋₁</span>→<span>反复到 t=1</span></div><p>{{phase==='forward'?'训练不必顺序遍历所有时间步。此处固定 ε 是为了控制对照变量。':'这里只画生成所需步骤，上面的图仍是已知 ε 的重建，不能按播放键伪装成生成结果。'}}</p>
  </template>
  <template v-else>
   <div class="case-controls"><button :aria-pressed="positive" @click="positive=true">加正点</button><button :aria-pressed="!positive" @click="positive=false">加负点</button><label>候选框<select v-model="box"><option value="none">无框</option><option value="person">框住人物</option><option value="tree">框住树冠</option></select></label><button @click="preset">示例：要衣服，不要腿</button><button @click="prompts=[];box='none'">清除提示</button></div>
   <svg class="scene sam-scene" viewBox="0 0 320 260" role="img" aria-label="点选人物、衣服或树冠；可用上方固定示例按钮操作" @click="point">
    <rect width="320" height="260" fill="#f1f5f9"/><path d="M0 235H320" stroke="#94a3b8"/><circle cx="102" cy="55" r="25" fill="#f4c6a4"/><path d="M65 80H140V160H65Z" fill="#93c5fd"/><path d="M65 160H140V225H65Z" fill="#64748b"/><path d="M230 130V235" stroke="#92400e" stroke-width="14"/><ellipse cx="230" cy="92" rx="40" ry="47" fill="#86efac"/>
    <g v-if="allowed[candidate]" fill="#a78bfa" fill-opacity=".5" stroke="#7c3aed" stroke-dasharray="5 3"><template v-if="candidate===0"><circle cx="102" cy="55" r="25"/><rect x="65" y="80" width="75" height="145"/></template><rect v-else-if="candidate===1" x="65" y="80" width="75" height="80"/><ellipse v-else cx="230" cy="92" rx="40" ry="47"/></g>
    <rect v-if="box!=='none'" :x="box==='person'?50:185" :y="box==='person'?25:40" :width="box==='person'?105:90" :height="box==='person'?205:105" fill="none" stroke="#ea580c"/><g v-for="(p,i) in prompts" :key="i"><circle :cx="p.x" :cy="p.y" r="7" :fill="p.positive?'#2563eb':'#dc2626'"/><text :x="p.x" :y="p.y+4" text-anchor="middle" fill="white">{{p.positive?'+':'−'}}</text></g>
   </svg>
   <div class="tokens"><button v-for="(r,i) in regions" :key="r.name" :aria-pressed="candidate===i" @click="candidate=i">{{r.name}} · {{allowed[i]?'符合提示':'与提示冲突'}}</button></div><p>剩余 {{allowed.filter(Boolean).length}} 个候选。紫色为当前候选的预定义几何区域，不是模型预测；橙色为输入框。若无候选符合，提示可能冲突，也可能候选库没有所需对象。</p>
   <div class="flowline"><span>图像编码：同图可复用</span>→<span>新点/框：重新编码提示</span>→<span>轻量解码：多个 mask + 质量分数</span></div><details><summary>候选从哪里来？为什么论文还需要数据引擎？</summary><p>本页只有三个人工区域，无法泛化。SAM 原文用辅助人工、半自动、全自动三个阶段扩大掩码数据；不能把一次交互成功当作数据覆盖充分。</p></details>
  </template>
 </section>
</template>
<style scoped>
.vision-layout{display:grid;grid-template-columns:minmax(160px,280px) 1fr;gap:24px}.diffusion-images{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.sam-scene{max-width:480px;cursor:crosshair}.case-scene .plane{font-family:monospace;font-size:12px;min-width:100px}@media(max-width:650px){.vision-layout{grid-template-columns:1fr}.diffusion-images{gap:5px}.diffusion-images :deep(.pixel-plane){min-width:0}}
</style>
