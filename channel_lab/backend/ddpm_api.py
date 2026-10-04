"""离线模型实验 API：一个任务一个子进程，记录保存在本地，不自动安装或下载。"""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import time
from typing import Literal
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .ddpm_config import configuration, model_dir, runs_dir, PROJECT
from .ddpm_worker import write_json

router = APIRouter(prefix='/api/experiments/ddpm', tags=['DDPM teaching experiment'])
TERMINAL = {'completed', 'failed', 'cancelled', 'interrupted'}
FILE_PATTERN = re.compile(r'(?:initial|final)\.png|frame-\d{4}(?:\.json|-(?:sample|epsilon|predicted_x0|mean|added_noise|next_sample)\.png)')


class GenerateRequest(BaseModel):
    seed: int = Field(default=42, ge=0, le=2**31-1, strict=True)
    steps: Literal[100, 250, 1000] = 1000
    save_every: int = Field(default=20, ge=10, le=100, strict=True)


def directory(job_id):
    if not re.fullmatch(r'[0-9a-f]{32}', job_id):
        raise HTTPException(404, '记录不存在')
    root = runs_dir()
    path = (root / job_id).resolve()
    if path.parent != root or not path.is_dir():
        raise HTTPException(404, '记录不存在')
    return path


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default
    except (OSError, ValueError):
        raise HTTPException(500, '本地实验记录无法读取')


class Jobs:
    def __init__(self):
        self.lock = threading.RLock()
        self.active = None
        self.process = None
        self.closing = False

    def finish(self, process, path, job_id):
        code = process.wait()
        with self.lock:
            try:
                status = read_json(path / 'status.json', {})
                if status.get('state') not in TERMINAL:
                    state = 'cancelled' if (path / 'cancel').exists() else 'failed'
                    status.update(state=state, message='已取消；保留已保存帧' if state == 'cancelled' else f'worker 意外退出（{code}），请检查依赖和本地记录目录中的 worker.log')
                    write_json(path / 'status.json', status)
            finally:
                if self.active == job_id:
                    self.active = None
                    self.process = None

    def start(self, request):
        with self.lock:
            if self.closing:
                raise HTTPException(503, '服务正在关闭')
            if self.active:
                raise HTTPException(409, '已有生成任务运行中，请先取消或等待完成')
            config = configuration()
            if not config['configured']:
                raise HTTPException(503, '；'.join(config['problems']))
            root = runs_dir()
            root.mkdir(parents=True, exist_ok=True)
            if len([p for p in root.iterdir() if p.is_dir() and re.fullmatch(r'[0-9a-f]{32}', p.name)]) >= 20:
                raise HTTPException(409, '已保留 20 个实验，请先在记录列表删除不需要的任务')
            job_id = uuid.uuid4().hex
            path = root / job_id
            path.mkdir()
            payload = request.model_dump()
            payload.update(job_id=job_id, created_at=time.time())
            write_json(path / 'request.json', payload)
            write_json(path / 'status.json', {'state': 'queued', 'completed_steps': 0,
                       'total_steps': request.steps, 'saved_frames': 0, 'elapsed_seconds': 0,
                       'message': '准备加载本地模型'})
            environment = dict(os.environ, HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
                               HF_HUB_DISABLE_TELEMETRY='1', TOKENIZERS_PARALLELISM='false')
            try:
                with (path / 'worker.log').open('wb') as log:
                    process = subprocess.Popen([sys.executable, '-m', 'channel_lab.backend.ddpm_worker',
                        '--run', str(path), '--model', str(model_dir()), '--device', config['device'],
                        '--parent-pid', str(os.getpid())], cwd=str(PROJECT), env=environment,
                        stdout=log, stderr=subprocess.STDOUT)
            except OSError:
                write_json(path / 'status.json', {'state': 'failed', 'message': '无法启动模型子进程'})
                raise HTTPException(500, '无法启动模型子进程')
            self.active, self.process = job_id, process
            threading.Thread(target=self.finish, args=(process, path, job_id), daemon=True).start()
            return job_id

    def cancel(self, job_id):
        with self.lock:
            path = directory(job_id)
            status = read_json(path / 'status.json', {})
            if status.get('state') in TERMINAL:
                return
            (path / 'cancel').touch()
            if self.active == job_id and self.process and self.process.poll() is None:
                self.process.terminate()
            # 旧服务异常退出遗留的 worker 会检查 cancel / parent PID；不对任意 PID 发信号。

    def shutdown(self):
        with self.lock:
            self.closing = True
            process, job_id = self.process, self.active
            if process and job_id and process.poll() is None:
                (directory(job_id) / 'cancel').touch()
                process.terminate()
        if process:
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)


jobs = Jobs()


@router.get('/config')
def config():
    return configuration()


@router.post('/jobs', status_code=202)
def generate(request: GenerateRequest):
    return {'job_id': jobs.start(request)}


@router.get('/jobs')
def list_jobs():
    root = runs_dir()
    if not root.exists():
        return []
    result = []
    for path in root.iterdir():
        if not re.fullmatch(r'[0-9a-f]{32}', path.name) or path.is_symlink() or not path.is_dir():
            continue
        request = read_json(path / 'request.json', {})
        result.append({'job_id': path.name, 'request': request,
                       'status': read_json(path / 'status.json', {'state': 'interrupted'})})
    return sorted(result, key=lambda item: item['request'].get('created_at', 0), reverse=True)


@router.get('/jobs/{job_id}')
def get_job(job_id: str):
    path = directory(job_id)
    return {'job_id': job_id, 'request': read_json(path / 'request.json', {}),
            'status': read_json(path / 'status.json', {'state': 'interrupted'}),
            'manifest': read_json(path / 'manifest.json')}


@router.post('/jobs/{job_id}/cancel', status_code=202)
def cancel_job(job_id: str):
    jobs.cancel(job_id)
    return {'job_id': job_id, 'cancel_requested': True}


@router.delete('/jobs/{job_id}')
def delete_job(job_id: str):
    with jobs.lock:
        path = directory(job_id)
        if jobs.active == job_id or read_json(path / 'status.json', {}).get('state') not in TERMINAL:
            raise HTTPException(409, '只能删除已结束的任务')
        shutil.rmtree(path)
    return {'deleted': job_id}


@router.get('/jobs/{job_id}/files/{filename}')
def asset(job_id: str, filename: str):
    path = directory(job_id)
    if not FILE_PATTERN.fullmatch(filename):
        raise HTTPException(404, '实验文件不存在')
    file = (path / filename).resolve()
    if file.parent != path or not file.is_file():
        raise HTTPException(404, '该帧尚未保存或不存在')
    return FileResponse(file, media_type='application/json' if file.suffix == '.json' else 'image/png',
                        headers={'Cache-Control': 'private, max-age=31536000, immutable'})
