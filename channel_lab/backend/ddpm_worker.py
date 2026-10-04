"""按请求启动的离线 DDPM 子进程。直接执行 UNet + scheduler，保存真实中间结果。

不在 import 时加载模型。只接受本地模型路径，不接受 Hub ID，不下载权重。
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import time


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def generate(run, model_path, device_name, parent_pid):
    # 双重离线约束：环境禁网下载 + 所有 from_pretrained 使用绝对本地路径。
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import numpy as np
    from PIL import Image
    import torch
    from diffusers import DDPMScheduler, UNet2DModel

    torch.set_num_threads(2)
    request = json.loads((run / 'request.json').read_text())
    started = time.monotonic()
    manifest = {'schema_version': 1, 'kind': 'ddpm-generation', 'source': 'local-model-inference',
                'request': request, 'frames': [], 'shape': [1, 3, 32, 32],
                'display': {'image': [-1, 1], 'epsilon': [-3, 3], 'added_noise': [-3, 3]},
                'notice': 'PNG 仅用于显示并按固定范围截断；帧 JSON 中保留未截断 float32 数值。'}

    def status(state, completed=0, message=''):
        write_json(run / 'status.json', {'state': state, 'completed_steps': completed,
                   'total_steps': request['steps'], 'saved_frames': len(manifest['frames']),
                   'elapsed_seconds': round(time.monotonic() - started, 2), 'message': message})

    def cancelled():
        return (run / 'cancel').exists() or os.getppid() != parent_pid

    def save_image(value, filename, limits=(-1, 1)):
        rgb = ((value.detach().float().cpu()[0] - limits[0]) / (limits[1] - limits[0])).clamp(0, 1)
        array = (rgb.permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
        Image.fromarray(array).save(run / filename)

    status('loading', message='读取本地权重；不下载文件')
    model = UNet2DModel.from_pretrained(str(model_path), local_files_only=True,
                                      use_safetensors=True, low_cpu_mem_usage=False)
    scheduler = DDPMScheduler.from_pretrained(str(model_path), local_files_only=True)
    if model.config.sample_size != 32 or model.config.in_channels != 3 or model.config.out_channels != 3:
        raise ValueError('首版只支持 32×32、RGB、预测三通道噪声的 DDPM 模型')
    if scheduler.config.prediction_type != 'epsilon' or scheduler.config.thresholding:
        raise ValueError('首版要求 epsilon 预测且不启用 dynamic thresholding')
    if scheduler.config.variance_type not in ('fixed_large', 'fixed_small'):
        raise ValueError('首版只解释 fixed_large / fixed_small 方差')
    if device_name == 'mps' and not torch.backends.mps.is_available():
        raise ValueError('当前 PyTorch 的 MPS 不可用；请将设备配置为 cpu 后重启后端')
    if device_name == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA 不可用；Mac 请使用 cpu 或可用的 mps')
    if cancelled():
        status('cancelled', message='模型加载后取消')
        return
    model.eval().to(device=device_name, dtype=torch.float32)
    # 时间表在 CPU；CPU generator 使随机源不依赖设备。不同设备仍不保证逐位相同。
    scheduler.set_timesteps(request['steps'])
    timesteps = [int(t) for t in scheduler.timesteps]
    rng = torch.Generator(device='cpu').manual_seed(request['seed'])
    sample = torch.randn((1, 3, 32, 32), generator=rng).to(device_name)
    manifest.update({'model': {'id': 'google/ddpm-cifar10-32-compatible-local',
                     'weights_sha256': checksum(model_path / 'diffusion_pytorch_model.safetensors'),
                     'config_sha256': checksum(model_path / 'config.json'),
                     'scheduler_config_sha256': checksum(model_path / 'scheduler_config.json'),
                     'config': dict(model.config)},
                     'worker_sha256': checksum(Path(__file__)),
                     'scheduler': dict(scheduler.config), 'timesteps': timesteps,
                     'device': device_name, 'dtype': 'float32', 'generator_device': 'cpu',
                     'versions': {p: importlib.metadata.version(p) for p in ('torch', 'diffusers', 'safetensors')},
                     'initial_image': 'initial.png', 'final_image': None})
    save_image(sample, 'initial.png')
    write_json(run / 'manifest.json', manifest)
    # 每次都运行真实 UNet；仅稀疏保存帧，不跳过未记录的采样步骤。
    with torch.inference_mode():
        for index, timestep in enumerate(timesteps):
            if cancelled():
                status('cancelled', index, '已停止；已保存帧仍可回放')
                return
            epsilon = model(sample, timestep).sample
            transition = scheduler.step(epsilon, timestep, sample, generator=rng)
            previous = int(scheduler.previous_timestep(timestep))
            alpha_bar = float(scheduler.alphas_cumprod[timestep])
            alpha_previous = float(scheduler.alphas_cumprod[previous]) if previous >= 0 else 1.0
            alpha = alpha_bar / alpha_previous
            beta = 1 - alpha
            # 与 scheduler 中 x0 裁剪后的后验均值一致；不把未裁剪公式误当实际轨迹。
            coeff_x0 = alpha_previous ** .5 * beta / (1 - alpha_bar)
            coeff_xt = alpha ** .5 * (1 - alpha_previous) / (1 - alpha_bar)
            mean = coeff_x0 * transition.pred_original_sample + coeff_xt * sample
            if index == 0 or (index + 1) % request['save_every'] == 0 or index == len(timesteps) - 1:
                prefix = f'frame-{index:04d}'
                tensors = {'sample': sample, 'epsilon': epsilon,
                           'predicted_x0': transition.pred_original_sample, 'mean': mean,
                           'added_noise': transition.prev_sample - mean, 'next_sample': transition.prev_sample}
                payload = {'index': index, 'timestep': timestep, 'previous_timestep': previous,
                           'shape': [1, 3, 32, 32], 'alpha_bar': alpha_bar,
                           'coeff_x0': coeff_x0, 'coeff_xt': coeff_xt,
                           'images': {}, 'values': {}, 'ranges': {}}
                for key, tensor in tensors.items():
                    array = tensor.detach().float().cpu()
                    if not bool(torch.isfinite(array).all()):
                        raise ValueError('采样出现非有限数值；停止并保留此前有效帧')
                    limits = (-3, 3) if key in ('epsilon', 'added_noise') else (-1, 1)
                    filename = f'{prefix}-{key}.png'
                    save_image(array, filename, limits)
                    payload['images'][key] = filename
                    payload['values'][key] = array.flatten().tolist()
                    payload['ranges'][key] = {'min': float(array.min()), 'max': float(array.max())}
                write_json(run / f'{prefix}.json', payload)
                manifest['frames'].append({'index': index, 'timestep': timestep,
                                           'previous_timestep': previous, 'file': f'{prefix}.json',
                                           'thumbnail': f'{prefix}-next_sample.png'})
                write_json(run / 'manifest.json', manifest)
            sample = transition.prev_sample
            status('running', index + 1, '实际模型逐步采样中')
    if cancelled():
        status('cancelled', len(timesteps), '完成采样时收到取消请求')
        return
    save_image(sample, 'final.png')
    manifest['final_image'] = 'final.png'
    write_json(run / 'manifest.json', manifest)
    status('completed', len(timesteps), '生成完成；这是实际生成记录，不是原论文基准复现')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', required=True)
    parser.add_argument('--model', required=True)
    parser.add_argument('--device', choices=['cpu', 'mps', 'cuda'], default='cpu')
    parser.add_argument('--parent-pid', type=int, required=True)
    args = parser.parse_args()
    run = Path(args.run).resolve()
    try:
        # 防止多服务进程或异常重启后同时占用设备。锁文件不包含模型数据。
        import fcntl
        with (run.parent / '.ddpm-worker.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError('已有 DDPM worker 正在运行，请等待或取消原任务')
            generate(run, Path(args.model).resolve(), args.device, args.parent_pid)
    except Exception as exc:
        try:
            existing = json.loads((run / 'status.json').read_text())
        except (OSError, ValueError):
            existing = {}
        existing.update(state='failed', message=f'{type(exc).__name__}: {exc}')
        write_json(run / 'status.json', existing)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
