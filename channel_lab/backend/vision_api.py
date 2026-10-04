"""Local-only ViT/SAM/LLaVA lesson APIs. Importing these routes loads no weights."""
import importlib.metadata
import json
import os
from pathlib import Path
import re
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from .clip_api import run_worker, lock
from .ddpm_config import ROOT, runs_dir

router = APIRouter(prefix='/api/experiments/vision', tags=['Image intervention lessons'])
KINDS = {'10': 'VIT', '20': 'SAM', '19': 'LLAVA'}


def weight_files(root):
    """Only local safetensors, including explicitly enumerated shards."""
    if (root/'model.safetensors').is_file():
        return [root/'model.safetensors']
    index = root/'model.safetensors.index.json'
    if not index.is_file():
        raise ValueError('缺少 model.safetensors 或分片索引')
    if index.stat().st_size > 4_000_000:
        raise ValueError('权重索引过大')
    names = set(json.loads(index.read_text())['weight_map'].values())
    if not names or len(names)>100:
        raise ValueError('权重分片数量无效')
    files = []
    for name in sorted(names):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+\.safetensors', name):
            raise ValueError('分片必须是当前目录下的 safetensors 文件')
        path = (root/name).resolve()
        if path.parent != root or not path.is_file():
            raise ValueError(f'缺少或越界的分片 {name}')
        files.append(path)
    return files


def configuration(paper):
    kind = KINDS[paper]
    root = Path(os.environ.get(f'CHANNEL_LAB_{kind}_MODEL', str(ROOT/'models'/kind.lower()))).expanduser().resolve()
    problems = []
    for package in ('transformers', 'safetensors'):
        try:
            version = importlib.metadata.version(package)
            if package == 'transformers' and version != '4.55.4':
                problems.append('本适配器按 transformers==4.55.4 编写，请使用匹配环境')
        except importlib.metadata.PackageNotFoundError:
            problems.append(f'缺少 {package}')
    names = ['config.json', 'preprocessor_config.json']
    if paper == '19':
        names += ['processor_config.json', 'tokenizer_config.json', 'tokenizer.json']
    for name in names:
        if not (root/name).is_file():
            problems.append(f'缺少 {name}')
    try:
        weight_files(root)
        cfg = json.loads((root/'config.json').read_text())
        if not isinstance(cfg, dict):
            raise ValueError('config.json需要JSON对象')
        if cfg.get('model_type') != kind.lower():
            problems.append(f'需要 model_type={kind.lower()}，不支持自动换架构')
        if paper == '19' and cfg.get('text_config', {}).get('model_type') != 'llama':
            problems.append('首版仅支持 LLaVA + Llama 文本主干')
        if paper == '19':
            proc = json.loads((root/'processor_config.json').read_text())
            if proc.get('patch_size') != cfg.get('vision_config', {}).get('patch_size'):
                problems.append('processor的patch_size与视觉模型配置不匹配')
            if proc.get('vision_feature_select_strategy') != cfg.get('vision_feature_select_strategy','default'):
                problems.append('processor的视觉特征选择策略与模型不匹配')
            if not any((root/name).is_file() for name in ('chat_template.json','chat_template.jinja')) and not proc.get('chat_template'):
                problems.append('缺少该checkpoint的processor聊天模板')
        if paper == '10' and cfg.get('image_size') != 224:
            problems.append('切块课首版仅支持 image_size=224 的 ViT checkpoint')
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        problems.append(str(exc))
    device = os.environ.get('CHANNEL_LAB_VISION_DEVICE', 'cpu')
    dtype = os.environ.get('CHANNEL_LAB_VISION_DTYPE', 'float32')
    if device not in ('cpu', 'mps', 'cuda'):
        problems.append('设备需要 cpu/mps/cuda')
    if dtype not in ('float32', 'float16') or (dtype == 'float16' and device == 'cpu'):
        problems.append('float16 仅允许 mps/cuda；CPU 使用 float32')
    try:
        timeout = int(os.environ.get('CHANNEL_LAB_VISION_TIMEOUT', '600'))
        if not 60 <= timeout <= 1800:
            raise ValueError()
    except ValueError:
        timeout = 600
        problems.append('超时设置需要 60–1800 秒整数')
    return {'configured': not problems, 'problems': problems, 'model_dir': str(root),
            'device': device, 'dtype': dtype, 'timeout_seconds': timeout,
            'note': '仅检查文件与配置，不代表已通过加载或硬件兼容验证；不下载权重。'}


class Point(BaseModel):
    x: float = Field(ge=0, le=768, allow_inf_nan=False)
    y: float = Field(ge=0, le=768, allow_inf_nan=False)
    label: Literal['positive', 'negative']


class VisionRequest(BaseModel):
    paper_id: Literal['10', '19', '20']
    image_base64: str = Field(min_length=1, max_length=3_200_000)
    changed_base64: str | None = Field(default=None, max_length=3_200_000)
    points: list[Point] = Field(default_factory=list, max_length=32)
    box: list[float] | None = Field(default=None, min_length=4, max_length=4)
    question: str = Field(default='What can you see in this image?', min_length=1, max_length=1000)
    max_new_tokens: int = Field(default=64, ge=1, le=128, strict=True)
    include_no_image: bool = True

    @model_validator(mode='after')
    def validate_task(self):
        import math
        if self.paper_id in ('10', '19') and not self.changed_base64:
            raise ValueError('原图/干预图对照需要两张图')
        if self.paper_id == '20' and not self.points and self.box is None:
            raise ValueError('SAM 需要至少一个提示点或一个框')
        if self.box is not None and (any(not math.isfinite(x) for x in self.box) or
                not (0 <= self.box[0] < self.box[2] <= 768 and 0 <= self.box[1] < self.box[3] <= 768)):
            raise ValueError('框需要 [x1,y1,x2,y2]，且左上小于右下')
        if not self.question.strip() or '<image>' in self.question:
            raise ValueError('问题不能为空或包含保留的 <image> 标记')
        return self


@router.get('/config/{paper_id}')
def config(paper_id: Literal['10', '19', '20']):
    return configuration(paper_id)


@router.post('/run')
async def run(payload: VisionRequest, request: Request):
    config = configuration(payload.paper_id)
    data = payload.model_dump()
    data['dtype'] = config['dtype']
    return await run_worker(data, request, config, 'channel_lab.backend.vision_worker',
                            timeout_seconds=config['timeout_seconds'])


@router.delete('/sam-cache')
async def clear_cache():
    if lock.locked():
        raise HTTPException(409, '模型正在运行，结束或取消后再清理缓存')
    async with lock:
        # Match the process-level lock used by every local model worker as well.
        import fcntl
        root = runs_dir()
        root.mkdir(parents=True, exist_ok=True)
        with (root/'.ddpm-worker.lock').open('a') as guard:
            try:
                fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise HTTPException(409, '另一个本地模型进程正在运行，暂不能清理缓存')
            return clear_cache_files()


def clear_cache_files():
    directory = runs_dir()/'.sam-image-cache'
    removed = 0
    if directory.is_dir():
        for path in directory.iterdir():
            if re.fullmatch(r'[a-f0-9]{64}\.(safetensors|tmp)', path.name) and not path.is_symlink():
                path.unlink(missing_ok=True)
                removed += 1
    return {'removed': removed}
