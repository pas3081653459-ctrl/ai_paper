/** Actual bounded UCT with uniform random rollouts. No network and no training. */
import {ticWinner} from './boardRules'
export interface TicNode {board:number[];player:number;move:number|null;visits:number;sum:number;children:TicNode[]}
const legal=(b:number[])=>b.flatMap((s,i)=>s===0?[i]:[])
function rng(seed:number){let x=seed>>>0||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function validate(board:number[],player:number){
 if(board.length!==9||board.some(n=>![0,1,2].includes(n))||![1,2].includes(player))throw Error('井字棋棋盘/行动方错误')
 const x=board.filter(n=>n===1).length,o=board.filter(n=>n===2).length
 if(x!==o&&x!==o+1||player!==(x===o?1:2)||ticWinner(board)||!board.includes(0))throw Error('局面计数不符或已经终局')
}
export function searchTic(board:number[],player:number,budget:number,seed:number){
 validate(board,player)
 if(!Number.isInteger(budget)||budget<1||budget>2048||!Number.isInteger(seed)||seed<0||seed>1e8)throw Error('搜索预算1–2048，seed 0–10^8')
 const random=rng(seed),root:TicNode={board:[...board],player,move:null,visits:0,sum:0,children:[]}
 for(let simulation=0;simulation<budget;simulation++){
  let node=root;const path=[root]
  while(!ticWinner(node.board)&&node.board.includes(0)){
   const untried=legal(node.board).filter(m=>!node.children.some(c=>c.move===m))
   if(untried.length){const m=untried[Math.floor(random()*untried.length)],b=[...node.board];b[m]=node.player
    const child:TicNode={board:b,player:3-node.player,move:m,visits:0,sum:0,children:[]};node.children.push(child);node=child;path.push(node);break
   }
   const sign=node.player===player?1:-1,parentVisits=node.visits
   node=node.children.reduce((best,c)=>{const score=(n:TicNode)=>sign*n.sum/n.visits+Math.sqrt(2*Math.log(parentVisits)/n.visits);return score(c)>score(best)?c:best});path.push(node)
  }
  const rollout=[...node.board];let turn=node.player
  while(!ticWinner(rollout)&&rollout.includes(0)){const moves=legal(rollout),m=moves[Math.floor(random()*moves.length)];rollout[m]=turn;turn=3-turn}
  const winner=ticWinner(rollout),reward=winner===0?0:winner===player?1:-1
  for(const n of path){n.visits++;n.sum+=reward}
 }
 const visits=Array<number>(9).fill(0);for(const n of root.children)visits[n.move!]=n.visits
 return {visits,value:root.sum/root.visits,tree:root}
}
export function downloadSearch(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
