<script setup lang="ts">
import { computed,ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,string,integer,bool,image,choice,sameLength } from '../../papers/traceValidation'
const schema=fields({positions:list(fields({kind:choice('text','image'),condition:bool}),1,512),frames:list(fields({step:integer,tokens:list(text,1,512),masked:list(bool,1,512),decoded_text:string,decoded_image:(v:unknown)=>v===null?null:image(v)}),1,100)})
function parse(v:unknown){const d=schema(v);for(let j=0;j<d.frames.length;j++){const f=d.frames[j];sameLength(d.positions,f.tokens,f.masked);if(j&&f.step<=d.frames[j-1].step)throw Error('步骤必须递增');d.positions.forEach((p,i)=>{if(p.condition&&(f.masked[i]||f.tokens[i]!==d.frames[0].tokens[i]))throw Error('条件位置不得改变或遮蔽')})}return d}
const data=shallowRef<ReturnType<typeof parse>|null>(null),index=ref(0),ar=ref(false)
const frame=computed(()=>data.value?.frames[index.value])
function accept(v:unknown){data.value=parse(v);index.value=0;ar.value=false}
</script>
<template><section class="paper-lab"><h3>多个位置同时恢复，和向序列末尾追加有什么不同？</h3><TraceLoader paper-id="25" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data&&frame"><label>记录帧 {{index+1}} / {{data.frames.length}}，实际 step {{frame.step}}<input v-model.number="index" type="range" min="0" :max="data.frames.length-1"></label><div class="tokens"><span v-for="(p,i) in data.positions" :key="i" :style="{background:p.condition?'#e2e8f0':frame.masked[i]?'#fed7aa':p.kind==='image'?'#dcfce7':'#dbeafe'}" :title="`位置 ${i} · ${p.kind}`">{{frame.masked[i]?'MASK':frame.tokens[i]}}</span></div><div class="cards"><article><strong>该步真实解码文本</strong><p>{{frame.decoded_text}}</p></article><article><strong>该步真实图像码解码</strong><img v-if="frame.decoded_image" :src="frame.decoded_image" alt="该帧图像解码结果"><p v-else>记录未提供图像解码，不能用彩格代替。</p></article></div><button @click="ar=!ar">{{ar?'收起':'对照'}}自回归位置顺序</button><p v-if="ar">自回归在已有前缀后预测下一个位置；上方实际记录可以显示散落位置的恢复和修订。此文字仅解释顺序，不声称运行了另一个 AR 模型。</p></template><p class="note">记录必须注明 tokenizer/decoder 版本。帧步骤不是训练阶段；预训练、混合长解答、UniGRPO 的贡献须另看原文消融。</p></section></template>
