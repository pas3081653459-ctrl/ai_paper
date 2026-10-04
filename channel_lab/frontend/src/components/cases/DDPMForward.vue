<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
const clean = ref<HTMLCanvasElement>(), noisy = ref<HTMLCanvasElement>()
const pixels = ref<Float32Array | null>(null), noise = ref<Float32Array | null>(null)
const steps = ref(0), error = ref(''), coordinate = ref(0)
let selection = 0
const alpha = computed(() => {
  let a = 1
  for (let t = 0; t < steps.value; t++) a *= 1 - (0.0001 + t / 999 * 0.0199)
  return a
})
const mixed = computed(() => pixels.value && noise.value
  ? pixels.value.map((v, i) => Math.sqrt(alpha.value) * v + Math.sqrt(1-alpha.value) * noise.value![i]) : null)
function draw() {
  for (const [canvas, data] of [[clean.value, pixels.value], [noisy.value, mixed.value]] as const) {
    if (!canvas || !data) continue
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(32, 32)
    for (let i = 0; i < 1024; i++) {
      for (let c = 0; c < 3; c++) image.data[i*4+c] = Math.round(Math.max(0, Math.min(1, (data[i*3+c]+1)/2))*255)
      image.data[i*4+3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }
}
async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const ticket = ++selection
  error.value = ''
  if (file.size > 10*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) {
    error.value = '请选择不超过 10 MB 的 PNG、JPEG 或 WebP。'; return
  }
  try {
    const bitmap = await createImageBitmap(file)
    if (ticket !== selection) { bitmap.close(); return }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,32,32); ctx.drawImage(bitmap,0,0,32,32); bitmap.close()
    const rgba = ctx.getImageData(0,0,32,32).data
    pixels.value = Float32Array.from({length:3072}, (_,i) => rgba[Math.floor(i/3)*4+i%3]/127.5-1)
    // 固定种子，每次使用同一组标准高斯噪声，滑动时仅改变混合比例。
    let state = 42
    const uniform = () => { state = (Math.imul(1664525,state)+1013904223)>>>0; return (state+0.5)/4294967296 }
    noise.value = Float32Array.from({length:3072}, () => Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform()))
    steps.value = 0
  } catch { error.value = '图片无法解码，请换一张图片。' }
}
watch([pixels, mixed], draw, {flush:'post'})
onMounted(draw)
</script>
<template>
  <section class="forward">
    <h3>1 · 亲手把照片变成噪声</h3>
    <p>上传图片留在浏览器中。缩放为 32 × 32，观察图像信号逐渐消失。</p>
    <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传加噪实验图片" @change="upload">
    <p v-if="error" role="alert">{{error}}</p>
    <div class="pictures"><figure><canvas ref="clean" width="32" height="32"/><figcaption>原图 x₀</figcaption></figure><figure><canvas ref="noisy" width="32" height="32"/><figcaption>加噪结果 xₜ</figcaption></figure></div>
    <label>累计加噪步数 {{steps}} / 1000 <input v-model.number="steps" type="range" min="0" max="1000" :disabled="!pixels"></label>
    <p>xₜ = √ᾱₜ x₀ + √(1 − ᾱₜ) ε · 图像系数 {{Math.sqrt(alpha).toFixed(4)}} · 噪声系数 {{Math.sqrt(1-alpha).toFixed(4)}}</p>
    <details v-if="pixels && mixed && noise"><summary>查看一个实际像素的计算</summary>
      <label>像素序号 <input v-model.number="coordinate" type="range" min="0" max="1023">{{coordinate}}（R 通道）</label>
      <p>{{pixels[coordinate*3].toFixed(4)}} × {{Math.sqrt(alpha).toFixed(4)}} + {{noise[coordinate*3].toFixed(4)}} × {{Math.sqrt(1-alpha).toFixed(4)}} = {{mixed[coordinate*3].toFixed(4)}}</p>
    </details>
    <p class="note">这是前向分布的直接采样，不调用模型。0 步显示原图；k 步对应后端 scheduler 的 t = k − 1。显示截断到 [−1, 1]，计算保留未截断值。下面的无条件模型从新噪声生成图片，不是修复这张上传图。</p>
  </section>
</template>
<style scoped>
.forward{padding:20px;border:1px solid #dbe3ed;border-radius:12px;background:white}.pictures{display:flex;gap:24px;flex-wrap:wrap}figure{margin:18px 0}canvas{width:160px;height:160px;image-rendering:pixelated;background:#f1f5f9;border:1px solid #cbd5e1}p{line-height:1.7}label{display:block}input[type=range]{width:min(100%,420px);vertical-align:middle}.note{font-size:12px;color:#64748b}
</style>
