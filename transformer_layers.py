"""BERT / GPT 共用的基础层：手写多头注意力与前馈网络。

只依赖 torch，不使用 nn.Transformer、nn.MultiheadAttention 或 transformers。
维度约定：B=批大小，T=序列长度，C=隐藏维度，H=注意力头数，D=C/H。
"""

import math

import torch
from torch import nn


class SelfAttention(nn.Module):
    def __init__(self, hidden_size=128, num_heads=4, dropout=0.1, causal=False):
        super().__init__()
        if hidden_size <= 0 or num_heads <= 0 or hidden_size % num_heads:
            raise ValueError("hidden_size 必须为正数且能被 num_heads 整除")
        self.num_heads = num_heads
        self.head_dim = hidden_size // num_heads
        self.causal = causal
        # 每个 token 分别产生 Query、Key、Value；线性层不混合序列位置。
        self.query = nn.Linear(hidden_size, hidden_size)#linear函数，全连接线形变换 128输入，128输出
        self.key = nn.Linear(hidden_size, hidden_size)
        self.value = nn.Linear(hidden_size, hidden_size)
        self.output = nn.Linear(hidden_size, hidden_size)
        self.attention_dropout = nn.Dropout(dropout)

    def forward(self, x, attention_mask=None):
        """x: [B,T,C]；attention_mask: [B,T]，1/True=有效，0/False=padding。"""
        batch, length, channels = x.shape

        def split_heads(tensor):
            # [B,T,C] -> [B,T,H,D] -> [B,H,T,D]
            return tensor.reshape(batch, length, self.num_heads, self.head_dim).transpose(1, 2)

        q = split_heads(self.query(x))
        k = split_heads(self.key(x))
        v = split_heads(self.value(x))
        # 每个 query 位置与每个 key 位置计算相似度：[B,H,T,T]。
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)

        # allowed 的最后两维分别代表 query 位置和 key 位置。
        allowed = torch.ones((1, 1, length, length), dtype=torch.bool, device=x.device)
        if self.causal:
            # GPT 的因果遮罩：仅保留下三角（含对角线），不能读取未来词元。
            allowed = allowed.tril()
        if attention_mask is not None:
            if attention_mask.shape != (batch, length):
                raise ValueError("attention_mask 形状必须为 [B,T]")
            valid_keys = attention_mask.to(device=x.device, dtype=torch.bool)
            allowed = allowed & valid_keys[:, None, None, :]

        scores = scores.masked_fill(~allowed, torch.finfo(scores.dtype).min)
        weights = torch.softmax(scores, dim=-1)
        # 将禁用位置严格清零；整行均被遮住时返回零，避免 softmax(-inf) 的 NaN。
        weights = weights.masked_fill(~allowed, 0.0)
        weights = weights / weights.sum(dim=-1, keepdim=True).clamp_min(torch.finfo(weights.dtype).tiny)
        context = self.attention_dropout(weights) @ v  # [B,H,T,D]
        context = context.transpose(1, 2).contiguous().reshape(batch, length, channels)
        return self.output(context)  # [B,T,C]，拼接各头后再做线性投影


class FeedForward(nn.Module):
    """对每个 token 独立执行同一个 MLP：[B,T,C] -> [B,T,4C] -> [B,T,C]。"""

    def __init__(self, hidden_size=128):
        super().__init__()
        self.expand = nn.Linear(hidden_size, hidden_size * 4)
        self.activation = nn.GELU()
        self.project = nn.Linear(hidden_size * 4, hidden_size)

    def forward(self, x):
        return self.project(self.activation(self.expand(x)))


def position_ids_for(input_ids, max_length):
    """为右侧 padding 的输入建立绝对位置编号；本例不提供 tokenizer。"""
    if input_ids.ndim != 2:
        raise ValueError("input_ids 形状必须为 [B,T]")
    length = input_ids.shape[1]
    if not 1 <= length <= max_length:
        raise ValueError(f"序列长度必须在 1 到 {max_length} 之间")
    return torch.arange(length, device=input_ids.device).unsqueeze(0)  # [1,T]
