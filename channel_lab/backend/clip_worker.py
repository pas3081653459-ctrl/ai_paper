"""离线 CLIP 编码。stdin JSON -> stdout JSON；不缓存用户照片或加载远程代码。"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import threading
import time


def fingerprint(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def infer(payload):
    os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
    import importlib.metadata
    import numpy as np
    from PIL import Image, ImageOps
    import torch
    import torch.nn.functional as F
    from transformers import CLIPModel, CLIPTokenizer, CLIPImageProcessor

    torch.set_num_threads(2)
    Image.MAX_IMAGE_PIXELS = 12_000_000
    root = Path(payload['model_dir'])
    device = payload['device']
    if device == 'mps' and not torch.backends.mps.is_available():
        raise ValueError('MPS 不可用，请配置 cpu')
    if device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA 不可用，请配置 cpu')
    raw = base64.b64decode(payload['image_base64'], validate=True)
    with Image.open(io.BytesIO(raw)) as source:
        if source.format not in ('PNG', 'JPEG', 'WEBP') or source.width * source.height > 12_000_000:
            raise ValueError('需要不超过 1200 万像素的 PNG/JPEG/WebP')
        image = ImageOps.exif_transpose(source).convert('RGB')
    tokenizer = CLIPTokenizer.from_pretrained(str(root), local_files_only=True)
    processor = CLIPImageProcessor.from_pretrained(str(root), local_files_only=True)
    weight = root / ('model.safetensors' if (root/'model.safetensors').is_file() else 'pytorch_model.bin')
    model = CLIPModel.from_pretrained(str(root), local_files_only=True,
            use_safetensors=weight.suffix == '.safetensors', weights_only=True).eval().to(device)
    inputs = tokenizer(payload['texts'], padding=True, truncation=False, return_tensors='pt')
    if inputs['input_ids'].shape[1] > model.config.text_config.max_position_embeddings:
        raise ValueError(f'文本超过 {model.config.text_config.max_position_embeddings} token，请缩短描述（包含起止 token）')
    pixels = processor(images=image, return_tensors='pt')['pixel_values']
    with torch.inference_mode():
        image_features = model.get_image_features(pixel_values=pixels.to(device))
        text_features = model.get_text_features(**{k:v.to(device) for k,v in inputs.items()})
        image_unit = F.normalize(image_features, dim=-1)
        text_unit = F.normalize(text_features, dim=-1)
        cosine = image_unit @ text_unit.T
        scale = model.logit_scale.exp()
        logits = cosine * scale
        probabilities = logits.softmax(dim=-1)
    if not bool(torch.isfinite(logits).all()):
        raise ValueError('模型输出包含非有限数值')
    # 对实际 pixel_values 反归一化，以显示模型真正接收的裁剪结果。
    mean = torch.tensor(processor.image_mean).view(3,1,1)
    std = torch.tensor(processor.image_std).view(3,1,1)
    visible = (pixels[0]*std+mean).clamp(0,1).permute(1,2,0)
    buffer = io.BytesIO()
    Image.fromarray((visible.numpy()*255).round().astype(np.uint8)).save(buffer, format='PNG')
    return {'schema_version':1, 'paper_id':'12', 'source':'local-model-inference',
        'texts':payload['texts'], 'input_sha256':hashlib.sha256(raw).hexdigest(),
        'input_size':list(image.size), 'pixel_shape':list(pixels.shape),
        'image_shape':list(image_features.shape), 'text_shape':list(text_features.shape),
        'model_view':'data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode(),
        'token_ids':inputs['input_ids'].tolist(), 'attention_mask':inputs['attention_mask'].tolist(),
        'image_vector':image_unit[0].cpu().tolist(), 'text_vectors':text_unit.cpu().tolist(),
        'cosine':cosine[0].cpu().tolist(), 'logits':logits[0].cpu().tolist(),
        'probabilities':probabilities[0].cpu().tolist(), 'logit_scale':float(scale),
        'model':{'path':str(root), 'weight_file':weight.name, 'weight_sha256':fingerprint(weight),
                 'files_sha256':{name:fingerprint(root/name) for name in ('config.json','preprocessor_config.json','vocab.json','merges.txt','tokenizer_config.json')},
                 'processor':processor.to_dict(), 'device':device,
                 'versions':{p:importlib.metadata.version(p) for p in ('torch','transformers')},
                 'worker_sha256':fingerprint(Path(__file__))},
        'notice':'候选内 softmax 不是校准置信度；此记录不包含训练或定位。'}


def run(inference):
    try:
        payload = json.load(sys.stdin)
        # 父服务异常退出后不继续独占模型；不向任何其他进程发信号。
        parent_pid = payload['parent_pid']
        def watch_parent():
            while True:
                if os.getppid() != parent_pid:
                    os._exit(130)
                time.sleep(1)
        threading.Thread(target=watch_parent, daemon=True).start()
        import fcntl
        from .ddpm_config import runs_dir
        root = runs_dir()
        root.mkdir(parents=True, exist_ok=True)
        # 与 DDPM 共用设备互斥锁，避免两种大模型同时加载。
        with (root / '.ddpm-worker.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError('已有 DDPM/CLIP/语言模型任务，请等待完成或先取消')
            print(json.dumps(inference(payload), ensure_ascii=False, allow_nan=False))
    except Exception as exc:
        print(json.dumps({'error':f'{type(exc).__name__}: {exc}'}, ensure_ascii=False))
        sys.exit(1)


if __name__ == '__main__':
    run(infer)
