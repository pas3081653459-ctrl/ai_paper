import type { Grid, Stage } from './types'
export const grid=(rows:number,cols:number,f:(r:number,c:number)=>number):Grid=>Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>f(r,c)))
export const sum=(v:number[])=>v.reduce((a,b)=>a+b,0)
export const transpose=(a:Grid)=>a[0].map((_,j)=>a.map(row=>row[j]))
export const dot=(a:number[],b:number[])=>sum(a.map((v,i)=>v*b[i]))
export const mm=(a:Grid,b:Grid)=>a.map(row=>transpose(b).map(col=>dot(row,col)))
export const add=(a:Grid,b:Grid)=>a.map((row,i)=>row.map((v,j)=>v+b[i][j]))
export const scale=(a:Grid,k:number)=>a.map(row=>row.map(v=>v*k))
export const softmax=(row:number[])=>{const max=Math.max(...row);const e=row.map(v=>Math.exp(v-max));const s=sum(e);return e.map(v=>v/s)}
export const norm=(x:Grid)=>x.map(row=>{const m=sum(row)/row.length;const v=sum(row.map(x=>(x-m)**2))/row.length;return row.map(x=>(x-m)/Math.sqrt(v+1e-5))})
export const rms=(x:Grid)=>x.map(row=>{const r=Math.sqrt(sum(row.map(v=>v*v))/row.length+1e-5);return row.map(v=>v/r)})
export const weights=(r:number,c:number,seed=1)=>grid(r,c,(i,j)=>Math.sin((i+1)*(j+1)+seed)*.35)
export const embedding=(ids:number[],dim=4)=>ids.map(id=>Array.from({length:dim},(_,j)=>Math.sin((id+1)*(j+1)*.4)))
export const sigmoid=(v:number)=>1/(1+Math.exp(-v))
export const silu=(v:number)=>v*sigmoid(v)
export const gelu=(v:number)=>.5*v*(1+Math.tanh(Math.sqrt(2/Math.PI)*(v+.044715*v**3)))
export const ce=(p:number[],label:number)=>-Math.log(Math.max(1e-12,p[label]))
export const fmt=(n:number)=>Number.isFinite(n)?Number(n.toFixed(4)).toString():'−∞'
export function attention(x:Grid,causal=false,context:Grid=x) {
 const q=mm(x,weights(x[0].length,4,1)),k=mm(context,weights(context[0].length,4,2)),v=mm(context,weights(context[0].length,4,3))
 const scores=mm(q,transpose(k)).map((row,i)=>row.map((v,j)=>causal&&j>i?-Infinity:v/2))
 const a=scores.map(softmax)
 return {q,k,v,scores,a,out:mm(a,v)}
}
export function image(seed=0) {return grid(6,6,(r,c)=>((r>=1&&r<=4&&c>=1&&c<=4)?1:0)+(r===c?.35:0)+seed*.08)}
export function conv(x:Grid,k:Grid,stride=1):Grid {
 const n=Math.ceil(x.length/stride)
 return grid(n,n,(r,c)=>sum(k.flatMap((row,i)=>row.map((v,j)=>v*(x[r*stride+i-1]?.[c*stride+j-1]??0)))))
}
export function stage(id:string,title:string,values:Grid|Grid[],description:string,formula:string,code:string,parents:string[]=[],options:Partial<Stage>={}):Stage {
 const slices:Grid[]=typeof values[0][0]==='number'?[values as Grid]:values as Grid[]
 return {id,title,operation:title,slices,shape:[1,...(slices.length>1?[slices.length]:[]),slices[0].length,slices[0][0].length],axes:slices.length>1?['B','C','H','W']:['B','T','D'],description,formula,code,parents,...options}
}
