<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DDPMForward from './DDPMForward.vue'
import workerSource from '../../../../backend/ddpm_worker.py?raw'
type Status = {state:string; message?:string; completed_steps?:number; total_steps?:number; elapsed_seconds?:number}
type Entry = {index:number; timestep:number; file:string}
type Manifest = {frames:Entry[]; initial_image?:string; final_image?:string; [key:string]:unknown}
type Job = {job_id:string; status:Status; request:{seed?:number;steps?:number}; manifest?:Manifest|null}
type Frame = {timestep:number;previous_timestep:number;shape:number[];coeff_x0:number;coeff_xt:number;images:Record<string,string>;values:Record<string,number[]>;ranges:Record<string,{min:number;max:number}>}
type Config = {configured:boolean; problems:string[]; model_dir:string; device:string; note:string}
const base = '/api/experiments/ddpm'
const config = ref<Config|null>(null), history = ref<Job[]>([]), job = ref<Job|null>(null), frame = ref<Frame|null>(null)
const seed = ref(42), steps = ref(1000), saveEvery = ref(20), selected = ref(0), pixel = ref(0), channel = ref(0)
const error = ref(''), busy = ref(false), playing = ref(false)
const terminal = new Set(['completed','failed','cancelled','interrupted'])
const running = computed(() => !!job.value && !terminal.has(job.value.status.state))
const frames = computed(() => job.value?.manifest?.frames ?? [])
const offset = computed(() => channel.value*1024+pixel.value)
const stages = [ ['sample','当前带噪图 xₜ'], ['epsilon','网络预测噪声 εθ'], ['predicted_x0','估计干净图 x̂₀'], ['mean','反向分布均值 μ'], ['added_noise','本步实际随机增量'], ['next_sample','下一步样本'] ]
let disposed = false, epoch = 0, frameEpoch = 0
let pollTimer: ReturnType<typeof setTimeout>|undefined, playTimer: ReturnType<typeof setInterval>|undefined
async function api<T>(path:string, options?:RequestInit):Promise<T> {
  const response = await fetch(base+path, {cache:'no-store', ...options})
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `请求失败 ${response.status}`)
  return data as T
}
function report(e:unknown) { if (!disposed) error.value = e instanceof Error ? e.message : String(e) }
function asset(file:string) { return `${base}/jobs/${job.value?.job_id}/files/${file}` }
function stopPlayback() { playing.value=false; clearInterval(playTimer) }
async function loadFrame() {
  const ticket = ++frameEpoch, id = job.value?.job_id, entry = frames.value[selected.value]
  frame.value = null
  if (!id || !entry) return
  try {
    const result = await api<Frame>(`/jobs/${id}/files/${entry.file}`)
    if (!disposed && ticket === frameEpoch) frame.value = result
  } catch(e) { if(ticket === frameEpoch) report(e) }
}
watch(() => [job.value?.job_id, frames.value[selected.value]?.file], loadFrame)
async function selectJob(id:string) {
  const ticket = ++epoch
  clearTimeout(pollTimer); stopPlayback(); ++frameEpoch
  job.value=null; frame.value=null; selected.value=0; error.value=''
  async function refresh() {
    try {
      const result = await api<Job>(`/jobs/${id}`)
      if (disposed || ticket !== epoch) return
      job.value = result
      if (!terminal.has(result.status.state)) pollTimer = setTimeout(refresh, 1200)
      else await refreshHistory()
    } catch(e) { if(ticket === epoch) report(e) }
  }
  await refresh()
}
async function refreshHistory() {
  const result = await api<Job[]>('/jobs')
  if (!disposed) history.value = result
}
async function refreshConfig() {
  try { const result = await api<Config>('/config'); if(!disposed) config.value=result; await refreshHistory() } catch(e) { report(e) }
}
async function start() {
  busy.value=true; error.value=''
  try {
    const result=await api<{job_id:string}>('/jobs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seed:seed.value,steps:steps.value,save_every:saveEvery.value})})
    if(!disposed) { await selectJob(result.job_id); await refreshHistory() }
  } catch(e) { report(e) } finally {busy.value=false}
}
async function cancel() {
  if(!job.value) return
  try {await api(`/jobs/${job.value.job_id}/cancel`,{method:'POST'})} catch(e) {report(e)}
}
async function remove() {
  if(!job.value || !window.confirm('删除当前任务及其所有本地回放帧？')) return
  const id=job.value.job_id
  try {
    await api(`/jobs/${id}`,{method:'DELETE'})
    if(job.value?.job_id===id) {++epoch; ++frameEpoch; stopPlayback();job.value=null;frame.value=null}
    await refreshHistory()
  } catch(e) {report(e)}
}
function play() {
  if(playing.value) {stopPlayback();return}
  if(selected.value>=frames.value.length-1) selected.value=0
  playing.value=true
  playTimer=setInterval(() => {
    if(!frame.value) return
    if(selected.value>=frames.value.length-1) stopPlayback()
    else selected.value++
  }, 1000)
}
onMounted(async () => {await refreshConfig();if(!disposed && history.value.length) await selectJob(history.value[0].job_id)})
onUnmounted(() => {disposed=true;++epoch;++frameEpoch;clearTimeout(pollTimer);stopPlayback()})
</script>
<template>
 <div class="ddpm">
  <DDPMForward/>
  <section>
   <h3>2 · 网络怎样从未知噪声中生成图像？</h3>
   <p>每一步真正运行本地 UNet，再按 DDPM 反向分布采样。观察噪声预测、干净图估计和随机采样的区别。</p>
   <details><summary>为什么不能直接把噪声减掉？</summary><p>上面的前向实验知道原图和加入的 ε；生成时只有 xₜ，没有原图，也没有这一步的正确 ε。论文训练网络 εθ(xₜ,t)，用真实加入的 ε 作为监督，最小化噪声预测误差。训练完成后，反向采样才能使用网络估计。</p><p>这里不执行训练。配置权重后，先看早期 x̂₀ 是否已经出现模糊结构，再看后期细节如何变化。比较 x̂₀、均值和下一步，理解“一次预测干净图”与“逐步随机采样”为何不同。单张图片好看与否不能证明论文的总体生成质量。</p></details>
   <div v-if="config && !config.configured" class="notice"><strong>真实生成尚未配置</strong><p v-for="problem in config.problems" :key="problem">{{problem}}</p><p>按项目文档 channel_lab/DDPM_SETUP.md 配置，然后刷新。不会自动下载。</p></div>
   <details v-if="config"><summary>本地配置</summary><p>{{config.model_dir}} · {{config.device}}</p><p>{{config.note}}</p></details>
   <div class="controls">
    <label>随机种子 <input v-model.number="seed" type="number" min="0" max="2147483647"></label>
    <label>推理步数 <select v-model.number="steps"><option :value="1000">1000</option><option :value="250">250（跳步预览）</option><option :value="100">100（跳步预览）</option></select></label>
    <label>每隔几步存帧 <input v-model.number="saveEvery" type="number" min="10" max="100"></label>
    <button :disabled="!config?.configured || busy || running" @click="start">生成并记录</button>
    <button @click="refreshConfig">刷新配置 / 记录</button>
   </div>
   <p class="note">步数改变实际采样时间表；存帧间隔只影响回放密度。输出为 32 × 32 无条件图像，不输入提示词，也不接收上方照片。</p>
   <p v-if="error" role="alert" class="notice">{{error}}</p>
   <label>本地记录 <select :value="job?.job_id ?? ''" @change="selectJob(($event.target as HTMLSelectElement).value)"><option value="" disabled>选择一次实验</option><option v-for="item in history" :key="item.job_id" :value="item.job_id">{{item.job_id.slice(0,8)}} · seed {{item.request.seed}} · {{item.status.state}}</option></select></label>
   <div v-if="job">
    <p>{{job.status.state}} · {{job.status.completed_steps ?? 0}} / {{job.status.total_steps ?? job.request.steps}} 步 · {{Math.round(job.status.elapsed_seconds ?? 0)}} 秒</p><p>{{job.status.message}}</p>
    <button v-if="running" @click="cancel">停止生成，保留已保存帧</button><button v-else @click="remove">删除这次记录</button>
    <div class="endpoints"><figure v-if="job.manifest?.initial_image"><img :src="asset(job.manifest.initial_image)" alt="实际初始噪声"><figcaption>初始噪声</figcaption></figure><figure v-if="job.manifest?.final_image"><img :src="asset(job.manifest.final_image)" alt="实际生成结果"><figcaption>最终生成结果</figcaption></figure></div>
   </div>
  </section>
  <section v-if="frames.length">
   <h3>3 · 拆开一个真实采样步骤</h3>
   <label>保存帧 {{selected+1}} / {{frames.length}} <input v-model.number="selected" type="range" min="0" :max="frames.length-1" @input="stopPlayback"></label><button @click="play">{{playing?'暂停':'回放已保存帧'}}</button>
   <template v-if="frame">
    <p>t = {{frame.timestep}} → {{frame.previous_timestep}} · 张量 [{{frame.shape.join(', ')}}]（B, C, H, W）</p>
    <div class="stages"><figure v-for="[key,title] in stages" :key="key"><img :src="asset(frame.images[key])" :alt="title"><figcaption>{{title}}</figcaption><small>R/G/B 三通道 · [1, 3, 32, 32]</small></figure></div>
    <p>μ = {{frame.coeff_x0.toFixed(5)}} × x̂₀ + {{frame.coeff_xt.toFixed(5)}} × xₜ；下一步 = μ + 本步随机增量。</p>
    <p class="note">x̂₀ 按 checkpoint 的 clip_sample 配置处理；εθ 不是从输入减去原图得到的已知噪声。图像显示范围 [−1, 1]，预测噪声 / 随机增量显示范围 [−3, 3]；不能跨不同范围直接比较亮度。</p>
    <label>像素位置 y={{Math.floor(pixel/32)}}，x={{pixel%32}} <input v-model.number="pixel" type="range" min="0" max="1023"></label>
    <label>通道 <select v-model.number="channel"><option :value="0">R</option><option :value="1">G</option><option :value="2">B</option></select></label>
    <table><thead><tr><th>阶段</th><th>该像素实际值</th><th>全张量范围</th></tr></thead><tbody><tr v-for="[key,title] in stages" :key="key"><td>{{title}}</td><td>{{frame.values[key][offset].toFixed(6)}}</td><td>{{frame.ranges[key].min.toFixed(3)}} ～ {{frame.ranges[key].max.toFixed(3)}}</td></tr></tbody></table>
   </template><p v-else>读取该帧真实数值…</p>
  </section>
  <section><details v-if="job?.manifest"><summary>实验来源、权重指纹与采样时间表</summary><pre>{{JSON.stringify(job.manifest,null,2)}}</pre></details><details><summary>网络调用与采样记录的 Python 源码</summary><pre><code>{{workerSource}}</code></pre></details></section>
 </div>
</template>
<style scoped>
.ddpm{display:grid;gap:20px}.ddpm>section{padding:20px;border:1px solid #dbe3ed;border-radius:12px;background:#fff}p{line-height:1.7}.controls,.endpoints,.stages{display:flex;gap:16px;flex-wrap:wrap;align-items:start}.controls label{display:grid;gap:6px}button,select,input[type=number]{padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:white}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}input[type=number]{width:130px}label{display:block;margin:12px 0}input[type=range]{width:min(100%,480px)}figure{margin:14px 0;width:150px}img{width:144px;height:144px;image-rendering:pixelated;border:1px solid #e2e8f0}figcaption{margin-top:8px}.note,small{font-size:12px;color:#64748b}.notice{padding:12px;background:#fff7ed;border:1px solid #fed7aa;overflow-wrap:anywhere}pre{overflow:auto;max-height:400px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;border-bottom:1px solid #e2e8f0;padding:9px}summary{cursor:pointer;padding:10px 0}
</style>
