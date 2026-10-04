"""本地学习网站 API。上传图片只在内存中使用，不落盘，不提供训练入口。"""
import base64
import io
import json
import os
import threading
import time
from pathlib import Path
import warnings
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
import torch
from fastapi import FastAPI, HTTPException, File, UploadFile, Query
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.formparsers import MultiPartParser
from .models import paired_models, node_specs
from .data import ARTIFACTS, DATA, ROOT, preprocess, read_records
from .ddpm_api import router as ddpm_router, jobs as ddpm_jobs
from .clip_api import router as clip_router, shutdown as shutdown_clip
from .react_api import router as react_router
from .language_api import router as language_router
from .vision_api import router as vision_router
from .training_api import router as training_router

@asynccontextmanager
async def lifespan(app):
    try:
        yield
    finally:
        ddpm_jobs.shutdown()
        await shutdown_clip()


app = FastAPI(title='Channel Lab', version='1.0.0', lifespan=lifespan)
app.include_router(ddpm_router)
app.include_router(clip_router)
app.include_router(react_router)
app.include_router(language_router)
app.include_router(vision_router)
app.include_router(training_router)
app.add_middleware(GZipMiddleware, minimum_size=1000)
torch.set_num_threads(2)
MODELS = paired_models()
RANDOM_MODELS = paired_models()
for model in [*MODELS.values(), *RANDOM_MODELS.values()]:
    model.eval()
LOCK = threading.Lock()
STAMP = None
MAX_BYTES = 10 * 1024 * 1024
# 有效上传留在内存中，不触发 Starlette 默认 1 MB 的临时文件落盘。
MultiPartParser.spool_max_size = MAX_BYTES + 65536
Image.MAX_IMAGE_PIXELS = 20_000_000


class UploadBodyLimit:
    """在 multipart 解析之前限制整个请求体，包括未声明 Content-Length 的请求。"""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        limits = {'/api/analyze': MAX_BYTES + 65536, '/api/experiments/clip/compare': 3_000_000}
        path = scope.get('path', '')
        limit = limits.get(path)
        if path == '/api/experiments/vision/run':
            limit = 6_600_000
        if path.startswith('/api/experiments/react/') or path.startswith('/api/experiments/language/') or path.startswith('/api/experiments/training/'):
            limit = 16384
        if scope['type'] != 'http' or limit is None or scope['method'] != 'POST':
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            body.extend(message.get('body', b''))
            if len(body) > limit:
                return await JSONResponse({'detail': f'请求体超过 {limit} 字节限制'}, status_code=413)(scope, receive, send)
            if not message.get('more_body', False):
                break
        sent = False
        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}
            return await receive()
        await self.app(scope, replay, send)


app.add_middleware(UploadBodyLimit)


def metadata():
    path = ARTIFACTS/'metrics.json'
    if not path.exists():
        return None
    result = json.loads(path.read_text())
    if set(result.get('models', {})) != {'cnn', 'resnet'}:
        return None
    return result


def load_models():
    global STAMP
    info = metadata()
    paths = [ARTIFACTS/f'{name}.pt' for name in MODELS]
    if info is None or not all(path.exists() for path in paths):
        return False
    stamp = tuple(path.stat().st_mtime_ns for path in paths)
    if stamp != STAMP:
        states = {}
        for name, path in zip(MODELS, paths):
            checkpoint = torch.load(path, map_location='cpu', weights_only=True)
            if checkpoint['architecture'] != name or checkpoint['split_hash'] != info['split_hash']:
                raise RuntimeError('权重与实验元数据不一致')
            states[name] = checkpoint['state_dict']
        for name, state in states.items():
            MODELS[name].load_state_dict(state)
            MODELS[name].eval()
        STAMP = stamp
    return True


@app.get('/api/health')
def health():
    with LOCK:
        ready = load_models()
    return {'ok': True, 'trained_ready': ready}


@app.get('/api/models')
def model_info():
    with LOCK:
        ready = load_models()
        info = metadata()
    return {'trained_ready': ready, 'experiment': info,
            'models': {name: {'parameters': sum(p.numel() for p in model.parameters()),
                             'name': '普通 CNN' if name == 'cnn' else '小型 ResNet'} for name, model in MODELS.items()},
            'input_size': 64, 'classes': ['猫', '狗']}


