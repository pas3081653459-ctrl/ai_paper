/** Experience categories complement (do not replace) the original subject categories. */
export const lessonCategories = [
  {name:'稀疏路由与多模态生成',note:'数学与位置练习无需权重；真实路由和多模态帧由本地记录导入，不自动下载模型。',papers:[
    {id:'23',name:'Mixtral · 语境与专家路由'},{id:'25',name:'MMaDA · 去噪分镜'}]},
  {name:'原文证据实验',note:'内置案例直接可用，无需模型权重；学习记录仅保存在当前浏览器。',papers:[
    {id:'09',name:'Scaling Laws · 拟合预测'},{id:'15',name:'Chinchilla · 预算分配'},
    {id:'17',name:'LLaMA · 模型选型'},{id:'18',name:'GPT-4 · 证据审查'}]},
  {name:'图片空间操作',note:'照片操作可直接使用；真实模型输出需要配置本地权重。没有模拟分类、掩码或回答。',papers:[
    {id:'10',name:'ViT · 照片拆解'},{id:'20',name:'SAM · 对象选择'},{id:'19',name:'LLaVA · 回答取证'}]},
  {name:'语言上下文',note:'输入编辑与原文证据无需权重；06/07/08真实推理需本地BERT/GPT-2，05读取外部训练记录。',papers:[
    {id:'06',name:'BERT · 开放线索'},{id:'07',name:'GPT-2 · 续写编辑器'},
    {id:'08',name:'GPT-3 · 示例卡对照'},{id:'05',name:'GPT-1 · 迁移档案'}]},
  {name:'搜索与学习闭环',note:'规则练习与井字棋UCT无需权重；真实围棋搜索和训练成长需导入有来源的记录。',papers:[
    {id:'02',name:'AlphaGo · 棋盘与搜索树'},{id:'03',name:'AlphaZero · 自我对弈样本'}]},
  {name:'训练信号与推理对照',note:'盲评练习与数学算例无需权重；实际生成/NLL复用本地GPT-2，明确为替代实验，不训练。',papers:[
    {id:'13',name:'InstructGPT · 偏好盲评'},{id:'14',name:'CoT · 解答核验'},
    {id:'22',name:'Toolformer · 样本过滤'},{id:'24',name:'DeepSeek-R1 · 组内奖励'}]},
]
