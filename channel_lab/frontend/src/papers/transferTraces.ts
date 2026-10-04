import { fields,list,text,integer,number,choice } from './traceValidation'
const positiveInteger=(v:unknown)=>{const n=integer(v);if(n===0||n>1e9)throw Error('需要 1–10^9 的整数');return n}
const metricValue=(v:unknown)=>{const n=number(v);if(Math.abs(n)>1e12)throw Error('指标绝对值不能超过 10^12');return n}
const point=fields({step:integer,value:metricValue,errors:list(fields({input:text,expected:text,predicted:text}),0,100)})
const schema=fields({format:choice('paired-transfer-v2'),metric:text,direction:choice('up','down'),unit:text,split_hash:text,architecture:text,pretraining_source:text,
 runs:list(fields({condition:choice('random','pretrained'),seed:integer,label_budget:positiveInteger,label_subset_hash:text,optimizer_hash:text,train_steps:positiveInteger,points:list(point,2,1000)}),2,100)})
export function parseTransfer(v:unknown){const d=schema(v),seen=new Set<string>();for(const r of d.runs){const key=`${r.condition}/${r.seed}/${r.label_budget}`;if(seen.has(key))throw Error('同条件、seed、预算只能一条');seen.add(key);for(const [i,p] of r.points.entries()){if(p.step>r.train_steps||i>0&&p.step<=r.points[i-1].step)throw Error('观测步数应严格递增且不超过总训练步数');if(p.errors.some(e=>e.expected===e.predicted))throw Error('错例不能与目标完全一致')}}return d}
export type TransferRun=ReturnType<typeof parseTransfer>['runs'][number]
export function paired(a?:TransferRun,b?:TransferRun){return !!a&&!!b&&a.seed===b.seed&&a.label_budget===b.label_budget&&a.label_subset_hash===b.label_subset_hash&&a.optimizer_hash===b.optimizer_hash&&a.train_steps===b.train_steps}
