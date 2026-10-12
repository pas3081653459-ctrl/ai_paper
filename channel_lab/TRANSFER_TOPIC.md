# 从预测下一个词，到完成不同任务

入口：`#/topics/pretraining-to-tasks`。首页分类下、语言与注意力分类、GPT-1（05）/BERT（06）课内均有专题入口。不作为第25篇论文计入原24课。

2026-10-12：源码实现和静态阅读检查；未编译、启动、执行项目、训练或下载权重，dist未更新。

## 五个场景

1. **任务工作台**：六种任务切换输入卡、表示读取位置、输出头和形状。类别与位置仅是槽位，不生成模型预测。实体识别与抽取问答为通用接口扩展，不冒充GPT-1原文Figure 1的全部任务。
2. **表示空间**：说明预测目标如何推动表示学习；读取真实四阶段记录，固定样本、坐标变换与显示尺度。可点击点或通过下拉列表选句子，分别显示真值和预测。没有记录时不生成假分群；不画未经测量的分类边界。
3. **一次微调**：标量x=1、y=1、h=tanh(θx)、z=wh、p=sigmoid(z)、L=−ln(p)。从同一固定起点逐步展示前向、损失、链式导数和一次SGD预览。冻结模式展示理论导数但不应用θ更新，联合模式同时应用旧参数求出的梯度。学习率/模式变化回到起点；不累积训练，不用单样本下降证明泛化。
4. **可见范围**：GPT/BERT左右对照，点击中间词和末尾词。高亮表示允许读取，不表示真实注意力强度。词级分块仅为阅读辅助。末尾GPT可读完整前缀；删因果mask不等于重新进行BERT预训练。
5. **原文检验**：GPT-1 PDF第4页输入组织、第7页迁移层数；BERT第8页Table 5。No NSP双向MLM SQuAD F1=87.9，LTR & No NSP=77.8，说明同时改变目标与可见范围，不伪称单变量mask实验。PDF按需打开，离开证据场景卸载iframe。可展开现有TinyGPT/TinyBERT教学源码。

## 表示记录：外层复用v1

仅浏览器导入，无上传。最多20MiB，2–200个样本，每阶段必须覆盖相同样本ID，四阶段key各出现一次。关键字段如下（是字段说明，不是可以冒充真实记录的样例数据）：

```text
schema_version: 1
paper_id: "transfer"
provenance:
  source, model, revision, created_at, recorder: 非空字符串
  settings: 对象，至少说明任务、划分、分词、pooling、eval模式、训练配置、各阶段预测头来源

data:
  projection:
    method: 投影方法
    fit_on: 在哪些数据/阶段拟合
    fingerprint: 固定投影变换的可追溯标识
  split: 样本划分描述
  samples:
    - id: 唯一ID
      sentence: 原句
      label: "negative" 或 "positive"
  stages: 恰好4项
    - key: "random" / "pretrained" / "head_only" / "full"
      checkpoint: 实际模型及头检查点标识
      points:
        - id: 样本ID
          x, y: 实际表示经过固定变换得到的有限坐标，绝对值≤1e6
          prediction: "negative" 或 "positive"
```

准备流程：固定评测样本与tokenization/pooling，在eval模式读取各检查点表示；只拟合一次投影变换，再用于所有阶段，不能各阶段各自拟合t-SNE后直接比较移动。分类预测必须来自实际指定的头，不能由二维坐标人工划线填充。冻结主干的head_only坐标应和pretrained坐标一致；读取器用1e-6容差核对。

投影和来源字段是提供者声明，网页不能独立验证训练过程、坐标是否真来自权重或投影指纹真实性。二维距离不等于完整高维距离，不由分群形状推出“理解程度”。当前没有附带检查点、伪造示例或训练入口，也没有自动采集器；需要用户自己的实际训练/评估流程提供这些记录。

## 文件

- `frontend/src/TransferTopic.vue`：五场景、任务头、微调数学、可见范围、证据。
- `frontend/src/papers/transferLesson.ts`：任务数据和记录校验。
- `frontend/src/components/transfer/RepresentationReplay.vue`：共享尺度表示回放。
- `frontend/src/components/TransferTopicLink.vue`：统一专题入口。
- `frontend/src/transferTopic.css`：响应式布局。

无新增npm依赖或后端接口。没有修改原来模型文件和训练流程。

## 待用户授权后运行验收

- 类型检查、构建；首页/语言分类/05/06四处入口及直接URL、返回和标题。
- 六任务输入/输出形状对应、代码折叠、各场景返回后状态保留。
- 标量梯度与有限差分核对；冻结θ不变、联合更新使用同一旧状态、步骤切换不累积。
- GPT第0/中间/末尾位置可见范围、BERT双向范围；键盘选词和移动布局。
- 四阶段记录：ID重复/缺失、非有限坐标、阶段重复、冻结坐标变化、超限文件拒绝；有效数据投影共用范围，真值颜色与预测标签分离；清除后无旧结果。
- 证据PDF页码、按需iframe、离开后卸载；无记录空态和原文数据不混淆。
``git diff --check``仅为空白/补丁检查，不属于上述运行验证。
