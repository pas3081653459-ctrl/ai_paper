<script setup lang="ts">
import { ref,shallowRef } from 'vue'
import TraceLoader from './TraceLoader.vue'
import { fields,list,text,string,image,choice } from '../../papers/traceValidation'
const nullableImage=(v:unknown)=>v===null?null:image(v)
const schema=fields({question:text,conditions:list(fields({name:text,condition:choice('original','occluded','no_image'),image:nullableImage,answer:string}),2,10)})
function parse(v:unknown){const d=schema(v);for(const c of d.conditions)if((c.condition==='no_image')!==(c.image===null))throw Error('no_image 必须无图，其他条件必须带图');return d}
const data=shallowRef<ReturnType<typeof parse>|null>(null),notes=ref<Record<number,string>>({})
function accept(v:unknown){data.value=parse(v);notes.value={}}
</script>
<template><section class="paper-lab"><h3>回答中的一句话，能从这张图找到依据吗？</h3><p>对同一个问题对照原图、遮挡或无图条件。先核查可见事实，再讨论视觉指令训练，而不是把“向量拼上了”当作回答可靠。</p><TraceLoader paper-id="19" :validate="parse" @loaded="accept" @clear="data=null"/><template v-if="data"><h4>{{data.question}}</h4><div class="cards"><article v-for="(c,i) in data.conditions" :key="i"><strong>{{c.name}} · {{c.condition}}</strong><img v-if="c.image" :src="c.image" alt="该次推理实际图像条件"><p v-else class="alert">该条件没有图像</p><p>{{c.answer}}</p><label>你的取证标注<textarea v-model="notes[i]" placeholder="哪些事实可见？哪一句无法从图中支持？"/></label></article></div></template><p class="note">记录回放，不实时调用 LLaVA。不生成注意力热图冒充回答依据；无图路径是否被模型支持须在 settings 中注明。回答不同不自动证明视觉信息是唯一原因，需核对模型、提示与解码设置。</p></section></template>
