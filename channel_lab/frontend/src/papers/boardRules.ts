export function goMove(board:number[],size:number,move:number|null,player:number,ancestors:number[][]){
 if(![9,19].includes(size)||board.length!==size*size||board.some(n=>![0,1,2].includes(n))||![1,2].includes(player))throw Error('围棋棋盘尺寸、棋子或行动方错误')
 if(move===null)return [...board]
 if(!Number.isInteger(move)||move<0||move>=board.length||board[move]!==0)throw Error('围棋落点越界或被占用')
 const next=[...board];next[move]=player
 const neighbors=(p:number)=>[p%size>0?p-1:-1,p%size<size-1?p+1:-1,p>=size?p-size:-1,p<board.length-size?p+size:-1].filter(x=>x>=0)
 function group(start:number){const stones=new Set([start]),todo=[start];let liberty=false;while(todo.length){const p=todo.pop()!;for(const q of neighbors(p)){if(next[q]===0)liberty=true;else if(next[q]===next[start]&&!stones.has(q)){stones.add(q);todo.push(q)}}}return {stones,liberty}}
 for(const p of neighbors(move))if(next[p]===3-player){const g=group(p);if(!g.liberty)for(const s of g.stones)next[s]=0}
 if(!group(move).liberty)throw Error('该规则集不允许自杀落子')
 if(ancestors.some(b=>b.every((v,i)=>v===next[i])))throw Error('落子违反位置超级劫规则')
 return next
}
export function ticWinner(board:number[]){for(const [a,b,c] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];return 0}
