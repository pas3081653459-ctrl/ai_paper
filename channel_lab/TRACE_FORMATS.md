# 论文实验记录契约 v1

最新增量：图片空间操作10/19/20已具备本地worker生成本契约记录的源码，尚未运行、未生成示例输出。入口、配置、限制见 [IMAGE_CATEGORY.md](IMAGE_CATEGORY.md)。图像模型结果与学习笔记是两种不同JSON；笔记不能导入为模型轨迹。

用途：没有在本机加载大模型时，回放来自实际运行的实验记录。本轮只实现读取/校验/交互，没有生成或下载这些模型记录。没有提供数据的页面保留空态。JSON 通过浏览器读取，不上传到后端；来源字段由记录提供者声明，格式通过不代表真实性通过。

## 公共外层

每个 JSON 必须有下面字段。此处是结构说明，不是可冒充实验的示例输出：

```text
{
  schema_version: 1,
  paper_id: "两位论文 ID",
  provenance: {
    source: "实际来源：运行目录/数据集/原文页码或读图方法",
    model: "实际模型或替代引擎名；非模型数据写不适用及原因",
    revision: "实际权重/记录指纹或来源版本",
    created_at: "实际生成日期",
    recorder: "记录脚本和版本",
    settings: { 输入处理、seed、训练/解码设置、设备、单位、控制条件等 }
  },
  data: 下面各课定义的数据对象
}
```

文件 ≤20 MB；所有数值有限，概率 [0,1]；字符串除说明允许空值的字段外非空且 ≤20000 字符。数组最小长度由各组件校验。外部 URL 不作为图片加载：图片必须是内嵌 `data:image/png;base64,...`（也接受 JPEG/WebP），每张 ≤600万字符；不接受 SVG/HTML。轨迹使用适当分辨率的预览，但坐标和 mask 尺寸要相应保持一致。

数据需从实际实验记录转换，不能补造缺失的概率、访问次数、奖励模型分数或解码图。原文表格整理和图像读图需明确注明，不当作本机运行。页面现有原文表格来自 `papers/research*.ts`；本轮没有重新执行论文实验。

## 02 AlphaGo 搜索回放

本类新版入口和数据准备见 [SEARCH_CATEGORY.md](SEARCH_CATEGORY.md)。旧格式仍可加载；新增可选 `root_history`（根以前的棋盘数组，最多200个）与 `statistics:"completed-simulations-v2"`。root_history每项size²，0/1/2；来源由记录者声明，页面检查当前树路径的超级劫时会纳入。

v2约定value为完成模拟平均回报、visits为完成回传计数，不含虚拟损失/初始化伪访问；root.visits=budget，每父节点已导出子访问和≤父访问、子prior和≤1，同ID跨预算身份不变且访问不倒退。允许裁剪树，因此最大候选仅指已记录分支。旧记录没有该约定时只显示来源数值，不据此计算Q+U。value视角换算参见配置说明。

```text
data = {
 size: 9 | 19,
 rules: "no-suicide-positional-superko",
 value_perspective: "to_play" | "black",
 snapshots: [{ budget: 整数, nodes: [{
   id: 字符串, parent: 父节点ID或null, move: 行优先落点编号或null(pass),
   to_play: 1黑或2白, board: size²个0空/1黑/2白,
   prior: [0,1], visits: 非负整数, value: [-1,1]
 }] }]
}
```

快照预算递增、根局面相同。每个快照根节点第一个，parent/move 均 null；其他节点父亲先出现，to_play 交替。move 表示父节点行动方的落子。页面检查提子、禁止自杀、本树祖先上的位置超级劫；根前历史未知，终局计分不验证。节点统计的更新时点、价值符号、是否含虚拟损失需写入 settings。不是任意围棋规则通用格式。

## 03 AlphaZero 小棋种档案

新版主入口要求真实训练记录 `data.format="selfplay-v2"`：

```text
data = {format:"selfplay-v2",
 checkpoints:[{name,revision,training_step,policy:[9概率],value:[-1,1],visits:[9计数],
   evaluation:{opponent_revision,protocol_hash,wins,draws,losses}}],
 games:[{id,checkpoint_revision,seed,steps:[{
   move:0…8,visits:[9计数],temperature:0.05…2,
   policy:[9概率],value:[-1,1],pi:[9概率]
 }]}]}
```

