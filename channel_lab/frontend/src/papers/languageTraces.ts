import { fields,list,text,string,integer,probability,choice,object,bool } from './traceValidation'
const base=fields({text,tokens:list(text,1,4096),input_ids:list(integer,1,4096)})
function input(v:unknown){const d=base(v),o=object(v);if(d.tokens.length!==d.input_ids.length)throw Error('token 与 ID 长度不一致');const mask=o.attention_mask==null?null:list(integer,1,4096)(o.attention_mask);if(mask&&(mask.length!==d.tokens.length||mask.some(x=>x!==0&&x!==1)))throw Error('attention_mask 维度或取值错误');return {...d,attention_mask:mask}}
const candidate=fields({token:text,p:probability})
export function parseBert(v:unknown){return fields({conditions:list((v:unknown)=>{const d=input(v),o=object(v),mask_index=integer(o.mask_index),candidates=list(candidate,1,50)(o.candidates);if(mask_index>=d.tokens.length)throw Error('MASK 位置越界');if(new Set(candidates.map(c=>c.token)).size!==candidates.length||candidates.reduce<number>((s,c)=>s+c.p,0)>1.00001)throw Error('候选重复或概率总和超过 1');return {...d,mask_index,candidates}},1,3)})(v)}
const output=fields({generated:list(fields({id:integer,piece:string,p:probability}),1,128),output:string,stop_reason:choice('eos','length_limit')})
export function generation(v:unknown){return {...input(v),...output(v)}}
export const parseGpt=fields({conditions:list(generation,1,3)})
const label=choice('positive','negative')
const result=fields({test_id:text,test_input:text,target:text,target_class:label,prediction:choice('positive','negative','other'),correct:bool})
const contextSchema=fields({dataset_version:text,conditions:list(fields({name:text,examples:list(fields({id:text,input:text,label:text}),0,4),mapping:fields({positive:text,negative:text}),results:list((v:unknown)=>({...generation(v),...result(v)}),1,20)}),2,2)})
export function parseContext(v:unknown){const d=contextSchema(v);const reference=d.conditions[0].results
 for(const c of d.conditions){if(c.mapping.positive===c.mapping.negative)throw Error('两个标签必须不同');if(c.results.length!==reference.length||new Set(c.results.map(r=>r.test_id)).size!==c.results.length)throw Error('题集长度或 ID 不一致')
  for(const [i,r] of c.results.entries()){const original=reference[i];if(r.test_id!==original.test_id||r.test_input!==original.test_input||r.target_class!==original.target_class)throw Error('对照必须使用同一题集和目标');if(r.target!==c.mapping[r.target_class])throw Error('目标标签映射不一致');const line=r.output.trim().split('\n')[0].trim();const pred=line===c.mapping.positive?'positive':line===c.mapping.negative?'negative':'other';if(pred!==r.prediction||r.correct!==(pred===r.target_class))throw Error('记录评分与页面独立复核不符')}
 }return d}
