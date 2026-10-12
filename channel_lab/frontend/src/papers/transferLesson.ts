import {fields,list,text,number,choice} from './traceValidation'
export const transferTasks=[
 {name:'情感分类',input:['[START] 电影很好看 [CLASSIFY]'],read:'取最后有效位置 → [B,C]',head:'Linear(C,2)',shape:'[B,2]',slots:['负面','正面'],note:'末尾位置能读取整个前缀；有右侧padding时不能直接取数组最后一格。',code:'h = backbone(ids)["hidden_states"]  # [B,T,C]\nlast = attention_mask.sum(1) - 1  # 右侧padding，至少一个有效词元\nz = h[torch.arange(h.size(0), device=h.device), last]\nlogits = classifier(z)  # [B,2]'},
 {name:'句子关系',input:['[START] 他养了一只猫 [SEP] 他有宠物 [CLASSIFY]'],read:'读取两句组合的末尾表示 → [B,C]',head:'Linear(C,3)',shape:'[B,3]',slots:['蕴含','矛盾','中立'],note:'分隔符帮助组织结构。标签含义由训练样本规定，不是输出神经元天生知道。',code:'pair_ids = tokenize(premise + SEP + hypothesis + CLASSIFY)\nh = backbone(pair_ids)["hidden_states"]\nlogits = relation_head(last_valid(h, mask))'},
 {name:'多项选择',input:['题目 + 选项A + [CLASSIFY]','题目 + 选项B + [CLASSIFY]','题目 + 选项C + [CLASSIFY]'],read:'共享主干分别处理K个选项 → [B,K,C]',head:'共享 Linear(C,1)',shape:'[B,K]',slots:['选项A分数','选项B分数','选项C分数'],note:'每个选项使用相同的主干和打分头；不是给每个选项训练一套独立网络。',code:'h = backbone(flattened_choices)["hidden_states"] # [B*K,T,C]\nscores = score_head(last_valid(h, mask)).reshape(B,K)\nloss = cross_entropy(scores, correct_choice)'},
 {name:'实体识别',input:['他 / 在 / 苹果 / 工作'],read:'保留每个位置 → [B,T,C]',head:'逐位置 Linear(C,K)',shape:'[B,T,K]',slots:['他：标签槽','在：标签槽','苹果：标签槽','工作：标签槽'],note:'这是通用任务头例子，不是GPT-1论文全部采用的任务。因果主干中，“苹果”位置看不到“工作”；BERT可以。',code:'h = backbone(ids)["hidden_states"]\nlogits = token_head(h) # [B,T,K]\n# 损失需要忽略padding，并正确对齐子词与标签'},
 {name:'抽取式问答',input:['问题：在哪里工作？ [SEP] 文章：他在苹果工作。'],read:'读取文章中每个位置 → [B,T,C]',head:'Linear(C,2)：起点/终点',shape:'两组 [B,T]',slots:['答案起点分数','答案终点分数'],note:'预测文章中的位置，不是在词表中生成答案。要屏蔽问题区和padding，并约束结束位置不早于开始。',code:'h = backbone(ids)["hidden_states"]\nstart, end = span_head(h).unbind(-1) # 两组[B,T]\n# 限制到文章位置，再选合法答案区间'},
 {name:'生成式回答',input:['问题或指令 + 已有回答前缀'],read:'各位置输出下一词元分布',head:'保留 Linear(C,V) 词表头',shape:'[B,T,V]',slots:['词表中的V个分数'],note:'任务可以写成文本生成，因此不一定更换输出头。训练时需说明哪些位置计入损失。',code:'logits = lm_head(backbone(ids)["hidden_states"])\n# logits[:,t] 对齐下一token；按任务屏蔽不监督的位置\n# 生成时取最后有效位置，选择token，再追加到输入'}
]
const label=choice('negative','positive')
const sample=fields({id:text,sentence:text,label})
const point=fields({id:text,x:number,y:number,prediction:label})
const stage=fields({key:choice('random','pretrained','head_only','full'),checkpoint:text,points:list(point,2,200)})
const schema=fields({projection:fields({method:text,fit_on:text,fingerprint:text}),split:text,samples:list(sample,2,200),stages:list(stage,4,4)})
export function parseTransferTrace(value:unknown){const d=schema(value),ids=d.samples.map(s=>s.id);if(new Set(ids).size!==ids.length||new Set(d.stages.map(s=>s.key)).size!==4)throw Error('样本ID或阶段重复');for(const s of d.stages){if(s.points.length!==ids.length||new Set(s.points.map(p=>p.id)).size!==ids.length||s.points.some(p=>!ids.includes(p.id)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6))throw Error('阶段样本不一致或坐标越界')}
 const base=d.stages.find(s=>s.key==='pretrained')!,head=d.stages.find(s=>s.key==='head_only')!
 for(const p of base.points){const q=head.points.find(q=>q.id===p.id)!;if(Math.abs(p.x-q.x)>1e-6||Math.abs(p.y-q.y)>1e-6)throw Error('冻结主干的表示应与预训练阶段一致（相同eval输入与投影）')}
 return d}
export type TransferTrace=ReturnType<typeof parseTransferTrace>
