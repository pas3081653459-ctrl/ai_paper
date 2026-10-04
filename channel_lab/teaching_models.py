"""论文实验室的原生 PyTorch 学习代码：只定义模块，不下载、不训练、不自动推理。

阅读顺序：ResidualBlock → Attention → TinyViT → RMSNorm/RoPE → LlamaBlock → SparseMoE。
这些是独立的小型结构示例，不是论文完整复现或预训练模型。
浏览器使用固定 TypeScript 权重；本文件使用 PyTorch 的普通初始化，数值不要求相同。
无 padding mask / KV cache / 混合精度 / 分布式训练；为易读省略 dropout。
"""
import math

import torch
from torch import nn
from torch.nn import functional as F


class ResidualBlock(nn.Module):
    """原版基本块：主分支与捷径形状对齐，逐元素相加，再 ReLU。"""
    def __init__(self, in_channels=4, out_channels=4, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, 3, stride, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, 1, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, 1, stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x):
        # x: [B,Cin,H,W]。stride=2 时，两路都降低空间尺寸。
        branch = self.bn2(self.conv2(F.relu(self.bn1(self.conv1(x)))))
        skip = self.shortcut(x)
        return F.relu(branch + skip)  # [B,Cout,ceil(H/stride),ceil(W/stride)]


class Attention(nn.Module):
    """显式拆开 Q/K/V、多头、掩码、Softmax 和 Value 加权。"""
    def __init__(self, dim=16, heads=2):
        super().__init__()
        if dim % heads:
            raise ValueError('dim 必须能被 heads 整除')
        self.heads, self.head_dim = heads, dim // heads
        self.q = nn.Linear(dim, dim, bias=False)
        self.k = nn.Linear(dim, dim, bias=False)
        self.v = nn.Linear(dim, dim, bias=False)
        self.out = nn.Linear(dim, dim, bias=False)

    def split(self, x):
        b, t, _ = x.shape
        return x.reshape(b, t, self.heads, self.head_dim).transpose(1, 2)

    def forward(self, x, context=None, causal=False, rotary=False):
        # 自注意力 context=x；交叉注意力 x 来自 Decoder、context 来自 Encoder。
        # x: [B,Tq,D]，context: [B,Tk,D]，要求两者特征维相同。
        context = x if context is None else context
        q, k, v = self.split(self.q(x)), self.split(self.k(context)), self.split(self.v(context))
        if rotary:
            # 本例无 KV cache，每个序列位置从 0 开始；不是网页中隔离单个旋转角的实验。
            q, k = rope(q), rope(k)
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.head_dim)  # [B,H,Tq,Tk]
        if causal:
            if x.shape[1] != context.shape[1]:
                raise ValueError('此简化因果模式仅用于等长自注意力')
            future = torch.ones(x.shape[1], context.shape[1], device=x.device, dtype=torch.bool).triu(1)
            scores = scores.masked_fill(future, float('-inf'))
        weights = scores.softmax(dim=-1)
        merged = (weights @ v).transpose(1, 2).contiguous().reshape(x.shape)
        return self.out(merged), weights  # [B,Tq,D]，以及可供观察的 [B,H,Tq,Tk]


class EncoderBlock(nn.Module):
    """ViT 风格 Pre-LN，不等同于原 Transformer 的 Post-LN。"""
    def __init__(self, dim=16, heads=2):
        super().__init__()
        self.norm1, self.norm2 = nn.LayerNorm(dim), nn.LayerNorm(dim)
        self.attention = Attention(dim, heads)
        self.up, self.down = nn.Linear(dim, dim * 2), nn.Linear(dim * 2, dim)

    def forward(self, x):
        attention, weights = self.attention(self.norm1(x))
        x = x + attention
        x = x + self.down(F.gelu(self.up(self.norm2(x))))
        return x, weights


