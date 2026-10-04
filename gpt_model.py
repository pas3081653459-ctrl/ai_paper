"""学习用小型 GPT：因果自注意力 Decoder-only + 下一个词元预测头。

没有训练、下载或生成循环。没有 Encoder，也没有读取 Encoder 的交叉注意力。
本例使用 GPT-2 风格 Pre-LN；不是现代大型 GPT 的完整复现。
"""

from torch import nn

from transformer_layers import FeedForward, SelfAttention, position_ids_for


class GPTBlock(nn.Module):
    def __init__(self, hidden_size=128, num_heads=4, dropout=0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(hidden_size)
        self.norm2 = nn.LayerNorm(hidden_size)
        self.attention = SelfAttention(hidden_size, num_heads, dropout, causal=True)
        self.feed_forward = FeedForward(hidden_size)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, attention_mask=None):
        # Pre-LN：先 LayerNorm，再子层计算，最后与原始输入相加。
        x = x + self.dropout(self.attention(self.norm1(x), attention_mask))
        x = x + self.dropout(self.feed_forward(self.norm2(x)))
        return x  # [B,T,C]


class TinyGPT(nn.Module):
    def __init__(self, vocab_size=1000, max_length=128, hidden_size=128,
                 num_heads=4, num_layers=2, dropout=0.1):
        super().__init__()
        if num_layers < 1:
            raise ValueError("num_layers 必须至少为 1")
        self.max_length = max_length#模型最多接受输入多少token
        self.token_embedding = nn.Embedding(vocab_size, hidden_size)#词的向量表，通过隐藏层来表示词意，可训练
        self.position_embedding = nn.Embedding(max_length, hidden_size)#句子的位置信息，可训练，max_length既上下文长度
        self.dropout = nn.Dropout(dropout)#dropout一种正则化方法，随机将参数变为0，减少神经元依赖
        self.blocks = nn.ModuleList([
            GPTBlock(hidden_size, num_heads, dropout) for _ in range(num_layers)
        ])
        self.final_norm = nn.LayerNorm(hidden_size)#特征归一化，只作用于最后一个维度
        self.lm_head = nn.Linear(hidden_size, vocab_size, bias=False)
        self.lm_head.weight = self.token_embedding.weight

    def forward(self, input_ids, attention_mask=None):
        """input_ids: 整数词元编号 [B,T]；attention_mask: [B,T]，1=有效。

        仅支持本例的绝对位置编号与右侧 padding；不传 mask 时全部有效。
        输出的第 t 个位置用于预测第 t+1 个词元，不是重建第 t 个输入。
        padding 位置的输出应忽略；有 padding 时不能直接取 logits[:, -1]。
        """
        positions = position_ids_for(input_ids, self.max_length)
        x = self.token_embedding(input_ids) + self.position_embedding(positions)
        x = self.dropout(x)  # [B,T,C]
        for block in self.blocks:
            x = block(x, attention_mask)
        x = self.final_norm(x)
        logits = self.lm_head(x)  # [B,T,V]，V=词表大小，不做 softmax
        return {"hidden_states": x, "logits": logits}


# 因果遮罩示例：行是当前 query，列是它能读取的 key，1=可见。
#             词元0  词元1  词元2  词元3
# 词元0          1      0      0      0
# 词元1          1      1      0      0
# 词元2          1      1      1      0
# 词元3          1      1      1      1
#
# 输入「我 喜欢 猫」时，每个位置的含义：
# logits[:,0] 根据「我」预测下一个词元
# logits[:,1] 根据「我 喜欢」预测下一个词元
# logits[:,2] 根据「我 喜欢 猫」预测下一个词元
#
# 形状示例（仅注释，不执行）：
# input_ids=[2,8] -> hidden_states=[2,8,128] -> logits=[2,8,1000]
# 未训练参数产生的词表分数没有实际语言能力。