def samples():
    try:
        records = read_records('test')
    except FileNotFoundError:
        return []
    result = []
    for label in (0, 1):
        name = next(name for name, species in records if species == label)
        result.append({'id': name, 'label': label, 'name': '猫咪样本' if label == 0 else '狗狗样本',
                       'url': f'/api/samples/{name}', 'source': 'Oxford-IIIT Pet · 官方测试集'})
    return result


@app.get('/api/samples')
def sample_list():
    return samples()


@app.get('/api/samples/{sample_id}')
def sample_image(sample_id: str):
    if sample_id not in {s['id'] for s in samples()}:
        raise HTTPException(404, '样本不存在')
    return FileResponse(DATA/'images'/f'{sample_id}.jpg', media_type='image/jpeg')


def png_url(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


def pack_feature(tensor):
    array = tensor[0].cpu().numpy().astype('<f4')
    flat = array.reshape(array.shape[0], -1)
    return {'shape': list(tensor.shape), 'data': base64.b64encode(array.tobytes()).decode(),
            'min': float(array.min()), 'max': float(array.max()), 'mean': float(array.mean()),
            'channels': [{'min': float(a.min()), 'max': float(a.max()), 'mean': float(a.mean())} for a in flat]}


@app.post('/api/analyze')
async def analyze(file: UploadFile = File(...), mode: str = Query('trained')):
    if mode not in ('trained', 'random'):
        raise HTTPException(400, '未知权重模式')
    content = await file.read(MAX_BYTES+1)
    await file.close()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, '图片超过 10 MB，请缩小后重试')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValueError('unsupported format')
                original_size = list(ImageOps.exif_transpose(source).size)
                image = preprocess(source)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(400, '无法读取图片，请上传有效的 JPG、PNG 或 WebP（最多 2000 万像素）')
    inputs = torch.from_numpy(np.array(image)).permute(2, 0, 1).float().unsqueeze(0)/255
    started = time.perf_counter()
    result = {}
    # 锁保证切换权重和前向互不干扰；前向只在 CPU 执行，小模型无需 GPU。
    with LOCK, torch.inference_mode():
        ready = load_models()
        if mode == 'trained' and not ready:
            raise HTTPException(503, '训练权重尚未就绪，可显式切换到随机权重教学模式')
        models = MODELS if mode == 'trained' else RANDOM_MODELS
        for name, model in models.items():
            logits, features = model(inputs, trace=True)
            specs = node_specs(model, features)
            probabilities = logits.softmax(1)[0].tolist()
            result[name] = {'probabilities': probabilities, 'prediction': int(logits.argmax(1)),
                            'features': {key: {**pack_feature(value), **specs[key]} for key, value in features.items()}}
    return {'mode': mode, 'preprocessed': png_url(image), 'original_size': original_size,
            'input_shape': [1, 3, 64, 64], 'milliseconds': round((time.perf_counter()-started)*1000, 1),
            'models': result}

# 只暴露课程目录中列明的 PDF，禁止把整个论文文件夹作为静态目录。
PAPER_ROOT = Path(os.environ.get('CHANNEL_LAB_PAPER_ROOT', '/Users/Zhuanz/论文')).expanduser().resolve()
PAPER_SOURCES = json.loads(Path(__file__).with_name('paper_sources.json').read_text(encoding='utf-8'))


@app.get('/api/papers/{paper_id}')
def paper_pdf(paper_id: str):
    source = PAPER_SOURCES.get(paper_id)
    if source is None:
        raise HTTPException(404, '课程论文不存在')
    path = (PAPER_ROOT / source['folder'] / source['file']).resolve()
    if not path.is_relative_to(PAPER_ROOT) or not path.is_file():
        raise HTTPException(404, '本地论文未找到，请检查 CHANNEL_LAB_PAPER_ROOT 配置和论文文件夹')
    return FileResponse(path, media_type='application/pdf', filename=source['file'],
                        content_disposition_type='inline')


# 构建完成后单端口提供前端；开发时可使用 Vite 代理。
DIST = ROOT/'frontend'/'dist'
if DIST.exists():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='frontend')
