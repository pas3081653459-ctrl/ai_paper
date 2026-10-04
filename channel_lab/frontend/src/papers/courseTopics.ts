/** Learner-facing subjects: every paper has one primary home in the catalogue. */
export const courseTopics = [
 {id:'vision',name:'图像识别与分割',question:'网络怎样看见图片中的物体？',description:'从通道响应、图像切块到提示分割。',papers:['01','10','20']},
 {id:'language',name:'语言与注意力',question:'文字怎样变成模型能处理的信息？',description:'理解注意力、预训练、续写和上下文示例。',papers:['04','05','06','07','08']},
 {id:'multimodal',name:'图文与生成',question:'图片与文字怎样关联，又如何生成？',description:'探索图文匹配、视觉问答和扩散去噪。',papers:['11','12','19','25']},
 {id:'agents',name:'搜索与行动',question:'模型怎样选择行动并利用反馈？',description:'在棋盘和工具环境中追踪搜索与学习。',papers:['02','03','21']},
 {id:'reasoning',name:'训练信号与推理',question:'回答怎样评价，工具怎样帮助学习？',description:'比较偏好、公开解答、工具收益和组内奖励。',papers:['13','14','22','24']},
 {id:'scaling',name:'规模、效率与证据',question:'更大的模型，何时值得投入？',description:'学习预算分配、稀疏专家和报告证据审查。',papers:['09','15','17','18','23']}
]
export const topicHref=(id:string)=>`#/papers?topic=${encodeURIComponent(id)}`
