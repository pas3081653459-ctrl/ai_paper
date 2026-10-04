"""可选 CLIP 推理；按需子进程，取消/断连/超时清理，不常驻大模型。"""
import asyncio
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from .ddpm_config import ROOT, PROJECT

router = APIRouter(prefix='/api/experiments/clip', tags=['CLIP experiment'])
lock = asyncio.Lock()
processes = set()


async def shutdown():
    for process in list(processes):
        if process.returncode is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), 3)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()


def configuration():
    path = Path(os.environ.get('CHANNEL_LAB_CLIP_MODEL', str(ROOT/'models'/'clip-vit-base-patch32'))).expanduser().resolve()
    device = os.environ.get('CHANNEL_LAB_CLIP_DEVICE', 'cpu')
    problems, versions = [], {}
    for name in ('transformers','huggingface-hub','safetensors'):
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            problems.append(f'缺少依赖 {name}')
    for name in ('config.json','preprocessor_config.json','vocab.json','merges.txt','tokenizer_config.json'):
        if not (path/name).is_file():
            problems.append(f'缺少 {name}')
    if not any((path/name).is_file() for name in ('model.safetensors','pytorch_model.bin')):
        problems.append('缺少 model.safetensors 或 pytorch_model.bin')
    if device not in ('cpu','mps','cuda'):
        problems.append('设备必须为 cpu / mps / cuda')
    return {'configured':not problems,'problems':problems,'model_dir':str(path),
            'device':device,'dependencies':versions,'offline_only':True,
            'note':'仅检查依赖和文件存在，内容兼容性在加载时验证。'}


class ClipRequest(BaseModel):
    image_base64: str = Field(min_length=1, max_length=2_800_000)
    texts: list[str] = Field(min_length=2, max_length=8)

    @field_validator('texts')
    @classmethod
    def validate_texts(cls, texts):
        cleaned = [t.strip() for t in texts]
        if any(not t or len(t)>300 for t in cleaned):
            raise ValueError('每条描述需要 1–300 字符')
        if len(set(cleaned)) != len(cleaned):
            raise ValueError('候选描述不能重复')
        return cleaned


@router.get('/config')
def config():
    return configuration()


@router.post('/compare')
async def compare(payload: ClipRequest, request: Request):
    return await run_worker(payload.model_dump(), request, configuration(), 'channel_lab.backend.clip_worker')


async def run_worker(payload, request, config, module, timeout_seconds=180):
    if lock.locked():
        raise HTTPException(409, '已有本地模型请求，请等待完成或取消')
    if not config['configured']:
        raise HTTPException(503, '；'.join(config['problems']))
    async with lock:
        process = None
        task = None
        try:
            process = await asyncio.create_subprocess_exec(sys.executable, '-m', module,
                cwd=str(PROJECT), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                env=dict(os.environ, HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1'))
            processes.add(process)
            data = dict(payload)
            data.update(model_dir=config['model_dir'],device=config['device'],parent_pid=os.getpid())
            task = asyncio.create_task(process.communicate(json.dumps(data).encode()))
            started = time.monotonic()
            while not task.done():
                if await request.is_disconnected():
                    raise HTTPException(499, '客户端已取消')
                if time.monotonic()-started > timeout_seconds:
                    raise HTTPException(504, f'超过 {timeout_seconds} 秒，已停止子进程')
                await asyncio.wait({task}, timeout=.25)
            output, _ = await task
            try:
                result = json.loads(output)
            except ValueError:
                raise HTTPException(500, '模型 worker 未返回有效 JSON；请检查本地依赖兼容性')
            if process.returncode or 'error' in result:
                raise HTTPException(422, result.get('error','模型 worker 失败'))
            result['elapsed_seconds'] = round(time.monotonic()-started,2)
            result['created_at'] = time.time()
            return result
        finally:
            if process and process.returncode is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
                try:
                    await asyncio.wait_for(process.wait(), 3)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            if process:
                processes.discard(process)
