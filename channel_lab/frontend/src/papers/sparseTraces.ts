import {fields,list,text,string,integer,probability,bool,choice,image} from './traceValidation'
const boundedInt=(v:unknown)=>{const n=integer(v);if(n>Number.MAX_SAFE_INTEGER)throw Error('整数超过安全范围');return n}
const fileName=(v:unknown)=>{const s=text(v);if(!/^[a-zA-Z0-9_-]+\.json$/.test(s)||s==='manifest.json')throw Error('层文件必须为独立JSON文件名');return s}
const hash=(v:unknown)=>{const s=text(v);if(!/^[a-f0-9]{64}$/.test(s))throw Error('需要SHA256');return s}
const routingSchema=fields({format:choice('routing-pack-v2'),experts:integer,top_k:integer,hidden_size:integer,
 parameter_counts:fields({total:boundedInt,expert_total:boundedInt}),
 cases:list(fields({id:text,text,tokens:list(fields({text,id:integer,padding:bool}),1,256),layers:list(fields({name:text,file:fileName,sha256:hash}),1,64)}),2,4)})
export function parseRouting(v:unknown){const d=routingSchema(v);if(d.experts<2||d.experts>128||d.top_k<1||d.top_k>8||d.top_k>d.experts||d.hidden_size<1||d.hidden_size>65536)throw Error('专家数/Top-k/隐藏维度越界');if(!d.parameter_counts.total||d.parameter_counts.expert_total>d.parameter_counts.total)throw Error('参数计数错误');const names=new Set<string>(),ids=new Set<string>();const layers=d.cases[0].layers
 for(const c of d.cases){if(ids.has(c.id)||c.tokens.every(t=>t.padding)||c.layers.length!==layers.length)throw Error('语境ID重复、全padding或层数不一致');ids.add(c.id);if(new Set(c.layers.map(l=>l.name)).size!==c.layers.length)throw Error('层名重复');c.layers.forEach((l,i)=>{if(names.has(l.file)||l.name!==layers[i].name)throw Error('层文件重复或语境层序不一致');names.add(l.file)})}return d}
export type RoutingPack=ReturnType<typeof parseRouting>
export function parseRouteLayer(v:unknown,pack:RoutingPack,caseIndex:number,layerIndex:number){
 const d=fields({case_id:text,layer:text,probabilities:list(list(probability,2,128),1,256),selected:list(list(integer,1,8),1,256),weights:list(list(probability,1,8),1,256)})(v)
 const c=pack.cases[caseIndex];if(d.case_id!==c.id||d.layer!==c.layers[layerIndex].name||[d.probabilities,d.selected,d.weights].some(x=>x.length!==c.tokens.length))throw Error('层文件与清单不匹配')
 for(let i=0;i<c.tokens.length;i++){const p=d.probabilities[i],s=d.selected[i],w=d.weights[i];if(p.length!==pack.experts||s.length!==pack.top_k||w.length!==pack.top_k||new Set(s).size!==s.length||s.some(e=>e>=pack.experts))throw Error('路由维度或专家ID错误');if(Math.abs(p.reduce((a,b)=>a+b,0)-1)>1e-5||Math.abs(w.reduce((a,b)=>a+b,0)-1)>0.003)throw Error('概率或Top-k权重未归一化');const sum=s.reduce((a,e)=>a+p[e],0),floor=Math.min(...s.map(e=>p[e]));if(sum<=0||p.some((v,e)=>!s.includes(e)&&v>floor+1e-7)||s.some((e,j)=>Math.abs(p[e]/sum-w[j])>0.002))throw Error('选中专家不是Top-k或权重不对应（同分允许任一）')}
 return d
}
export type RouteLayer=ReturnType<typeof parseRouteLayer>
const frame=fields({step:integer,token_ids:list(integer,1,512),tokens:list(text,1,512),masked:list(bool,1,512),confidence:list((v:unknown)=>v===null?null:probability(v),1,512),decoded_text:string,decoded_image:(v:unknown)=>v===null?null:image(v)})
const grid=(v:unknown)=>v===null?null:fields({rows:integer,cols:integer})(v)
const shape=(v:unknown)=>v===null?null:fields({width:integer,height:integer})(v)
const denoiseSchema=fields({format:choice('denoise-v2'),tokenizer_revision:text,decoder_revision:text,mask_id:integer,image_grid:grid,image_shape:shape,
 positions:list(fields({kind:choice('text','image'),condition:bool}),1,512),frames:list(frame,1,100)})
export function parseDenoise(v:unknown){const d=denoiseSchema(v);const images=d.positions.filter(p=>p.kind==='image').length
 if(d.image_grid&&(!d.image_grid.rows||!d.image_grid.cols||d.image_grid.rows*d.image_grid.cols!==images))throw Error('图像码网格与位置数不匹配')
 if(d.image_shape&&(!d.image_shape.width||!d.image_shape.height||d.image_shape.width*d.image_shape.height>4e6))throw Error('解码图片尺寸无效或超过400万像素')
 for(const [j,f] of d.frames.entries()){if(j&&f.step<=d.frames[j-1].step)throw Error('step需要严格递增');if([f.tokens,f.token_ids,f.masked,f.confidence].some(a=>a.length!==d.positions.length))throw Error('位置数组长度不一致');if(f.decoded_image&&!d.image_shape)throw Error('有解码图必须声明实际图片尺寸');d.positions.forEach((p,i)=>{if(f.masked[i]!==(f.token_ids[i]===d.mask_id)||f.masked[i]&&f.confidence[i]!==null)throw Error('MASK标记/ID/置信度不一致');if(p.condition&&(f.masked[i]||f.token_ids[i]!==d.frames[0].token_ids[i]||f.tokens[i]!==d.frames[0].tokens[i]))throw Error('条件位置必须保持固定')})}return d}
export type DenoiseTrace=ReturnType<typeof parseDenoise>
export function transition(a:DenoiseTrace['frames'][number],b:DenoiseTrace['frames'][number],i:number){return a.masked[i]&&!b.masked[i]?'恢复':!a.masked[i]&&b.masked[i]?'再遮蔽':!a.masked[i]&&!b.masked[i]&&a.token_ids[i]!==b.token_ids[i]?'改写':'不变'}
