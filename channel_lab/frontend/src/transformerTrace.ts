import { demo, embedding, Wq, Wk, Wv, Wo, W1, W2, vocabulary, type Matrix } from './transformerDemo'

export type DemoResult = ReturnType<typeof demo>
export type TensorKey = 'ids'|'tokens'|'positions'|'x'|'u'|'q'|'k'|'v'|'scores'|'masked'|'weights'|'context'|'concat'|'projected'|'residual'|'normalized'|'expanded'|'activated'|'ffn'|'output'|'final'|'logits'|'probabilities'
export interface TensorNode {
  key: TensorKey; title: string; operation: string; shape: number[]; axes: string[];
  slices: Matrix[]; parents: TensorKey[]; column: number; lane: number; chapter: number;
  explanation: string; code: string; probability?: boolean
}
export interface CellIndex { slice: number; row: number; col: number }
export interface Contribution { source: string; value: number; factor?: number; product: number }
export interface CellTrace { formula: string; explanation: string; terms: Contribution[] }

/** 拓扑与数值分离：所有格子直接取自已有 demo 的中间结果。 */
export function tensorNodes(data: DemoResult, ids: number[]): TensorNode[] {
  const nodes: TensorNode[]=[]
  function add(key:TensorKey,title:string,operation:string,slices:Matrix[],parents:TensorKey[],column:number,lane:number,chapter:number,explanation:string,code:string,attention=false,probability=false) {
    const rows=slices[0].length,cols=slices[0][0].length
    const multi=['q','k','v','scores','masked','weights','context'].includes(key)
    nodes.push({key,title,operation,slices,parents,column,lane,chapter,explanation,code,probability,
      shape:key==='ids'?[1,ids.length]:multi?[1,slices.length,rows,cols]:[1,rows,cols],
      axes:key==='ids'?['B','T']:multi?['B','H',attention?'T_query':'T',attention?'T_key':'D']:['B','T',key==='logits'||key==='probabilities'?'V':key==='expanded'||key==='activated'?'F':'C']})
  }
  add('ids','词元编号','Tokenizer',[ids.map(id=>[id])],[],0,1,0,'每个位置一个整数编号。这里展示 [B,T] 的单个 batch，立体厚度只是视觉厚度。','input_ids  # [1,4]')
  add('tokens','词嵌入','Embedding',[data.tokens],['ids'],1,1,0,'一次查表将每个整数变成 C 个浮点数；词表 E 是参数。','e = token_embedding(input_ids)')
  add('positions','位置编码','Sin / Cos',[data.positions],[],1,0,0,'由位置 0…T−1 和通道编号确定，与词义无关。本例用正弦编码。','pe[p,2*i] = sin(p / 10000**(2*i/C))\npe[p,2*i+1] = cos(p / 10000**(2*i/C))')
  add('x','输入向量 X','逐元素相加',[data.x],['tokens','positions'],2,1,0,'相加保持 C=4；不是把两个向量拼成 C=8。X 还直接流入第一次残差相加。','x = e + pe')
  add('u','归一化 U','LayerNorm 1',[data.u],['x'],3,1,1,'每个 token 独立归一化四个特征；不会混合其他词元。','u = norm1(x)')
  for(const [key,title,w] of [['q','Query','WQ'],['k','Key','WK'],['v','Value','WV']] as const)
    add(key,title,'Linear → 分头',data.heads.map(h=>h[key]),['u'],4,key==='q'?0:key==='k'?1:2,1,'先投影 [1,4,4]，再 reshape 与 transpose 为 [1,2,4,2]。前后都是 16 个数，仅重新分组。',`${key} = (u @ ${w}).reshape(1,4,2,2).transpose(1,2)`)
  add('scores','匹配分数 S','Q × Kᵀ / √D',data.heads.map(h=>h.scores),['q','k'],5,1,2,'每个头有一张 4×4 关系表。行=查询位置，列=被读取位置；这一维不再是特征通道。','scores = q @ k.transpose(-2,-1) / sqrt(2)',true)
  add('masked','掩码分数 L','温度 + Mask',data.heads.map(h=>h.masked),['scores'],6,1,2,'遮住未来位置时填 −∞。这里包含顶部滑块的注意力温度，默认 τ=1。','masked = (scores / temperature).masked_fill(~allowed, -inf)',true)
  add('weights','注意力 A','逐行 Softmax',data.heads.map(h=>h.weights),['masked'],7,1,3,'每一行独立归一化到总和 1。被遮住位置变为 0；每个头一张分布。','a = softmax(masked, dim=-1)',true,true)
  add('context','汇总结果 Z','A × V',data.heads.map(h=>h.context),['weights','v'],8,1,3,'关系表加权各位置的 Value，输出恢复成每个位置 D=2 个特征。','z = a @ v')
  add('concat','合并各头','Transpose / Reshape',[data.concat],['context'],9,1,4,'把 Head 1 和 Head 2 的两个特征拼回四个；16 个数一个也没增加。','z = z.transpose(1,2).contiguous().reshape(1,4,4)')
  add('projected','注意力输出 O','Linear WO',[data.projected],['concat'],10,1,4,'输出投影在特征维混合两个头的信息。','o = z @ WO')
  add('residual','第一处残差 R','X + O',[data.residual],['x','projected'],11,1,5,'捷径上的 X 跳过归一化和注意力，和 O 对应元素相加；不增加通道数。','r = x + o')
  add('normalized','归一化 LN(R)','LayerNorm 2',[data.normalized],['residual'],12,1,5,'仍然只沿当前 token 的特征维归一化。','u2 = norm2(r)')
  add('expanded','FFN 扩展','Linear 4 → 8',[data.expanded],['normalized'],13,1,5,'每个 token 从 4 个特征扩展到 8 个。序列长度仍是 4；所有位置共享 W₁。','f1 = u2 @ W1')
  add('activated','非线性激活','GELU',[data.activated],['expanded'],14,1,5,'逐元素变换，形状不变；与 ReLU 不同，部分负值仍会保留。','f2 = gelu(f1, approximate="tanh")')
  add('ffn','FFN 输出 F','Linear 8 → 4',[data.ffn],['activated'],15,1,5,'把 8 个特征投影回 4 个，才能与残差 R 对齐相加。','f = f2 @ W2')
  add('output','Block 输出 Y','R + F',[data.output],['residual','ffn'],16,1,5,'第二条捷径绕过 FFN。一个完整 Block 结束，输出仍为 [1,4,4]。','y = r + f')
  add('final','最终上下文 H','Final LayerNorm',[data.final],['output'],17,1,6,'GPT 风格最终归一化；本例只有一个 Block，实际模型通常堆叠多个。','hidden = final_norm(y)')
  add('logits','词表分数','Linear 4 → 6',[data.logits],['final'],18,1,6,'最后一维变成词表大小 V=6。输出分数还不是概率；输出权重与词嵌入表绑定。','logits = hidden @ E.T')
  add('probabilities','词表概率','逐行 Softmax',[data.probabilities],['logits'],19,1,6,'每个位置对六个候选 token 的分布。未训练数值没有语言预测能力。','probabilities = logits.softmax(-1)',false,true)
  return nodes
}

