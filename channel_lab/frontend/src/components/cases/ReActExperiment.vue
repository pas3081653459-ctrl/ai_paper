<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import environmentSource from '../../../../backend/react_environment.py?raw'
type Action={action:string;query?:string;document_id?:string;answer?:string;sources?:string[]}
type Session={id:string;mode:string;task:string;fault:boolean;finished:boolean;attempts:number;events:{step:number;actor?:string;action?:Action;observation?:Record<string,unknown>;error?:string}[];[key:string]:unknown}
const session=ref<Session|null>(null),previous=ref<Session|null>(null),config=ref<{configured:boolean;problems:string[];model:string}|null>(null)
const mode=ref('human'),fault=ref(false),query=ref('玻璃之舟'),documentId=ref(''),answer=ref(''),sources=ref(''),busy=ref(false),error=ref('')
let disposed=false
async function api<T>(path:string,body?:unknown,method='GET'):Promise<T>{const r=await fetch('/api/experiments/react'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));return data}
async function refresh(){try{const c=await api<{configured:boolean;problems:string[];model:string}>('/config');if(!disposed)config.value=c}catch(e){if(!disposed)error.value=String(e)}}
async function start(){busy.value=true;error.value='';try{const s=await api<Session>('/sessions',{mode:mode.value,fault:fault.value},'POST');if(!disposed){previous.value=session.value;session.value=s;documentId.value='';answer.value='';sources.value=''}}catch(e){if(!disposed)error.value=String(e)}finally{if(!disposed)busy.value=false}}
async function act(action?:Action){if(!session.value||busy.value)return;busy.value=true;error.value='';try{const s=await api<Session>(`/sessions/${session.value.id}/step`,action??null,'POST');if(!disposed)session.value=s}catch(e){if(!disposed)error.value=String(e)}finally{if(!disposed)busy.value=false}}
async function remove(){if(!session.value)return;try{await api(`/sessions/${session.value.id}`,undefined,'DELETE');session.value=null}catch(e){error.value=String(e)}}
function download(){const url=URL.createObjectURL(new Blob([JSON.stringify({schema_version:1,paper_id:'21',source:'executed-environment',current:session.value,comparison:previous.value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='react-actions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
onMounted(refresh);onUnmounted(()=>{disposed=true})
</script>
<template>
 <section class="react-lab">
  <h3>资料查询失败后，下一步会改变吗？</h3>
  <p>封闭档案调查：先亲自查证，再让本地模型选择行动。所有名称为虚构教学资料，但每次工具返回都由真实环境执行。</p>
  <div class="controls"><label>行动者 <select v-model="mode" :disabled="busy"><option value="human">我来调查</option><option value="model">本地模型</option></select></label><label><input v-model="fault" type="checkbox" :disabled="busy">首次工具请求故障</label><button :disabled="busy||(mode==='model'&&!config?.configured)" @click="start">新建这一条件的实验</button><button @click="refresh">刷新模型配置</button></div>
  <p v-if="config&&!config.configured" class="notice">模型未配置：{{config.problems.join('；')}}。读者模式仍可使用。配置见 REMAINING_SETUP.md。</p><p v-else-if="config">本地模型：{{config.model}}；每次点击最多请求一个行动，不自动循环。</p>
  <p v-if="error" role="alert">{{error}}</p>
  <template v-if="session">
   <h4>{{session.task}}</h4><p>{{session.mode==='human'?'读者选择':'模型选择'}} · 故障{{session.fault?'开启':'关闭'}} · {{session.attempts}} / 8 步 · {{session.finished?'已结束':'进行中'}}</p>
   <template v-if="!session.finished">
    <button v-if="session.mode==='model'" :disabled="busy" @click="act()">{{busy?'等待模型行动…':'让模型选择并执行下一步'}}</button>
    <div v-else class="actions"><label>关键词<input v-model="query" maxlength="100"><button :disabled="busy||!query.trim()" @click="act({action:'search',query})">搜索档案</button></label><label>文档 ID<input v-model="documentId" placeholder="从搜索结果中选择" maxlength="40"><button :disabled="busy||!documentId.trim()" @click="act({action:'read',document_id:documentId})">读取正文</button></label><label>答案（城市名）<input v-model="answer" maxlength="200"></label><label>引用文档 ID（逗号分隔）<input v-model="sources" maxlength="200"></label><button :disabled="busy||!answer.trim()" @click="act({action:'finish',answer,sources:sources.split(/[,，]/).map(s=>s.trim()).filter(Boolean)})">提交查证结论</button></div>
   </template>
   <ol class="timeline"><li v-for="event in session.events" :key="event.step"><strong>第 {{event.step}} 步</strong><template v-if="event.action"><div class="action">Action <code>{{JSON.stringify(event.action)}}</code></div><div class="observation">实际 Observation <pre>{{JSON.stringify(event.observation,null,2)}}</pre></div></template><p v-else role="alert">{{event.error}}</p></li></ol>
   <p v-if="session.finished">检查：答案是否正确？是否确实读取了必要证据？达到步数上限也会停止，并不代表成功。</p>
   <button :disabled="busy" @click="download">导出实际行动记录</button> <button :disabled="busy" @click="remove">删除当前会话</button>
   <details v-if="previous"><summary>与上一条件对照（不是自动因果结论）</summary><p>行动者 {{previous.mode}} · 首次故障 {{previous.fault}} · {{previous.attempts}} 步</p><pre>{{JSON.stringify(previous.events,null,2)}}</pre></details>
  </template>
  <details><summary>实际工具环境源码</summary><pre>{{environmentSource}}</pre></details>
  <p class="note">首版展示行动—反馈闭环，只保存公开行动与观察，不获取私有思维。模型适配不是原论文完整 Thought/Act 消融复现。单次成功不能证明普遍提升；可重开相同条件观察失败。</p>
 </section>
</template>
<style scoped>
.react-lab{padding:22px;background:white;border:1px solid #dbe3ed;border-radius:12px}p{line-height:1.8}.controls,.actions{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.actions label{display:grid;gap:8px}.timeline{padding-left:24px}.timeline li{margin:18px 0;border-left:3px solid #94a3b8;padding-left:14px}.action,.observation{padding:12px;overflow-wrap:anywhere}.action{background:#f1f5f9}.observation{background:#eff6ff}input,select,button{padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:white}button{cursor:pointer}button:disabled{opacity:.5}.notice{padding:12px;background:#fff7ed}pre{overflow:auto;max-height:360px;font-size:12px;white-space:pre-wrap}.note{font-size:12px;color:#64748b}summary{cursor:pointer;padding:14px 0}
</style>
