"""BERT / GPT-2 学习实验，只调用本地文件；可选依赖由 worker 按需导入。"""
import importlib.metadata
import os
import json
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from .ddpm_config import ROOT
from .clip_api import run_worker

router = APIRouter(prefix='/api/experiments/language', tags=['Language experiments'])


def configuration(paper):
    kind = 'BERT' if paper=='06' else 'GPT2'
    path = Path(os.environ.get(f'CHANNEL_LAB_{kind}_MODEL', str(ROOT/'models'/kind.lower()))).expanduser().resolve()
    problems = []
    for package in ('transformers','safetensors'):
        try:
            version = importlib.metadata.version(package)
            if package == 'transformers' and version != '4.55.4':
                problems.append('本适配器要求 transformers==4.55.4；尚未进行本机兼容性验证')
        except importlib.metadata.PackageNotFoundError:
            problems.append(f'缺少 {package}')
    files = ['config.json','model.safetensors','tokenizer_config.json'] + (['vocab.txt'] if kind=='BERT' else ['vocab.json','merges.txt'])
    for name in files:
        if not (path/name).is_file():
            problems.append(f'缺少 {name}')
    try:
        cfg = json.loads((path/'config.json').read_text())
        if cfg.get('model_type') != ('bert' if paper == '06' else 'gpt2'):
            problems.append('config.json 架构不匹配；这里只支持 BERT 或 GPT-2 原始架构')
        if paper == '06' and cfg.get('is_decoder', False):
            problems.append('BERT 必须使用非因果编码器配置')
    except (OSError, ValueError, AttributeError):
        problems.append('config.json 不可读或不是有效对象')
    device = os.environ.get('CHANNEL_LAB_LANGUAGE_DEVICE','cpu')
    if device not in ('cpu','mps','cuda'):
        problems.append('设备必须为 cpu/mps/cuda')
    return {'configured':not problems,'problems':problems,'model_dir':str(path),'device':device,'timeout_seconds':180,
            'note':'存在检查不代表加载兼容；只支持本地 safetensors，首版使用原始 BERT/GPT-2 类。'}


class LanguageRequest(BaseModel):
    paper_id: Literal['06','07']
    texts: list[str] = Field(min_length=1,max_length=3)
    max_new_tokens: int = Field(default=48,ge=1,le=128,strict=True)

    @field_validator('texts')
    @classmethod
    def check(cls, texts):
        if any(not s.strip() or len(s)>2000 for s in texts):
            raise ValueError('每条输入需要 1–2000 字符')
        return texts


@router.get('/config/{paper_id}')
def config(paper_id: Literal['06','07','08']):
    return configuration(paper_id)


@router.post('/run')
async def run(payload: LanguageRequest, request: Request):
    return await run_worker(payload.model_dump(),request,configuration(payload.paper_id),'channel_lab.backend.language_worker')


class ContextCondition(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    example_ids: list[Literal['e1','e2','e3','e4']] = Field(max_length=4)
    renamed: bool = False
    corrupt_id: Literal['e1','e2','e3','e4'] | None = None

    @model_validator(mode='after')
    def unique_examples(self):
        if len(set(self.example_ids)) != len(self.example_ids):
            raise ValueError('示例不能重复')
        if self.corrupt_id and self.corrupt_id not in self.example_ids:
            raise ValueError('错误标签必须属于当前示例')
        return self


class ContextRequest(BaseModel):
    conditions: list[ContextCondition] = Field(min_length=2,max_length=2)


@router.post('/context')
async def context(payload: ContextRequest, request: Request):
    # The caller supplies interventions, never test targets or arbitrary prompts.
    data = payload.model_dump()
    data.update(paper_id='08', max_new_tokens=12)
    return await run_worker(data,request,configuration('08'),'channel_lab.backend.language_worker')