检查点2–20个，revision唯一、training_step递增；policy/value/visits固定为同一个空棋盘、X行动。evaluation总局数>0，对手/协议不同会标记不可公平比较。games为1–40盘，从空棋盘X先走到真实终局，5–9手；game.id唯一、checkpoint_revision必须存在。每步的policy/value为落子前当前行动方的网络输出，visits是实际根行动访问数，π需等于visits按temperature归一化的结果；policy与π归一化且已占位置权重为0，实际move必须在π支持集。计数最大10^8，价值[-1,1]，所有数值有限。

页面由终局按每个样本当前行动方得到z；不读取模型自报胜负，不允许终局后落子。导出单样本为 `kind="derived-training-sample-from-import"`，保留原provenance，不能当作完整档案再导入。

浏览器规则搜索导出为 `kind="rule-search-samples-v1"`，包括每步board/player/move/visits/pi/temperature/seed/budget/z；明确source无网络、无训练。它**不是**上面的v1外层训练档案，不能改名冒充检查点。

以下旧格式保留在“旧版单盘档案”折叠区，不参与新版训练控制比较：

```text
data = {
 checkpoints: [{name, policy: 9维概率, visits: 9维非负整数}],
 moves: [从空棋盘开始的井字棋落点0…8],
 targets: [每个落子前局面的9维搜索目标π]
}
```

checkpoint 至少两个，比较状态固定为空棋盘；不可填当前回放局面的策略。X先行，moves 长5–9，targets与moves等长，终局后不得继续。π归一化、已占点概率0。页面按终局与当前方回填z。记录者须提供实际训练checkpoint和搜索统计来源；只校验数值和合法对局不能证明它来自自我对弈。

## 05 GPT-1 迁移实验

主实验使用新版 `data.format="paired-transfer-v2"`；旧版格式保留在“旧版记录查看”，不参与配对统计：

```text
data = {format:"paired-transfer-v2", metric, direction:"up"|"down", unit,
 split_hash, architecture, pretraining_source,
 runs:[{condition:"random"|"pretrained", seed, label_budget,
 label_subset_hash, optimizer_hash, train_steps,
 points:[{step,value,errors:[{input,expected,predicted}]}]}]}
```

unit无单位时填"score"。label_budget/train_steps为1–10^9整数，指标值绝对值≤10^12；同condition/seed/budget唯一。每run至少2个严格递增且不超过train_steps的实际观测点。errors可空，代表未附记录，不等于没有错误。至少两个run，缺配对或控制字段不同允许查看但不算收益。只有同seed/budget/子集hash/优化hash/总步数的random/pretrained，在同step上才计算差值；方向由direction决定。架构、划分由本记录共同声明，预训练来源必须明确；hash真实性不由页面保证。旧格式如下：

```text
data = {metric, split_hash, runs:[{
 condition:"random"|"pretrained", seed, label_budget,
 points:[{step,value}], errors:[{input,expected,predicted}]
}]}
```

至少两条真实运行，单运行至少两点且step递增；同condition/seed/budget唯一。settings记录相同结构、优化预算、预训练来源、指标方向与单位。页面不插值缺失组合，不把不同指标混成准确率。

## 06 BERT

```text
data = {conditions:[{text, tokens:[词元字符串], input_ids:[整数],
mask_index:整数, attention_mask:[0或1], candidates:[{token,p,id?:整数}]}]}
```

token与ID等长，mask_index有效。attention_mask与token等长，旧记录可省略并标为未提供。候选不可重复，总概率不可超过1（允许浮点误差），top-k之外的候选不可当成0概率。p为完整词表softmax中的概率而非top-k重新归一化。由本地API生成时，必须恰好一个MASK。多条件固定权重；可改变右文，不宣称生成了另一个单向预训练模型。

## 07 GPT-2

```text
data = {conditions:[{text, tokens:[输入词元], input_ids:[整数], attention_mask:[0或1],
 generated:[{id,piece,p}], output:完整解码字符串, stop_reason:"eos"|"length_limit"}]}
```

最多3个条件，每条件1–128个新token。piece/output允许空字符串。p为实际所选token在完整词表上的概率；piece为单token解码，完整文字以output为准。本站API使用贪心解码；外部记录的解码方式写settings。