class TinyViT(nn.Module):
    """默认 [B,3,12,12] → 16 个 patch → [B,17,16] → [B,3]。"""
    def __init__(self, image_size=12, patch_size=3, channels=3, dim=16, heads=2, num_classes=3):
        super().__init__()
        if image_size % patch_size:
            raise ValueError('图像尺寸必须能被 patch 边长整除')
        self.image_size, self.patch_size = image_size, patch_size
        n = (image_size // patch_size) ** 2
        self.project = nn.Linear(channels * patch_size ** 2, dim)
        self.cls = nn.Parameter(torch.zeros(1, 1, dim))
        self.position = nn.Parameter(torch.empty(1, n + 1, dim))
        nn.init.normal_(self.position, std=.02)
        self.block = EncoderBlock(dim, heads)
        self.norm, self.head = nn.LayerNorm(dim), nn.Linear(dim, num_classes)

    def forward(self, image):
        b, c, h, w = image.shape
        if (h, w) != (self.image_size, self.image_size):
            raise ValueError('本例固定图像尺寸，未实现位置嵌入插值')
        p = self.patch_size
        # 不使用高层 patch 封装：先拆空间维，再把每个 patch 的像素放到同一行。
        patches = image.reshape(b, c, h // p, p, w // p, p)
        patches = patches.permute(0, 2, 4, 1, 3, 5).reshape(b, (h // p) * (w // p), c * p * p)
        tokens = self.project(patches)  # [B,N,D]
        x = torch.cat([self.cls.expand(b, -1, -1), tokens], dim=1) + self.position
        x, attention = self.block(x)
        logits = self.head(self.norm(x)[:, 0])  # 只读取 CLS；交叉熵接 logits。
        return logits, {'patches': patches, 'tokens': tokens, 'attention': attention, 'hidden': x}


class RMSNorm(nn.Module):
    def __init__(self, dim=16, eps=1e-5):
        super().__init__()
        self.scale = nn.Parameter(torch.ones(dim))
        self.eps = eps

    def forward(self, x):
        # 保留均值信息；与 (x-mean)/std 不同。
        return x * torch.rsqrt(x.square().mean(dim=-1, keepdim=True) + self.eps) * self.scale


def rope(x):
    """相邻维配对的 RoPE：[B,H,T,Dh] → 同形状。Dh 必须为偶数。"""
    dim = x.shape[-1]
    if dim % 2:
        raise ValueError('RoPE 的每头维度必须为偶数')
    freq = 10000.0 ** (-torch.arange(0, dim, 2, device=x.device, dtype=x.dtype) / dim)
    position = torch.arange(x.shape[-2], device=x.device, dtype=x.dtype)
    angle = position[:, None] * freq[None, :]  # [T,Dh/2]
    a, b = x[..., 0::2], x[..., 1::2]
    first = a * angle.cos() - b * angle.sin()
    second = a * angle.sin() + b * angle.cos()
    return torch.stack([first, second], dim=-1).flatten(-2)


class SwiGLU(nn.Module):
    def __init__(self, dim=16, hidden=32):
        super().__init__()
        self.gate = nn.Linear(dim, hidden, bias=False)
        self.up = nn.Linear(dim, hidden, bias=False)
        self.down = nn.Linear(hidden, dim, bias=False)

    def forward(self, x):
        return self.down(F.silu(self.gate(x)) * self.up(x))


class LlamaBlock(nn.Module):
    """拆解 RMSNorm、RoPE、自注意力、SwiGLU；不实现完整 LLaMA。"""
    def __init__(self, dim=16, heads=2, hidden=32):
        super().__init__()
        self.norm1, self.norm2 = RMSNorm(dim), RMSNorm(dim)
        self.attention, self.ffn = Attention(dim, heads), SwiGLU(dim, hidden)

    def forward(self, x):
        attention, weights = self.attention(self.norm1(x), causal=True, rotary=True)
        x = x + attention
        x = x + self.ffn(self.norm2(x))
        return x, weights


class SparseMoE(nn.Module):
    """Mixtral 的 8 选 2 路由机制；只实现 FFN 替换块，不是完整 Mixtral。"""
    def __init__(self, dim=16, hidden=32, experts=8, top_k=2):
        super().__init__()
        if not 1 <= top_k <= experts:
            raise ValueError('top_k 必须在 1 与专家数之间')
        self.router = nn.Linear(dim, experts, bias=False)
        self.experts = nn.ModuleList([SwiGLU(dim, hidden) for _ in range(experts)])
        self.top_k = top_k

    def forward(self, x):
        flat = x.reshape(-1, x.shape[-1])  # [B*T,D]
        logits = self.router(flat)  # [B*T,8]
        scores, indices = logits.topk(self.top_k, dim=-1)
        gates = scores.softmax(dim=-1)  # [B*T,2]，仅对入选专家归一化
        result = torch.zeros_like(flat)
        for expert_id, expert in enumerate(self.experts):
            # 每个 token 可能出现在不同路由槽位；只计算分配给本专家的 token。
            token_index, slot = torch.where(indices == expert_id)
            if token_index.numel() == 0:
                continue
            selected = flat[token_index]
            contribution = expert(selected) * gates[token_index, slot, None]
            result = result.index_add(0, token_index, contribution)
        return result.reshape_as(x), indices.reshape(*x.shape[:-1], self.top_k), gates.reshape(*x.shape[:-1], self.top_k)


class VisualConnector(nn.Module):
    """原版 LLaVA 的线性维度对齐核心；不含视觉编码器或 LLM。"""
    def __init__(self, vision_dim=12, language_dim=16):
        super().__init__()
        self.project = nn.Linear(vision_dim, language_dim, bias=False)

    def forward(self, image_features, text_embeddings):
        # [B,N,12] → [B,N,16]；与 [B,T,16] 在序列维拼接。
        projected = self.project(image_features)
        return torch.cat([projected, text_embeddings], dim=1)  # [B,N+T,16]


def clip_pair_loss(image_features, text_features, temperature=.2):
    """两端已投影到同一维度；不提供图像/文本编码器。"""
    i = F.normalize(image_features, dim=-1)
    t = F.normalize(text_features, dim=-1)
    scores = i @ t.T / temperature  # [N,N]
    targets = torch.arange(scores.shape[0], device=scores.device)
    return (F.cross_entropy(scores, targets) + F.cross_entropy(scores.T, targets)) / 2


def ddpm_forward_noise(x0, epsilon, alpha_bar):
    """alpha_bar 为标量 Tensor（同设备），只展示闭式正向加噪，不是生成器。"""
    return alpha_bar.sqrt() * x0 + (1 - alpha_bar).sqrt() * epsilon
