"""官方 trainval 中按物种分层划分验证集，官方 test 只用于最终评估。"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageOps
import torch

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
ARTIFACTS = ROOT / 'artifacts'


def preprocess(image):
    image = ImageOps.exif_transpose(image).convert('RGB')
    # 两个模型、训练和推理使用完全相同的直接缩放。
    return image.resize((64, 64), Image.Resampling.BILINEAR)


def read_records(split):
    records = []
    for line in (DATA / 'annotations' / f'{split}.txt').read_text().splitlines():
        name, breed, species, breed_id = line.split()
        records.append((name, int(species) - 1))
    return records


def split_records(seed=42):
    records = read_records('trainval')
    rng = np.random.default_rng(seed)
    train, val = [], []
    for label in (0, 1):
        group = [r for r in records if r[1] == label]
        rng.shuffle(group)
        count = max(1, round(len(group) * 0.2))
        val.extend(group[:count])
        train.extend(group[count:])
    rng.shuffle(train)
    rng.shuffle(val)
    return train, val, read_records('test')


def load_tensors(records):
    images, labels = [], []
    for name, label in records:
        with Image.open(DATA / 'images' / f'{name}.jpg') as image:
            images.append(np.array(preprocess(image)))
        labels.append(label)
    return torch.from_numpy(np.stack(images)).permute(0, 3, 1, 2).contiguous(), torch.tensor(labels)


def split_hash(splits):
    return hashlib.sha256(json.dumps(splits, sort_keys=True).encode()).hexdigest()
