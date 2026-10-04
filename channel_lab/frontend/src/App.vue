<script setup lang="ts">
import LearningGuide from './components/LearningGuide.vue'
import { ref, computed, shallowRef, onMounted, watch, onUnmounted } from 'vue'
import { Layers3, ArrowUpRight, Upload, ArrowRight, Play, X, Maximize2, ScanLine, FlaskConical, GitBranch, Info as InfoIcon, LoaderCircle, ImagePlus } from 'lucide-vue-next'
import Heatmap from './components/Heatmap.vue'
import ResidualPhotoLab from './components/ResidualPhotoLab.vue'
import type { Feature, Info, Result, ModelKey } from './types'
const props=withDefaults(defineProps<{paperMode?:boolean}>(),{paperMode:false})
const info = shallowRef<Info | null>(null)
const result = shallowRef<Result | null>(null)
const samples = ref<{id: string; label: number; name: string; url: string; source: string}[]>([])
const file = shallowRef<File | null>(null)
const preview = ref(''), fileName = ref(''), busy = ref(false), loading = ref(true), error = ref('')
const model = ref<ModelKey | 'compare'>('resnet')
const stage = ref(2), operation = ref('output'), view = ref<'channels' | 'residual'>('channels')
const scale = ref<'channel' | 'shared'>('shared'), mode = ref<'trained' | 'random'>('trained')
const selectedChannel = ref(0), dialog = ref<'guide' | 'experiment' | 'channel' | null>(null)
const zoomModel = ref<ModelKey>('resnet')
const dragging = ref(false)
const input = ref<HTMLInputElement>()
let poll: ReturnType<typeof setInterval> | undefined
const primary = computed<ModelKey>(() => model.value === 'cnn' ? 'cnn' : 'resnet')
const names: Record<ModelKey,string> = {cnn: '普通 CNN', resnet: '小型 ResNet'}
const stages = [{name:'输入图片', detail:'RGB · 64 × 64', channels:3}, {name:'Stem · 特征入口', detail:'Conv 3×3 · 8 channels',channels:8}, {name:'Block 01', detail:'64 × 64 · 8 channels', channels:8}, {name:'Block 02', detail:'32 × 32 · 16 channels',channels:16}, {name:'Block 03', detail:'16 × 16 · 32 channels',channels:32}, {name:'全局平均池化', detail:'1 × 1 · 32 channels',channels:32}]
const operations = computed(() => stage.value === 0 || stage.value === 5 ? [] : stage.value === 1 ? [ ['conv','Conv'], ['bn','BN'], ['output','ReLU'] ] : [ ['input','块输入'], ['conv1','Conv 1'], ['bn1','BN 1'], ['relu1','ReLU 1'], ['conv2','Conv 2'], ['main','主分支 F(x)'], ...(model.value === 'resnet' ? [...(stage.value>2 ? [['shortcut_conv','捷径 Conv']] : []),['shortcut','捷径输出'],['sum','相加']] : []), ['output','块输出'] ])
const featureKey = computed(() => stage.value === 0 ? 'input' : stage.value === 5 ? 'pool' : stage.value === 1 ? `stem.${operation.value}` : `block${stage.value-1}.${operation.value}`)
const activeModels = computed<ModelKey[]>(() => model.value === 'compare' ? ['cnn','resnet'] : [model.value])
function feature(key: ModelKey, node = featureKey.value): Feature | undefined { return result.value?.models[key].features[node] }
const currentFeature = computed(() => feature(primary.value))
const count = computed(() => currentFeature.value?.shape[1] ?? stages[stage.value]!.channels)
const sharedRange = computed<[number,number]>(() => {
  const all = activeModels.value.map(k => feature(k)).filter(Boolean) as Feature[]
  return all.length ? [Math.min(...all.map(f=>f.min)), Math.max(...all.map(f=>f.max))] : [0,1]
})
const signed = computed(() => sharedRange.value[0] < 0)
const residualKeys = ['main','shortcut','sum','output']
const residualTitles = ['主分支 F(x)','捷径 shortcut(x)','相加 F(x) + shortcut(x)','ReLU 后的输出']
function residualFeature(key: string) { return feature('resnet', `block${stage.value-1}.${key}`) }
const residualRange = computed<[number, number]>(() => {
 const fs = residualKeys.map(residualFeature).filter(Boolean) as Feature[]
 return fs.length ? [Math.min(...fs.map(f=>f.min)), Math.max(...fs.map(f=>f.max))] : [0,1]
})
const description = computed(() => {
 if(stage.value===0) return 'RGB 三个通道分别保留红、绿、蓝分量。下面显示的是同一张输入图的三个数值平面。'
 if(stage.value===5) return '把每个通道的所有空间位置取平均。32 张特征图变成 32 个数，再交给全连接层分类。'
 if(operation.value==='shortcut_conv') return '捷径上的 1×1 卷积使用 stride=2，将通道数和空间尺寸对齐到主分支；之后还会经过 BN。'
 if(operation.value==='shortcut') return stage.value===2 ? '恒等捷径直接传递块输入，不改变数值或形状。' : '1×1 卷积（stride=2）与 BN 同时对齐通道和空间尺寸，使两个分支可以逐元素相加。'
 if(operation.value==='sum') return '主分支与捷径逐元素相加。通道数保持不变，每个位置的响应由两条路径共同决定。'
 if(operation.value==='main') return '第二次卷积与 BN 后的主分支 F(x)，尚未经过最后的 ReLU，因此可以包含负值。'
 if(operation.value.startsWith('bn')) return 'BatchNorm 在预测时使用训练期间积累的均值和方差，调整各通道的响应分布。'
 if(operation.value.startsWith('conv')) return '卷积核在空间上滑动，从所有输入通道提取新的特征。每个输出通道对应一组可学习卷积核。'
 if(operation.value==='input') return '这是整个块接收到的特征。在 ResNet 中，同一份输入还会流向捷径分支。'
 return model.value==='cnn' ? '主分支经过 ReLU，负响应被置为零，然后传递给下一层。' : 'ResNet 先将主分支与捷径相加，再经过 ReLU。观察哪些细节被保留、哪些响应发生改变。'
})
function pickStage(index: number) { stage.value=index; operation.value='output'; selectedChannel.value=0; if(index<2||index>4) view.value='channels' }
watch(model, () => { if(['shortcut_conv','shortcut','sum'].includes(operation.value)) operation.value='output'; if(model.value==='cnn') view.value='channels' })
watch(featureKey, () => selectedChannel.value=0)
watch(view, value => { if(value==='residual') { operation.value='output'; selectedChannel.value=0 } })
function setFile(value: File) {
 error.value=''
 if(!['image/jpeg','image/png','image/webp'].includes(value.type)) {error.value='请选择 JPG、PNG 或 WebP 图片。'; return}
 if(value.size>10*1024*1024) {error.value='图片超过 10 MB，请缩小后重试。'; return}
 if(preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
 file.value=value; preview.value=URL.createObjectURL(value); fileName.value=value.name; result.value=null
}
function onFile(event: Event) { const target=event.target as HTMLInputElement; if(target.files?.[0]) setFile(target.files[0]); target.value='' }
function onDrop(event: DragEvent) { dragging.value=false; if(!busy.value && event.dataTransfer?.files[0]) setFile(event.dataTransfer.files[0]) }
async function useSample(url: string, name: string) { try { const response=await fetch(url); if(!response.ok) throw Error('示例图片暂不可用'); setFile(new File([await response.blob()], `${name}.jpg`, {type:'image/jpeg'})); await analyze() } catch(e) {error.value=(e as Error).message} }
async function analyze() {
 if(!file.value||busy.value) return
 busy.value=true; error.value=''; result.value=null
 try {
  const form = new FormData(); form.append('file',file.value)
  const response=await fetch(`/api/analyze?mode=${mode.value}`, {method:'POST',body:form})
  const data=await response.json(); if(!response.ok) throw Error(typeof data.detail==='string' ? data.detail : '图片分析失败，请重试')
  result.value=data; selectedChannel.value=0
 } catch(e) {error.value=(e as Error).message} finally {busy.value=false}
}
function changeMode() { result.value=null }
async function refreshInfo() {
 try { const response=await fetch('/api/models'); if(!response.ok) throw Error('接口暂不可用'); info.value=await response.json() }
 catch { error.value='无法连接本地模型服务，请确认后端已启动。' }
 finally {loading.value=false}
}
function openChannel(key: ModelKey, channel: number) { zoomModel.value=key; selectedChannel.value=channel; dialog.value='channel' }
function fmt(x: number|undefined) { return x===undefined ? '—' : Math.abs(x)<0.0001 && x!==0 ? x.toExponential(2) : x.toFixed(3) }
function percent(x: number|undefined) { return x===undefined ? '—' : `${(x*100).toFixed(1)}%` }
function escape(event: KeyboardEvent) { if(event.key==='Escape') dialog.value=null }
onMounted(async () => { document.addEventListener('keydown', escape); await refreshInfo(); try {samples.value=await (await fetch('/api/samples')).json()} catch {} poll=setInterval(refreshInfo,30000) })
onUnmounted(() => {clearInterval(poll); document.removeEventListener('keydown',escape); if(preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)})
</script>

<template>
<div class="app-shell">
 <header v-if="!props.paperMode" class="topbar">
  <a class="brand" href="/" aria-label="Channel Lab 首页"><strong>CNN / ResNet</strong><span>通道对比</span></a>
  <nav><a href="#/papers">论文实验室</a><a href="#/transformer">Transformer 原理</a><button class="text-button" @click="dialog='guide'">使用说明</button><button class="text-button" @click="dialog='experiment'">训练记录</button></nav>
 </header>
 <LearningGuide v-if="!props.paperMode" paper-id="01"/>
 <section class="vision-workspace">
  <div class="workspace-bar"><div class="segmented model-switch" aria-label="模型选择"><button v-for="item in [{key:'cnn',label:'普通 CNN'},{key:'resnet',label:'残差网络'},{key:'compare',label:'并排对比'}]" :key="item.key" :class="{active:model===item.key}" @click="model=item.key as typeof model"><GitBranch v-if="item.key==='resnet'" :size="15"/><Layers3 v-else :size="15"/>{{item.label}}</button></div><div class="experiment-tags"><span>输入 <b>64 × 64</b></span><span>通道 <b>8 → 16 → 32</b></span><span class="weight-status" :class="{ready:info?.trained_ready}"><i></i>{{loading ? '连接模型中' : info?.trained_ready ? '模型已就绪' : '训练权重未就绪'}}</span></div></div>
  <div class="workspace">
   <aside class="left-panel">
    <section class="input-section"><div class="section-title"><span>输入图片</span></div>
     <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="busy" @change="onFile" />
     <button class="upload-zone" :class="{dragging,filled:preview}" :disabled="busy" @click="input?.click()" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent="onDrop">
      <img v-if="preview" :src="preview" alt="上传的原始图片"/><template v-else><div class="upload-icon"><ImagePlus :size="25"/></div><strong>上传图片</strong><span>点击或拖入</span><small>JPG / PNG / WebP · 最大 10 MB</small></template><span v-if="preview" class="replace"><Upload :size="13"/> 更换图片</span>
     </button>
     <div v-if="preview" class="file-name">{{fileName}}</div>
     <div class="samples-label">示例图片</div><div class="samples"><button v-for="sample in samples" :key="sample.id" :disabled="busy" @click="useSample(sample.url,sample.name)"><img :src="sample.url" :alt="sample.name"/><span>{{sample.name}}</span><ArrowUpRight :size="12"/></button><p v-if="!samples.length" class="muted tiny">数据准备后显示示例图片</p></div>
     <button class="analyze-button" :disabled="!file||busy||(mode==='trained'&&!info?.trained_ready)" @click="analyze"><LoaderCircle v-if="busy" :size="16" class="spin"/><Play v-else :size="14" fill="currentColor"/>{{busy?'正在提取特征…':'开始实验'}}<ArrowRight v-if="!busy" :size="16"/></button>
     <p class="privacy">图片仅在本地处理</p>
    </section>
    <section class="network-section"><div class="section-title"><span>网络路径</span></div>
     <div class="network-list"><button v-for="(node,index) in stages" :key="node.name" class="network-node" :class="{selected:stage===index}" @click="pickStage(index)"><span class="node-index">{{String(index).padStart(2,'0')}}</span><div><strong>{{node.name}}</strong><small>{{node.detail}}</small></div><span v-if="index>=2&&index<=4&&model!=='cnn'" class="shortcut-symbol"><GitBranch :size="15"/></span><span v-else class="node-dot"></span></button></div>
     <div class="output-node"><span class="node-index">06</span><span>分类头</span><span class="mono">2 classes</span></div>
    </section>
   </aside>
   <section class="feature-panel">
    <div class="feature-heading"><div><h2>{{stages[stage]!.name}} <span>{{featureKey}}</span></h2></div><span class="shape-tag">{{currentFeature ? currentFeature.shape.join(' × ') : `— × ${count} × H × W`}}</span></div>
    <div class="feature-tabs"><div><button :class="{active:view==='channels'}" @click="view='channels'"><Layers3 :size="15"/>通道图</button><button :class="{active:view==='residual'}" :disabled="stage<2||stage>4||model==='cnn'" @click="view='residual'"><GitBranch :size="15"/>残差相加</button></div><span class="tiny">{{count}} CHANNELS</span></div>
    <div v-if="view==='channels'&&operations.length" class="operation-path"><template v-for="(op,index) in operations" :key="op[0]"><span v-if="index" class="op-arrow">›</span><button :class="{active:operation===op[0]}" @click="operation=op[0]!">{{op[1]}}</button></template></div>
    <div class="visual-toolbar"><span><i class="live-dot" :class="{on:result}"></i>{{result?'真实前向特征':'等待输入图片'}}</span><label>颜色范围 <select v-model="scale" aria-label="颜色范围"><option value="channel">逐通道缩放</option><option value="shared">统一色标</option></select></label></div>
    <div v-if="error" class="error" role="alert">{{error}}<button @click="error=''" aria-label="关闭提示"><X :size="14"/></button></div>
    <div v-if="!result" class="empty-state"><LoaderCircle v-if="busy" :size="24" class="spin"/><p>{{busy?'正在分析…':'上传图片或选择示例'}}</p></div>
    <template v-else-if="view==='channels'">
     <div class="channel-columns" :class="{comparison:model==='compare'}"><section v-for="key in activeModels" :key="key" class="model-channels"><div class="model-label"><span :class="key">{{names[key]}}</span><span>{{feature(key)?.shape.slice(1).join(' × ')}}</span></div><div v-if="feature(key)" class="channel-grid"><button v-for="(_,channel) in feature(key)!.channels" :key="channel" class="channel-card" @click="openChannel(key,channel)"><Heatmap :feature="feature(key)!" :channel="channel" :scale="scale" :range="sharedRange" :signed="signed"/><div><span>CH {{String(channel+1).padStart(2,'0')}}</span><Maximize2 :size="11"/></div></button></div></section></div>
     <div class="color-legend"><span>{{scale==='channel'?'各通道独立范围':'当前可见层的共享范围'}}</span><span class="gradient" :class="{signed}"></span><span>{{signed?'负值 ← 0 → 正值':'低响应 → 高响应'}}</span></div>
     <p v-if="model==='compare'" class="comparison-note"><InfoIcon :size="14"/>同编号通道不一定具有相同语义。</p>
    </template>
    <template v-else>
     <div class="residual-intro"><span class="resnet">ResNet</span><strong>F(x) + {{stage===2?'x':'Wₛx'}} → ReLU</strong><p>{{stage===2?'恒等捷径：输入直接到达加法节点。':'投影捷径：1×1 卷积和 BN 将输入对齐到相同尺寸。'}}</p></div>
     <div class="channel-slider"><label for="channel-slider">观察通道 <b>{{String(selectedChannel+1).padStart(2,'0')}}</b></label><input id="channel-slider" type="range" min="0" :max="(residualFeature('output')?.shape[1]??1)-1" v-model.number="selectedChannel"/><span>{{residualFeature('output')?.shape[1]}} 个通道</span></div>
     <div class="residual-grid"><div v-for="(key,index) in residualKeys" :key="key" class="residual-card"><div class="residual-symbol">{{['F(x)','shortcut(x)','Σ','ReLU'][index]}}</div><Heatmap v-if="residualFeature(key)" :feature="residualFeature(key)!" :channel="selectedChannel" :scale="scale" :range="residualRange" :signed="true"/><strong>{{residualTitles[index]}}</strong><small>均值 {{fmt(residualFeature(key)?.channels[selectedChannel]?.mean)}}</small></div></div>
     <div class="color-legend"><span>同一通道 · 四个计算节点</span><span class="gradient signed"></span><span>负值 ← 0 → 正值</span></div>
    </template>
    <ResidualPhotoLab v-if="result&&stage>=2&&stage<=4&&model!=='cnn'" :result="result" :block="stage-1"/>
    <details class="explanation"><summary>层说明</summary><p>{{view==='residual'?'两条分支逐元素相加，通道数不变；ReLU 将负值置零。':description}}</p></details>
   </section>
   <aside class="right-panel">
    <section class="prediction-section"><div class="section-title"><span>分类结果</span><ScanLine :size="15"/></div><div v-if="mode==='random'" class="random-warning">随机权重 · 分数没有识别意义</div>
     <div v-for="key in (['cnn','resnet'] as ModelKey[])" :key="key" class="prediction-card" :class="{chosen:model===key}"><div class="prediction-model"><span :class="key">{{names[key]}}</span><span class="tiny">{{info ? (info.models[key].parameters/1000).toFixed(1)+'K 参数' : '—'}}</span></div><div class="prediction-value"><strong>{{result?['猫','狗'][result.models[key].prediction]:'待分析'}}</strong><span>{{result?percent(Math.max(...result.models[key].probabilities)):'—'}}</span></div><div v-for="(label,index) in ['猫','狗']" :key="label" class="probability"><span>{{label}}</span><div><i :style="{width:result?`${result.models[key].probabilities[index]!*100}%`:'0%'}" :class="key"></i></div><span>{{percent(result?.models[key].probabilities[index])}}</span></div></div>
     <div class="inference-time"><span>双模型特征提取</span><span class="mono">{{result?`${result.milliseconds} ms`:'—'}}</span></div><p class="micro">仅区分猫和狗，可能误判。</p>
    </section>
    <section class="tensor-section"><div class="section-title"><span>当前张量</span></div><dl><div><dt>操作</dt><dd>{{currentFeature?.operation ?? '—'}}</dd></div><div><dt>输入形状</dt><dd>{{currentFeature?.input_shape?.slice(1).join(' × ') ?? '—'}}</dd></div><div><dt>本层参数</dt><dd>{{currentFeature?.parameters?.toLocaleString() ?? '—'}}</dd></div><div v-if="currentFeature?.kernel"><dt>卷积核 / 步长</dt><dd>{{currentFeature.kernel.join('×')}} / {{currentFeature.stride?.[0]}}</dd></div><div><dt>输出通道</dt><dd>{{count}}</dd></div><div><dt>空间尺寸</dt><dd>{{currentFeature?currentFeature.shape.slice(2).join(' × '):'—'}}</dd></div><div><dt>最小值</dt><dd>{{fmt(currentFeature?.min)}}</dd></div><div><dt>最大值</dt><dd>{{fmt(currentFeature?.max)}}</dd></div><div><dt>平均响应</dt><dd>{{fmt(currentFeature?.mean)}}</dd></div></dl><div v-if="result" class="preprocessed"><img :src="result.preprocessed" alt="实际输入模型的 64×64 图片"/><div><strong>模型实际输入</strong><span>RGB · 64 × 64</span><span>缩放 / 像素归一化 [0,1]</span></div></div></section>
    <section class="weight-section"><label for="weight-mode">权重模式</label><select id="weight-mode" v-model="mode" :disabled="busy" @change="changeMode"><option value="trained">本地训练权重</option><option value="random">随机权重 · 教学模式</option></select><button class="record-link" @click="dialog='experiment'">查看训练与验证数据 <ArrowUpRight :size="14"/></button></section>
   </aside>
  </div>

 </section>
 <div v-if="dialog" class="modal-backdrop" @click.self="dialog=null"><section class="modal" :class="{wide:dialog==='experiment'}" role="dialog" aria-modal="true" :aria-label="dialog==='guide'?'学习指南':dialog==='experiment'?'实验记录':'通道详情'"><button class="modal-close" @click="dialog=null" aria-label="关闭弹窗"><X :size="20"/></button>
  <template v-if="dialog==='guide'"><h2>使用说明</h2><p>每张通道图都是一个二维数值平面。卷积不断提取和组合特征，最后汇总成猫、狗两个类别分数。</p><div class="guide-step"><b>01</b><div><h3>上传一张图片</h3><p>两个模型使用同一个 64×64 RGB 输入。可先点击猫咪或狗狗测试集样本。</p></div></div><div class="guide-step"><b>02</b><div><h3>沿着网络路径看特征</h3><p>选择左侧节点，再点击 Conv、BN、ReLU 等操作，逐层查看所有通道。点击通道可放大。</p></div></div><div class="guide-step"><b>03</b><div><h3>理解残差相加</h3><p>在残差网络的 Block 中选择“残差相加”。同一通道的主分支、捷径、相加结果和激活输出会一起展示。</p></div></div><div class="guide-formula">CNN: ReLU(F(x))<br/>ResNet: ReLU(F(x) + shortcut(x))</div><p>逐通道缩放便于观察细节；统一色标便于比较数值强弱。通道编号不代表固定语义，热力图也不是模型关注区域的直接解释。</p></template>
  <template v-else-if="dialog==='experiment'"><h2>训练记录</h2><p>两个模型均从零训练，仅捷径结构不同。没有使用预训练网络。</p><template v-if="info?.experiment"><div class="experiment-summary"><div><span>训练 / 验证 / 测试</span><strong>{{info.experiment.sizes.train}} / {{info.experiment.sizes.val}} / {{info.experiment.sizes.test}}</strong></div><div><span>每模型训练轮数</span><strong>{{info.experiment.epochs}} epochs</strong></div><div><span>随机种子</span><strong>{{info.experiment.seed}}</strong></div></div><table><thead><tr><th>模型</th><th>最佳轮次</th><th>验证准确率</th><th>测试准确率</th><th>测试平衡准确率</th></tr></thead><tbody><tr v-for="key in (['cnn','resnet'] as ModelKey[])" :key="key"><td>{{names[key]}}</td><td>{{info.experiment.models[key].best_epoch}}</td><td>{{percent(info.experiment.models[key].validation.accuracy)}}</td><td>{{percent(info.experiment.models[key].test.accuracy)}}</td><td>{{percent(info.experiment.models[key].test.balanced_accuracy)}}</td></tr></tbody></table><div class="curve-title">验证集平衡准确率 · 每轮记录</div><svg class="training-chart" viewBox="0 0 640 150" role="img" aria-label="两个模型的验证集平衡准确率曲线"><line v-for="y in [20,70,120]" :key="y" x1="30" x2="625" :y1="y" :y2="y" stroke="#303630"/><text x="0" y="24">100%</text><text x="0" y="74">75%</text><text x="0" y="124">50%</text><polyline v-for="key in (['cnn','resnet'] as ModelKey[])" :key="key" :points="info.experiment.models[key].history.map((h,i,arr)=>`${30+i*595/Math.max(1,arr.length-1)},${120-(h.balanced_accuracy-0.5)*200}`).join(' ')" fill="none" :stroke="key==='cnn'?'#b45309':'#2563eb'" stroke-width="2"/></svg><p class="chart-legend"><span class="cnn">● 普通 CNN</span><span class="resnet">● 小型 ResNet</span></p><p>数据集为 Oxford-IIIT Pet。官方 trainval 按物种分层划分训练/验证；官方 test 独立留出。按验证集平衡准确率选取权重，测试集不参与选模。猫狗数量不均衡，因此同时报告两类召回率的平均值。</p><p class="micro">64×64 · AdamW · 初始学习率 0.002 · cosine 调度 · 类别加权交叉熵 · 同顺序与随机翻转。单次小模型实验不代表架构的一般优劣。</p></template><div v-else class="no-metrics"><FlaskConical :size="36"/><h3>训练记录尚未就绪</h3><p>网站不会将随机模型分数伪装成已训练结果。请等待本地训练完成，或选择随机权重学习模式。</p></div></template>
  <template v-else-if="feature(zoomModel)"><div class="eyebrow">{{names[zoomModel]}} · {{featureKey}}</div><h2>Channel {{String(selectedChannel+1).padStart(2,'0')}}</h2><div class="zoom-map"><Heatmap :feature="feature(zoomModel)!" :channel="selectedChannel" :scale="scale" :range="sharedRange" :signed="signed"/></div><div class="zoom-stats"><span>MIN <b>{{fmt(feature(zoomModel)!.channels[selectedChannel]?.min)}}</b></span><span>MAX <b>{{fmt(feature(zoomModel)!.channels[selectedChannel]?.max)}}</b></span><span>MEAN <b>{{fmt(feature(zoomModel)!.channels[selectedChannel]?.mean)}}</b></span></div><div class="zoom-controls"><button :disabled="selectedChannel===0" @click="selectedChannel--">上一个通道</button><span>{{selectedChannel+1}} / {{feature(zoomModel)!.shape[1]}}</span><button :disabled="selectedChannel===feature(zoomModel)!.shape[1]!-1" @click="selectedChannel++">下一个通道</button></div></template>
 </section></div>
</div>
</template>
<style scoped>
.vision-workspace{max-width:1600px;margin:auto;padding:20px 24px}
@media(max-width:1100px){.vision-workspace{padding:16px}}
@media(max-width:640px){.vision-workspace{padding:12px}}
</style>