## 08 GPT-3 上下文条件

主页面双条件批量记录（外层仍schema_version=1；形状与旧版区分）：

```text
data = {dataset_version, conditions:[{name,
 examples:[{id,input,label}], mapping:{positive,negative},
 results:[{test_id,test_input,target,target_class:"positive"|"negative",
 text,tokens,input_ids,attention_mask,generated:[{id,piece,p}],output,
 stop_reason:"eos"|"length_limit",prediction:"positive"|"negative"|"other",correct:布尔}]}]}
```

恰好2条件，各1–20题，测试ID唯一且两条件同序、同文本、同target_class。mapping两个非空标签不相同，target必须等于对应映射。页面独立取output.trim()后的首行，再trim；只有整行等于映射标签才计对应类别，否则other；与记录prediction/correct不一致则拒绝。本地API固定四题、每题最多12token；导入最多128token，输出/片段可空。examples最多4条，是实际提示示例；本地接口不接收测试目标。settings包含GPT-2替代声明、题集版本/指纹、输入和模型指纹。不把四题成绩当GPT-3论文成绩。

以下旧版单题格式在“旧版单题记录回放”折叠区加载，不混入主实验混淆表：

```text
data = {test_input,target,conditions:[{name,prompt,examples:[{input,label}],output}]}
```

至少两个条件，共用同一测试输入和模型；示例顺序以数组表示。prompt是实际完整输入，examples是解释摘要。改标签的条件要在name/settings中说明对应目标，页面不将单个target强行用于全部条件算准确率。原GPT-3不可用时必须注明替代模型。

## 09 Scaling Laws

```text
data = {axis,controls,points:[{x:正数,loss:正数,held_out:布尔}]}
```

至少3点；拟合需至少两个不同x的非留出点。单位、主要瓶颈、原始观测/数字化来源、读图误差写入metadata。held_out为true的点不参与拟合。页面的log-log OLS并非自动复现作者全部拟合方法。

## 13 InstructGPT

新版客户端会匿名洗牌，确认前隐藏stage/reward/provenance。多轮评价单独导出为kind=learner-preference-review，不是模型轨迹；已看过来源的复评不算盲评，轮次数不算人数。默认手写练习不冒充模型阶段。下面模型记录契约保持不变，reward范围±10^6或null。

```text
data = {items:[{prompt,responses:[{stage,text,reward:有限数或null}]}]}
```

每题2–6条回答。stage写真实基础/SFT/偏好优化检查点，不手工改写冒充阶段。为了盲评，记录者预先随机排列回答；客户端隐藏阶段并非严格双盲。缺实际奖励模型分时必须null。人工排序仅本页保留。

## 14 CoT

主入口使用新版：

```text
data = {format:"solution-audit-v2", route:"substitute"|"original-record", dataset_version,
 tasks:[{id,category,question,expected:"规范整数字符串",responses:[
  {condition:"direct"|"worked",text:"实际提示",tokens,input_ids,attention_mask?:[0|1],
   generated:[{id,piece,p}],output,stop_reason:"eos"|"length_limit",answer:"规范整数"|null}
 ]}]}
```

1–30题、ID唯一，responses严格按direct/worked两项排序；输入token/ID等长、generated1–128。piece/output可空。answer必须能从实际output独立提取：CRLF/CR归一成LF，全文恰好一条完整FINAL:带符号ASCII整数行（最多12位），最后非空行必须是它；规范化整数，否则null。expected独立提供并已规范化。所有步骤仅对外公开解答。首错判断导出为读者标注，不混入模型记录。

以下旧版格式在单独折叠区查看：

```text
data = {question,expected,
 direct:{prompt,output,answer},
 cot:{prompt,steps:[公开解答步骤],answer}}
```

steps仅对外公开解答，不收集私有思维。answer是按已说明规则从实际输出提取的最终答案；expected独立于模型生成。精确匹配仅去首尾空格和一个尾部标点，不判断数学等价。读者首错标注不是自动逻辑验证。

## 10 ViT 原图/干预图对照

