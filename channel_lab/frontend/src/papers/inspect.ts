import type { Experiment, Settings, Stage } from './types'
import type { CellIndex } from '../transformerTrace'
import { attention, dot, embedding, fmt, norm, silu, sum } from './math'
export interface Contribution { label: string; value: number }
export interface Inspection { title: string; equation: string; terms?: Contribution[]; note?: string }
// 重新展开同一固定算子的一项，便于把一个格子追溯到输入；不做参数更新。
export function inspectCell(id:string,s:Settings,lab:Experiment,current:Stage,cell:CellIndex):Inspection|null {
 const {slice:h,row:r,col:c}=cell
 const find=(key:string)=>lab.stages.find(node=>node.id===key)!
 const plane=(key:string,index=0)=>find(key).slices[index]
 const selected=current.slices[h][r][c]
 const equation=(a:number,b:number,op:string)=>`${fmt(a)} ${op} ${fmt(b)} = ${fmt(selected)}`
 if(id==='01'&&current.id==='sum')return {title:'同一位置的两条路径',equation:equation(plane('branch')[r][c],plane('skip')[r][c],'+'),terms:[{label:'主分支 F(x)',value:plane('branch')[r][c]},{label:'捷径',value:plane('skip')[r][c]}]}
 if(id==='01'&&current.id==='output')return {title:'截断负值',equation:`max(0, ${fmt(plane('sum')[r][c])}) = ${fmt(selected)}`}
 if((id==='17'&&current.id==='rms')) {const row=plane('input')[r],rms=Math.sqrt(sum(row.map(v=>v*v))/row.length+1e-5);return {title:'这一行共享同一个均方根',equation:`${fmt(row[c])} / ${fmt(rms)} = ${fmt(selected)}`,terms:row.map((v,i)=>({label:`x[${i}]²`,value:v*v})),note:'平方后求平均，加 1e-5，再开方；不减去均值。'}}
 if(id==='17'&&current.id==='gated')return {title:'同位置的门控乘法',equation:`SiLU(${fmt(plane('gate',0)[r][c])}) × ${fmt(plane('gate',1)[r][c])} = ${fmt(selected)}`,terms:[{label:'SiLU(gate)',value:silu(plane('gate',0)[r][c])},{label:'up',value:plane('gate',1)[r][c]}]}
 let att:ReturnType<typeof attention>|undefined
 if(id==='04'&&current.id==='self')att=attention(plane('target'),true)
 if(id==='04'&&current.id==='cross')att=attention(plane('decoder'),false,plane('source'))
 if(['05','06','07','08'].includes(id)&&current.id==='attention')att=attention(norm(plane('embed')),id!=='06')
 if(id==='10'&&current.id==='attention')att=attention(norm(plane('position')))
 if(id==='19'&&current.id==='attention')att=attention(plane('sequence'),true)
 if(id==='25'&&current.id==='context')att=attention(embedding(plane('mask').map(row=>row[0])))
 if(att) {
  if(!Number.isFinite(att.scores[r][c]))return {title:'未来位置被遮住',equation:'score = −∞ → exp(score) = 0 → attention = 0',note:'这不是低相似度；是因果规则明确禁止读取。'}
  const score=att.scores[r][c],max=Math.max(...att.scores[r]),denom=sum(att.scores[r].map(v=>Math.exp(v-max)))
  return {title:'Query 与 Key 的四项点积',equation:`Q[${r}]·K[${c}] = ${fmt(dot(att.q[r],att.k[c]))}\n除以 √4 → score = ${fmt(score)}\nexp(${fmt(score-max)}) / ${fmt(denom)} = ${fmt(selected)}`,terms:att.q[r].map((v,i)=>({label:`Q[${r},${i}] × K[${c},${i}]`,value:v*att!.k[c][i]})),note:'Softmax 分母来自这一整行；为数值稳定，先统一减去行最大分数。'}
 }
 if(['05','06','07','08'].includes(id)&&current.id==='residual') {
  const input=plane('embed'),a=attention(norm(input),id!=='06'),terms=a.a[r].map((w,j)=>({label:`A[${r},${j}] × V[${j},${c}]`,value:w*a.v[j][c]}))
  return {title:'读取其他词元后加回自己',equation:`注意力加权和 = ${fmt(sum(terms.map(t=>t.value)))}\n输入 ${fmt(input[r][c])} + 加权和 = ${fmt(selected)}`,terms,note:'各项来自同一个 Value 特征维；因果遮罩对应的贡献严格为零。'}
 }
 if(id==='10'&&current.id==='hidden') {const input=plane('position'),a=attention(norm(input));return {title:'patch 聚合再走残差',equation:equation(input[r][c],a.out[r][c],'+'),terms:a.a[r].map((w,j)=>({label:`patch/token ${j} 的贡献`,value:w*a.v[j][c]}))}}
 if(id==='11') {
  const time=s.time??8,abar=Array.from({length:time},(_,i)=>1-(.02+i*.18/19)).reduce((a,b)=>a*b,1)
  if(current.id==='noisy') {const clean=Math.sqrt(abar)*plane('clean')[r][c],noise=Math.sqrt(1-abar)*plane('noise')[r][c];return {title:'信号和噪声各贡献多少',equation:equation(clean,noise,'+'),terms:[{label:'√ᾱ × x₀',value:clean},{label:'√(1−ᾱ) × ε',value:noise}]}}
  if(current.id==='reconstruct')return {title:'反解干净信号',equation:`(${fmt(plane('noisy')[r][c])} − ${fmt(Math.sqrt(1-abar))} × ${fmt(plane('predict')[r][c])}) / ${fmt(Math.sqrt(abar))} = ${fmt(selected)}`}
 }
 if(id==='12'&&current.id==='scores')return {title:'两个单位向量的点积',equation:`Σ 图像[${r},d] × 文本[${c},d] = ${fmt(selected)}`,terms:plane('unit',0)[r].map((v,i)=>({label:`维度 ${i}`,value:v*plane('unit',1)[c][i]}))}
 if(id==='23'&&current.id==='merge') {
  const ids=plane('chosen')[r],gate=plane('gate')[r],terms=ids.map((expert,slot)=>({label:`专家 ${expert}：${fmt(gate[expert])} × ${fmt(plane('experts',slot)[r][c])}`,value:gate[expert]*plane('experts',slot)[r][c]}))
  return {title:'仅两个专家贡献结果',equation:`${fmt(terms[0].value)} + ${fmt(terms[1].value)} = ${fmt(selected)}`,terms,note:'未选中专家的权重为零，前向也未计算这些专家。'}
 }
 if(id==='24'&&current.id==='advantage') {const reward=plane('rewards')[r][0],[mean,std]=plane('statistics')[0];return {title:'与同组回答比较',equation:std<1e-8?'组内标准差为 0 → 本例定义优势为 0':`(${fmt(reward)} − ${fmt(mean)}) / ${fmt(std)} = ${fmt(selected)}`}}
 if(id==='22'&&current.id==='loss')return {title:'目标词概率转成损失',equation:`−log(${fmt(plane('probability')[r][c])}) = ${fmt(selected)}`}
 if(id==='22'&&current.id==='filter'&&c===0){const row=plane('loss')[r];return {title:'与较强基线比较',equation:`min(${fmt(row[0])}, ${fmt(row[1])}) − ${fmt(row[2])} = ${fmt(selected)}`}}
 if(current.probability)return {title:'检查当前行的归一化',equation:`Σ 本行概率 = ${fmt(sum(current.slices[h][r]))}`,note:'行和约为 1。浮点运算与显示舍入可能带来微小误差。'}
 return null
}
