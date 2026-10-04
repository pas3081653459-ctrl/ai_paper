"""对照实验：主分支完全一致，仅 ResNet 增加捷径。特征来自实际前向计算。"""
from collections import OrderedDict
import torch
from torch import nn


class Block(nn.Module):
    def __init__(self, cin, cout, stride, residual):
        super().__init__()
        self.conv1 = nn.Conv2d(cin, cout, 3, stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(cout)
        self.conv2 = nn.Conv2d(cout, cout, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(cout)
        self.residual = residual
        if residual:
            self.shortcut = nn.Identity() if cin == cout and stride == 1 else nn.Sequential(
                nn.Conv2d(cin, cout, 1, stride=stride, bias=False), nn.BatchNorm2d(cout))

    def forward(self, x, capture=None, prefix=''):
        def record(key, tensor):
            if capture is not None:
                capture[prefix + key] = tensor.detach()
            return tensor
        x0 = record('input', x)
        x = record('conv1', self.conv1(x))
        x = record('bn1', self.bn1(x))
        x = record('relu1', torch.relu(x))
        x = record('conv2', self.conv2(x))
        x = record('main', self.bn2(x))
        if self.residual:
            if isinstance(self.shortcut, nn.Sequential):
                projected = record('shortcut_conv', self.shortcut[0](x0))
                shortcut = record('shortcut', self.shortcut[1](projected))
            else:
                shortcut = record('shortcut', self.shortcut(x0))
            x = record('sum', x + shortcut)
        return record('output', torch.relu(x))


class TinyClassifier(nn.Module):
    def __init__(self, residual=False):
        super().__init__()
        self.stem = nn.Conv2d(3, 8, 3, padding=1, bias=False)
        self.stem_bn = nn.BatchNorm2d(8)
        self.blocks = nn.ModuleList([Block(8, 8, 1, residual), Block(8, 16, 2, residual), Block(16, 32, 2, residual)])
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(32, 2)

    def forward(self, x, trace=False):
        features = OrderedDict() if trace else None
        if trace:
            features['input'] = x.detach()
        x = self.stem(x)
        if trace:
            features['stem.conv'] = x.detach()
        x = self.stem_bn(x)
        if trace:
            features['stem.bn'] = x.detach()
        x = torch.relu(x)
        if trace:
            features['stem.output'] = x.detach()
        for i, block in enumerate(self.blocks, 1):
            x = block(x, features, f'block{i}.')
        x = self.pool(x)
        if trace:
            features['pool'] = x.detach()
        logits = self.fc(x.flatten(1))
        return (logits, features) if trace else logits


def paired_models(seed=42):
    torch.manual_seed(seed)
    cnn = TinyClassifier(False)
    torch.manual_seed(seed)
    resnet = TinyClassifier(True)
    # 后续模块初始化受额外捷径影响，显式复制所有同名主分支参数。
    resnet.load_state_dict(cnn.state_dict(), strict=False)
    return {'cnn': cnn, 'resnet': resnet}


def node_specs(model, features):
    """将可见节点对应到实际 nn.Module，展示真实参数量、卷积核和步长。"""
    mapping = {
        'input': ('input', 'RGB input', None),
        'stem.conv': ('input', 'Conv2d', model.stem),
        'stem.bn': ('stem.conv', 'BatchNorm2d', model.stem_bn),
        'stem.output': ('stem.bn', 'ReLU', None),
        'pool': ('block3.output', 'Global AvgPool', model.pool),
    }
    for i, block in enumerate(model.blocks, 1):
        p = f'block{i}.'
        mapping[p+'input'] = ('stem.output' if i == 1 else f'block{i-1}.output', 'Block input', None)
        for name, previous, operation, module in [
            ('conv1','input','Conv2d',block.conv1), ('bn1','conv1','BatchNorm2d',block.bn1),
            ('relu1','bn1','ReLU',None), ('conv2','relu1','Conv2d',block.conv2),
            ('main','conv2','BatchNorm2d',block.bn2),
            ('output','sum' if block.residual else 'main','ReLU',None),
        ]:
            mapping[p+name] = (p+previous, operation, module)
        if block.residual:
            if isinstance(block.shortcut, nn.Sequential):
                mapping[p+'shortcut_conv'] = (p+'input', 'Conv2d projection', block.shortcut[0])
                mapping[p+'shortcut'] = (p+'shortcut_conv', 'BatchNorm2d shortcut', block.shortcut[1])
            else:
                mapping[p+'shortcut'] = (p+'input', 'Identity', block.shortcut)
            mapping[p+'sum'] = (p+'main', 'Add (main + shortcut)', None)
    return {key: {'input_shape': list(features[previous].shape), 'operation': operation,
                  'parameters': sum(p.numel() for p in module.parameters()) if module is not None else 0,
                  'kernel': list(module.kernel_size) if isinstance(module, nn.Conv2d) else None,
                  'stride': list(module.stride) if isinstance(module, nn.Conv2d) else None}
            for key, (previous, operation, module) in mapping.items()}