```text
data = {
 image_size:224, patch_size:整数, hidden_size:D,
 conditions:[{name:"original"|"changed",image:内嵌实验图,input_sha256,
   top:[{id:类别整数,label,p:概率}],
   patch_vectors:[[前min(16,D)维投影]], token_vectors:[[相加后前min(16,D)维]]}],
 position_vectors:[[每个patch位置向量的前min(16,D)维]],
 patch_delta:[每个patch的完整D维RMS变化],
 layer_shapes:[[2,patch数+1,D],...],
 reference_class:{label:原图第一名,probabilities:[原图概率,干预图概率]}
}
```

conditions必须按original/changed排列，两张224方图；patch数量=(224/P)²，所有对应数组等长。CLS不包含在patch_vectors中，但包含在layer_shapes中。投影输入由checkpoint预处理；教学网格不是模型patch配置。settings记录processor、preview_dimensions和固定位置干预方式。只有前16维向量，不能误称完整D维数据；patch_delta在后端使用完整D维计算。

## 19 LLaVA

```text
data = {question,conditions:[{
 name,condition:"original"|"occluded"|"no_image",image:内嵌图像或null,answer
}]}
```

至少两个条件；no_image必须null，其余必须有图。answer允许空字符串以保留EOS/空输出。固定模型、问题及解码设置，说明无图接口是否受支持、遮挡如何生成。旧回放区备注只存本页；主实验取证备注与学习笔记保存在当前浏览器，不把回答句子自动映射成空间因果依据。

本地worker生成original/occluded各一个以及可选no_image，共2–3个条件，另含 `model_view`（处理器实际裁剪图或null）、`input_sha256`、`prompt`、`input_ids`、`generated:[{id,piece,p}]`、`stop_reason:eos|length_limit`。逐token片段可为空；完整answer使用整段token解码。未配置权重时不补造任何字段。

## 20 SAM

```text
data = {image,width,height,cases:[{
 name,points:[{x,y,label:"positive"|"negative"}],box:[x1,y1,x2,y2]或null,
 masks:[{image:同尺寸透明PNG覆盖图,predicted_iou:有限数}]
}]}
```

坐标为记录实验图的像素，不能使用显示缩放后的鼠标坐标。mask背景透明，前景着色；与原图同尺寸，页面会核对解码尺寸。predicted_iou是模型预测分，不是真实标注IoU。回放区只切已记录条件；上方主实验配置本地权重后可任意添加提示并实际运行。

本地worker每次生成一个case；settings另记录image_sha256、cache_key、cache_hit、embedding_shape、multimask_output。图像最长边已在浏览器缩至768，坐标以该实验图为准，不是用户上传文件缩放前的坐标。

## 22 Toolformer

主入口新版：

```text
data = {format:"tool-score-v2", candidates:[{
 call,tool_return,target_text,target_ids:[整数],target_tokens:[字符串],weights:[非负数],
 loss_without:[NLL],loss_empty:[NLL],loss_with:[NLL],
 contexts:[{prefix,prefix_ids:[整数],target_start:整数}]
}]}
```

1–50候选，目标1–64token，各目标/权重/损失数组等长；三个contexts固定顺序无调用/空返回/有返回，target_start等于相应prefix_ids长度。所有上下文共用同一target_ids，记录声明实际输入为prefix_ids+target_ids；前端检查结构不能证明模型确实按这些ID评分。损失/权重范围0–10^6，权重和>0，tool_return可空。

本地worker仅支持1–3个人工候选，执行整数计算器后实际评分；默认权重1/T。Δ使用整段损失的min，再分解逐token贡献；筛选导出kind=filtered-candidates-not-trained-model，不代表已训练。以下旧记录在独立折叠区查看：

```text
data = {candidates:[{
 call,tool_return,target_tokens:[字符串],weights:[非负数],
 loss_without:[非负NLL],loss_empty:[非负NLL],loss_with:[非负NLL]
}]}
```

五个数组等长且权重和>0。三种上下文评估同一目标后缀，须在记录脚本里解决tokenization边界对齐；网页不能仅凭长度证明对齐。使用真实teacher-forced NLL避免小概率下溢，权重不自动归一化。过滤收益为min(无调用,空返回)−有返回的加权总损失。

## 23 Mixtral

```text
data = {experts:2…128,tokens:[{text,padding:布尔}],layers:[{
 name,selected:[[专家编号]],weights:[[对应归一化门控权重]]
}]}
```

