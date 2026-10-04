/** 固定教学参数的完整单 Block 前向计算。不是训练模型或语言能力演示。 */
export type Matrix = number[][]
export const vocabulary = ['我', '喜欢', '猫', '狗', '。', '[结束]']
export const embedding: Matrix = [
  [1, 0, .5, -.5], [0, 1, -.5, .5], [.5, .5, 1, 0],
  [.5, -.5, 0, 1], [0, .2, -.2, .1], [-.2, 0, .1, .3],
]
export const Wq: Matrix = [[1,0,.5,0],[0,1,0,.5],[.5,0,1,0],[0,.5,0,1]]
export const Wk: Matrix = [[.5,0,1,0],[0,1,0,.5],[1,0,0,.5],[0,.5,.5,0]]
export const Wv: Matrix = [[1,0,0,.5],[0,1,.5,0],[.5,0,1,0],[0,.5,0,1]]
export const Wo: Matrix = [[.5,0,.5,0],[0,.5,0,.5],[.5,0,-.5,0],[0,.5,0,-.5]]
export const transpose = (a: Matrix): Matrix => a[0].map((_, j) => a.map(row => row[j]))
export const matmul = (a: Matrix, b: Matrix): Matrix => a.map(row => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)))
export const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((v, j) => v + b[i][j]))
export function norm(a: Matrix): Matrix {
  // 每个 token 沿特征维独立归一化，gamma=1、beta=0、eps=1e-5。
  return a.map(row => {
    const mean = row.reduce((s,v) => s+v, 0) / row.length
    const variance = row.reduce((s,v) => s+(v-mean)**2, 0) / row.length
    return row.map(v => (v-mean)/Math.sqrt(variance+1e-5))
  })
}
export function softmax(row: number[]): number[] {
  const max = Math.max(...row)
  const exp = row.map(v => Math.exp(v-max))
  const sum = exp.reduce((s,v) => s+v, 0)
  return exp.map(v => v/sum)
}
// 固定公式创建可复现的 FFN 参数，不使用随机数或训练。
export const W1 = Array.from({length:4}, (_,i) => Array.from({length:8}, (_,j) => Math.sin((i+1)*(j+1))*.3))
export const W2 = Array.from({length:8}, (_,i) => Array.from({length:4}, (_,j) => Math.cos((i+1)*(j+1))*.3))
export function demo(ids: number[], causal: boolean, temperature: number) {
  const tokens = ids.map(id => embedding[id].slice())
  // 经典正弦位置编码；此处 d_model=4（已有 TinyGPT 则使用可学习位置表）。
  const positions = ids.map((_,p) => [Math.sin(p),Math.cos(p),Math.sin(p/100),Math.cos(p/100)])
  const x = add(tokens, positions)
  const u = norm(x)
  const q = matmul(u,Wq), k = matmul(u,Wk), v = matmul(u,Wv)
  const heads = [0,1].map(h => {
    const slice = (a: Matrix) => a.map(row => row.slice(h*2,h*2+2))
    const qh=slice(q), kh=slice(k), vh=slice(v)
    const dots=matmul(qh,transpose(kh))
    const scores=dots.map(row => row.map(value => value/Math.sqrt(2)))
    const masked=scores.map((row,i) => row.map((value,j) => causal && j>i ? -Infinity : value/temperature))
    const weights=masked.map(softmax)
    return {q:qh,k:kh,v:vh,dots,scores,masked,weights,context:matmul(weights,vh)}
  })
  const concat=heads[0].context.map((row,i) => [...row,...heads[1].context[i]])
  const projected=matmul(concat,Wo)
  const residual=add(x,projected)
  const normalized=norm(residual)
  const expanded=matmul(normalized,W1)
  // GELU 的 tanh 近似，对应 nn.GELU(approximate='tanh')。
  const activated=expanded.map(row => row.map(v => .5*v*(1+Math.tanh(Math.sqrt(2/Math.PI)*(v+.044715*v**3)))))
  const ffn=matmul(activated,W2)
  const output=add(residual,ffn)
  const final=norm(output)
  const logits=matmul(final,transpose(embedding)) // 权重绑定：[T,4] × [4,V]
  return {tokens,positions,x,u,q,k,v,heads,concat,projected,residual,normalized,expanded,activated,ffn,output,final,logits,probabilities:logits.map(softmax)}
}
