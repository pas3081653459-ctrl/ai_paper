import {fields,list,text,integer,number,probability,choice,object} from './traceValidation'
import {goMove,ticWinner} from './boardRules'
const count=(v:unknown)=>{const n=integer(v);if(n>1e8)throw Error('计数超过 10^8');return n}
const value=(v:unknown)=>{const n=number(v);if(Math.abs(n)>1)throw Error('价值需在 [-1,1]');return n}
const player=(v:unknown)=>{const n=integer(v);if(n!==1&&n!==2)throw Error('行动方需为1或2');return n}
const move=(v:unknown)=>v===null?null:integer(v)
const parent=(v:unknown)=>v===null?null:text(v)
const node=fields({id:text,parent,move,to_play:player,board:list(integer,81,361),prior:probability,visits:count,value})
const goSchema=fields({size:integer,rules:choice('no-suicide-positional-superko'),value_perspective:choice('to_play','black'),snapshots:list(fields({budget:count,nodes:list(node,1,200)}),1,20)})
export function parseGo(v:unknown){const d=goSchema(v),o=object(v);if(![9,19].includes(d.size))throw Error('仅支持9或19路');let root:ReturnType<typeof node>|undefined,previousBudget=-1
 const history=o.root_history==null?[]:list(list(integer,81,361),0,200)(o.root_history)
 if(history.some(b=>b.length!==d.size**2||b.some(s=>s>2)))throw Error('根前历史棋盘尺寸/棋子错误')
 const strict=o.statistics==='completed-simulations-v2'
 if(o.statistics!=null&&!strict)throw Error('未知统计约定')
 const previous=new Map<string,ReturnType<typeof node>>()
 for(const s of d.snapshots){if(s.budget<=previousBudget)throw Error('预算必须递增');previousBudget=s.budget;const seen=new Map<string,ReturnType<typeof node>>()
  for(const [i,n] of s.nodes.entries()){
   if(seen.has(n.id)||n.board.length!==d.size**2||n.board.some(x=>x>2))throw Error('节点重复或棋盘非法')
   if(i===0){if(n.parent!==null||n.move!==null)throw Error('首节点必须是根');if(root&&(root.id!==n.id||root.to_play!==n.to_play||root.board.some((x,j)=>x!==n.board[j])))throw Error('预算比较必须同一根局面');root=n;if(strict&&n.visits!==s.budget)throw Error('v2根访问数必须等于完成模拟预算')}
   else {const p=n.parent?seen.get(n.parent):undefined;if(!p||n.to_play!==3-p.to_play)throw Error('父节点需先出现，行动方交替');const ancestors=[...history];let a:typeof p|undefined=p;while(a){ancestors.push(a.board);a=a.parent?seen.get(a.parent):undefined}const expected=goMove(p.board,d.size,n.move,p.to_play,ancestors);if(expected.some((x,j)=>x!==n.board[j]))throw Error('落子/提子与子节点不符');if([...seen.values()].some(x=>x.parent===n.parent&&x.move===n.move))throw Error('同一父节点的行动重复');if(strict&&n.visits>p.visits)throw Error('子访问数超过父节点')}
   const old=previous.get(n.id);if(old&&(old.parent!==n.parent||old.move!==n.move||old.to_play!==n.to_play||old.board.some((x,j)=>x!==n.board[j])||strict&&old.visits>n.visits))throw Error('跨快照节点身份改变或访问数倒退');seen.set(n.id,n)
  }
  if(strict)for(const p of s.nodes){const children=s.nodes.filter(n=>n.parent===p.id);if(children.reduce<number>((a,n)=>a+n.visits,0)>p.visits||children.reduce<number>((a,n)=>a+n.prior,0)>1.00001)throw Error('子访问和或先验和超过父节点/1')}
  for(const n of s.nodes)previous.set(n.id,n)
 }
 return {...d,root_history:history,statistics:strict?'completed-simulations-v2':null}
}
export type GoTrace=ReturnType<typeof parseGo>
export type GoNode=GoTrace['snapshots'][number]['nodes'][number]
export function goCoordinate(m:number|null,size:number){return m===null?'PASS':`${'ABCDEFGHJKLMNOPQRST'[m%size]}${size-Math.floor(m/size)}`}
export function parentValue(n:GoNode,p:GoNode,perspective:'to_play'|'black'){return perspective==='to_play'?-n.value:p.to_play===1?n.value:-n.value}

const nineP=list(probability,9,9),nineN=list(count,9,9)
export function policyFromVisits(visits:number[],temperature:number){
 if(!Number.isFinite(temperature)||temperature<0.05||temperature>2)throw Error('温度需要0.05–2')
 const logs=visits.map(n=>n>0?Math.log(n)/temperature:-Infinity),max=Math.max(...logs)
 if(!Number.isFinite(max))throw Error('访问总数必须大于0')
 const weights=logs.map(x=>Math.exp(x-max)),sum=weights.reduce<number>((s,n)=>s+n,0)
 return weights.map(n=>n/sum)
}
const checkpoint=fields({name:text,revision:text,training_step:count,policy:nineP,value,visits:nineN,
 evaluation:fields({opponent_revision:text,protocol_hash:text,wins:count,draws:count,losses:count})})
const step=fields({move:integer,visits:nineN,temperature:number,policy:nineP,value,pi:nineP})
const archive=fields({format:choice('selfplay-v2'),checkpoints:list(checkpoint,2,20),games:list(fields({id:text,checkpoint_revision:text,seed:count,steps:list(step,5,9)}),1,40)})
export function parseSelfPlay(v:unknown){const d=archive(v);const revisions=new Set<string>();let last=-1
 for(const c of d.checkpoints){if(revisions.has(c.revision)||c.training_step<=last)throw Error('检查点revision唯一，训练步数递增');revisions.add(c.revision);last=c.training_step;if(Math.abs(c.policy.reduce<number>((a,b)=>a+b,0)-1)>1e-5||!c.visits.some(n=>n>0))throw Error('空棋盘策略未归一化或访问数全0');if(c.evaluation.wins+c.evaluation.draws+c.evaluation.losses===0)throw Error('检查点评估需要至少一局')}
 const ids=new Set<string>();for(const g of d.games){if(ids.has(g.id)||!revisions.has(g.checkpoint_revision))throw Error('对局ID重复或检查点不存在');ids.add(g.id);const b=Array<number>(9).fill(0)
  for(const [i,s] of g.steps.entries()){if(s.move>8||b[s.move]||ticWinner(b))throw Error('非法落子或终局后继续');if(s.policy.some((p,j)=>b[j]!==0&&p>1e-8)||s.visits.some((n,j)=>b[j]!==0&&n!==0)||Math.abs(s.policy.reduce<number>((a,p)=>a+p,0)-1)>1e-5)throw Error('策略/访问必须只在合法点，策略归一化');const pi=policyFromVisits(s.visits,s.temperature);if(pi.some((p,j)=>Math.abs(p-s.pi[j])>1e-5)||s.pi[s.move]<=0)throw Error('π必须由实际访问数与温度得到，落子应在π支持集');b[s.move]=i%2+1}
  if(!ticWinner(b)&&b.includes(0))throw Error('对局没有终局，不能回填z')
 }return d}