每层外层数组长度等于token数，每token selected/weights等长，无重复专家、编号有效、权重和近似1。记录真实top-k结果，不能把未经top-k归一化的全专家softmax直接填进来。统计排除padding；图示不包含未记录的FFN输出或硬件时延。

## 24 DeepSeek-R1

主入口新版：

```text
data = {format:"reward-group-v2",route:"R1-Zero"|"R1"|"substitute",dataset_version,
 tasks:[{id,category,question,expected,answers:[{
  text:"实际提示",tokens,input_ids,generated:[{id,piece,p}],output,
  stop_reason:"eos"|"length_limit",answer:"规范整数"|null,seed?:整数
 }]}]}
```

1–30题、ID唯一、每题2–32条；同题所有text必须一致。按14相同规则从output独立核验answer，不接受与输出不符的自报答案。0/1奖励由页面与expected比较计算；总体std，零方差优势置0。实际token数取generated长度，不拿字符数代替。导入允许R1/R1-Zero但来源真实性需核查；本地API固定substitute，2–8候选，temperature完整词表采样，每条seed+i，p为温度分布中的概率。settings记录真实采样与模型参数。

以下旧单题格式在独立折叠区查看：

```text
data = {route:"R1-Zero"|"R1"|"substitute",question,expected,
 answers:[{text,final_answer}]}
```

同题2–32个实际候选，记录采样参数。页面以最终答案精确匹配得到0/1奖励并算总体标准差，零方差优势设0；不冒充完整原版奖励或GRPO损失。text为可公开输出，字符数不是token数。

## 25 MMaDA

```text
data = {positions:[{kind:"text"|"image",condition:布尔}],frames:[{
 step:非负整数,tokens:[字符串],masked:[布尔],decoded_text:可空字符串,
 decoded_image:内嵌真实解码图或null
}]}
```

帧step递增，各位置数组等长；condition位置不得改变或被mask。必须记录tokenizer/图像decoder版本；没有真实图像解码就null，不用伪彩块替代。允许生成中修订或重新mask响应位置，不要求掩码数单调减少。

## 15 / 17 / 18

目前直接读取已有核查过的 `research*.ts` 表格，不需要轨迹导入。预算/权重存储数值为明确公式推算，不是实测。后续增加新数据时先核对原文页码再改数据文件，不通过JSON伪造“官方结果”。

## 如何生成可信记录

使用相应真实模型/训练脚本在返回值处导出，保持所有条件的控制变量；将训练配置/提示、tokenizer、预处理、模型revision、软件版本和采样设置放入settings。只有实际发生的错误/失败也要保留。不在本轮提供伪轨迹示例来填满页面。

BERT/GPT-2 已有可选本地API能产生兼容外层；其他模型的导出适配器/成套固定示例尚未全部实现。现阶段导入器与交互已写入，不能据此声称已得到真实实验数据。所有新增代码仍待运行验收。

## 稀疏类别 v2（23 / 25）

详见`SPARSE_CATEGORY.md`和可执行语义的前端校验器`frontend/src/papers/sparseTraces.ts`。外层保持`schema_version:1`、`paper_id`、`provenance`、`data`。

23：manifest.json的data为`{format:'routing-pack-v2',experts,top_k,hidden_size,parameter_counts:{total,expert_total},cases:[{id,text,tokens:[{text,id,padding}],layers:[{name,file,sha256}]}]}`。需要2–4个语境、相同层序。层文件是裸对象`{case_id,layer,probabilities:[token][expert],selected:[token][K],weights:[token][K]}`，校验完整概率和、Top-k集合（允许平局）、归一化权重及清单SHA256。旧格式仅在折叠兼容入口读取。

25：data为`{format:'denoise-v2',tokenizer_revision,decoder_revision,mask_id,image_grid:null|{rows,cols},image_shape:null|{width,height},positions:[{kind,condition}],frames:[{step,token_ids,tokens,masked,confidence,decoded_text,decoded_image}]}`。数组均按positions对齐；confidence每项为概率或null。MASK标记须与mask_id一致；固定条件在所有帧保持相同ID与显示字符串。帧step递增；前端核对图片实际解码尺寸。`decoded_image`为内嵌图片或null，绝不将图像token直接画成伪解码图。