export function traceCell(node:TensorNode, index:CellIndex, data:DemoResult, ids:number[], temperature:number):CellTrace {
  const {slice:h,row:r,col:c}=index
  const terms:Contribution[]=[]
  const result=node.slices[h][r][c]
  const fmt=(v:number)=>Number.isFinite(v)?v.toFixed(6):'−∞'
  const product=(source:string,value:number,factor:number)=>terms.push({source,value,factor,product:value*factor})
  const scalar=(source:string,value:number)=>terms.push({source,value,product:value})
  let formula='', explanation=''
  function linear(input:Matrix, weights:Matrix, col:number, inputName:string, weightName:string) {
    input[r].forEach((value,k)=>product(`${inputName}[${r},${k}] × ${weightName}[${k},${col}]`,value,weights[k][col]))
    formula=`Σ ${terms.length} 项乘积 = ${fmt(result)}`
    explanation='只混合当前 token 的特征列，不跨 token。权重固定，输入改变时结果会重新计算。'
  }
  switch(node.key) {
    case 'ids': formula=`token「${vocabulary[ids[r]]}」→ 编号 ${ids[r]}`; explanation='这是固定教学词表映射，不是神经网络计算。'; break
    case 'tokens': formula=`E[${ids[r]},${c}] = ${fmt(result)}`; scalar(`词表第 ${ids[r]} 行，第 ${c} 列`,embedding[ids[r]][c]); explanation='Embedding 按整数索引查行，不是用整数大小计算语义。'; break
    case 'positions': formula=`${c%2?'cos':'sin'}(${r} / 10000^(${2*Math.floor(c/2)}/4)) = ${fmt(result)}`; explanation='偶数维 sin，奇数维 cos。这里的位置编码不是学习参数。'; break
    case 'x': scalar(`E[token ${ids[r]},${c}]`,data.tokens[r][c]); scalar(`PE[${r},${c}]`,data.positions[r][c]); formula=`两项相加 = ${fmt(result)}`; break
    case 'u': case 'normalized': case 'final': {
      const row=(node.key==='u'?data.x:node.key==='normalized'?data.residual:data.output)[r]
      const mean=row.reduce((a,b)=>a+b,0)/row.length
      const variance=row.reduce((a,b)=>a+(b-mean)**2,0)/row.length
      row.forEach((v,j)=>scalar(`当前 token 的特征 ${j}`,v))
      formula=`μ=${fmt(mean)}；σ²=${fmt(variance)}\n(${fmt(row[c])} − ${fmt(mean)}) / √(${fmt(variance)} + 0.00001) = ${fmt(result)}`
      explanation='γ=1、β=0。均值与方差来自这一整行，不是来自整个批次。'; break
    }
    case 'q': case 'k': case 'v': {
      const weights=node.key==='q'?Wq:node.key==='k'?Wk:Wv
      linear(data.u,weights,h*2+c,'U',`W${node.key.toUpperCase()}`)
      explanation=`Head ${h+1} 的第 ${c} 维对应完整投影结果第 ${h*2+c} 列。先投影、再拆头，没有新添数值。`; break
    }
    case 'scores': data.heads[h].q[r].forEach((v,d)=>product(`Q[${r},${d}] × K[${c},${d}]`,v,data.heads[h].k[c][d])); formula=`(${terms.map(t=>fmt(t.product)).join(' + ')}) / √2 = ${fmt(result)}`; explanation='行 r 查询列 c，先在头内特征维做点积，再按 √D 缩放。'; break
    case 'masked': scalar('缩放点积分数',data.heads[h].scores[r][c]); formula=Number.isFinite(result)?`${fmt(data.heads[h].scores[r][c])} / τ(${temperature}) = ${fmt(result)}`:'未来位置：强制写入 −∞'; explanation='掩码不会删除矩阵格子，而是改变格子的数值，使其 Softmax 权重为 0。'; break
    case 'weights': case 'probabilities': {
      const row=node.key==='weights'?data.heads[h].masked[r]:data.logits[r]
      const max=Math.max(...row)
      row.forEach((v,j)=>scalar(`exp(L[${r},${j}] − max)`,Math.exp(v-max)))
      const denominator=terms.reduce((a,t)=>a+t.value,0)
      formula=`max=${fmt(max)}\n${fmt(terms[c].value)} / ${fmt(denominator)} = ${fmt(result)}`
      explanation='分母包含当前行全部候选。−∞ 的指数为 0。注意力概率与词表概率是两个不同的分布。'; break
    }
    case 'context': data.heads[h].weights[r].forEach((w,j)=>product(`A[${r},${j}] × V[${j},${c}]`,w,data.heads[h].v[j][c])); formula=`Σ 四个位置的贡献 = ${fmt(result)}`; explanation='这里真正跨 token 汇总：权重来自 Query 所在行，内容来自每个位置的 Value。'; break
    case 'concat': formula=`Z[head=${Math.floor(c/2)}, token=${r}, dim=${c%2}] → Concat[${r},${c}] = ${fmt(result)}`; explanation='同一个数搬到新的索引位置，没有加法或学习参数。'; break
    case 'projected': linear(data.concat,Wo,c,'Concat','WO'); break
    case 'residual': scalar(`原始 X[${r},${c}]`,data.x[r][c]); scalar(`注意力 O[${r},${c}]`,data.projected[r][c]); formula=`X + O = ${fmt(result)}`; explanation='橙色捷径直接携带 X，两条路径逐元素相加。'; break
    case 'expanded': linear(data.normalized,W1,c,'LN(R)','W1'); break
    case 'activated': scalar('GELU 输入',data.expanded[r][c]); formula=`0.5x × (1 + tanh(√(2/π) × (x + 0.044715x³))) = ${fmt(result)}`; explanation='tanh 近似 GELU；不会读取其他格子。'; break
    case 'ffn': linear(data.activated,W2,c,'GELU','W2'); break
    case 'output': scalar(`残差 R[${r},${c}]`,data.residual[r][c]); scalar(`FFN F[${r},${c}]`,data.ffn[r][c]); formula=`R + F = ${fmt(result)}`; explanation='两路都必须是同一形状 [1,4,4]，因此 FFN 要先从 8 维投影回 4 维。'; break
    case 'logits': linear(data.final,embedding[0].map((_,i)=>embedding.map(row=>row[i])),c,'H','Eᵀ'); explanation=`第 ${c} 列是候选「${vocabulary[c]}」的原始分数，还不是概率。`; break
  }
  return {formula,explanation,terms}
}
