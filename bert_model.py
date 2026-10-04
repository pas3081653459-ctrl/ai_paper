"""学习用小型 BERT：双向 Encoder + 掩码词元预测头 + 句子分类头。

没有训练、下载或推理入口。不是完整原版 BERT，也不是预训练模型。
阅读顺序：TinyBERT.forward -> BertBlock.forward -> SelfAttention.forward。
"""

import torch
from torch import nn

from transformer_layers import FeedForward, SelfAttention, position_ids_for


class BertBlock(nn.Module):
    def __init__(self, hidden_size=128, num_heads=4, dropout=0.1):
        super().__init__()
        self.attention = SelfAttention(hidden_size, num_heads, dropout, causal=False)
        self.feed_forward = FeedForward(hidden_size)
        self.norm1 = nn.LayerNorm(hidden_size)
        self.norm2 = nn.LayerNorm(hidden_size)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, attention_mask=None):
        # BERT 风格 Post-LN：先子层计算与残差相加，再 LayerNorm。
        # 没有因果遮罩：每个有效 token 都能读取两侧的有效 token。
        x = self.norm1(x + self.dropout(self.attention(x, attention_mask)))
        x = self.norm2(x + self.dropout(self.feed_forward(x)))
        return x  # [B,T,C]；整个 Block 保持形状不变


class TinyBERT(nn.Module):
    def __init__(self, vocab_size=1000, max_length=128, hidden_size=128,
                 num_heads=4, num_layers=2, num_classes=2, dropout=0.1):
        super().__init__()
        if num_layers < 1:
            raise ValueError("num_layers 必须至少为 1")
        self.max_length = max_length
        self.token_embedding = nn.Embedding(vocab_size, hidden_size)
        self.position_embedding = nn.Embedding(max_length, hidden_size)
        # 句段编号 0/1：用于区分输入中的两段文本，不是位置编号。
        self.segment_embedding = nn.Embedding(2, hidden_size)
        self.embedding_norm = nn.LayerNorm(hidden_size)
        self.dropout = nn.Dropout(dropout)
        self.blocks = nn.ModuleList([
            BertBlock(hidden_size, num_heads, dropout) for _ in range(num_layers)
        ])

        # MLM 头：将每个位置的上下文向量转换成整个词表的分数。
        self.mlm_dense = nn.Linear(hidden_size, hidden_size)
        self.mlm_activation = nn.GELU()
        self.mlm_norm = nn.LayerNorm(hidden_size)
        self.mlm_decoder = nn.Linear(hidden_size, vocab_size)
        # 输入词嵌入与输出词表投影共享权重，形状都是 [V,C]。
        self.mlm_decoder.weight = self.token_embedding.weight

        # 句子分类头：要求调用者把 [CLS] 放在输入的第一个位置。
        self.pooler = nn.Linear(hidden_size, hidden_size)
        self.classifier = nn.Linear(hidden_size, num_classes)

    def forward(self, input_ids, attention_mask=None, token_type_ids=None):
        """输入：整数词元编号 [B,T]，编号范围 [0,vocab_size)。

        attention_mask: [B,T]，1=真实词元，0=右侧 padding；不传则全部有效。
        token_type_ids: [B,T]，元素为 0 或 1；单句时可不传。
        [CLS]/[SEP]/[MASK] 的编号由调用者指定，本模型不自动插入特殊词元。
        padding 位置的输出没有任务意义，使用时应忽略。
        """
        positions = position_ids_for(input_ids, self.max_length)
        if token_type_ids is None:
            token_type_ids = torch.zeros_like(input_ids)
        if token_type_ids.shape != input_ids.shape:
            raise ValueError("token_type_ids 与 input_ids 的形状必须相同")

        # 三种 embedding 逐元素相加，隐藏维度依然是 C，不是 3C。
        x = (self.token_embedding(input_ids)
             + self.position_embedding(positions)
             + self.segment_embedding(token_type_ids))  # [B,T,C]
        x = self.dropout(self.embedding_norm(x))
        for block in self.blocks:
            x = block(x, attention_mask)

        mlm_hidden = self.mlm_norm(self.mlm_activation(self.mlm_dense(x)))
        mlm_logits = self.mlm_decoder(mlm_hidden)  # [B,T,V]
        cls_vector = torch.tanh(self.pooler(x[:, 0]))  # [B,C]
        class_logits = self.classifier(self.dropout(cls_vector))  # [B,num_classes]
        return {"hidden_states": x, "mlm_logits": mlm_logits, "class_logits": class_logits}


# 形状示例（仅注释，不执行）：
# input_ids=[B=2,T=8] -> hidden_states=[2,8,128]
#                    -> mlm_logits=[2,8,1000]，每个位置的词表分数
#                    -> class_logits=[2,2]，整句的分类分数
# MLM 的 [MASK] 是输入词元，不是 attention_mask=0：它仍然参与注意力。
# 模型输出原始 logits；未训练参数不能用于实际文本理解。
