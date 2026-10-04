"""DDPM 可选配置：查询配置不会加载模型、创建文件或访问网络。"""
import importlib.metadata
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
DEPENDENCIES = ('diffusers', 'huggingface-hub', 'safetensors')
MODEL_FILES = ('config.json', 'scheduler_config.json', 'diffusion_pytorch_model.safetensors')


def model_dir():
    return Path(os.environ.get('CHANNEL_LAB_DDPM_MODEL', str(ROOT / 'models' / 'ddpm-cifar10-32'))).expanduser().resolve()


def runs_dir():
    return Path(os.environ.get('CHANNEL_LAB_EXPERIMENT_RUNS', str(ROOT / 'experiment_runs'))).expanduser().resolve()


def configuration():
    versions, missing = {}, []
    for package in DEPENDENCIES:
        try:
            versions[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            missing.append(package)
    path = model_dir()
    absent = [name for name in MODEL_FILES if not (path / name).is_file()]
    device = os.environ.get('CHANNEL_LAB_DDPM_DEVICE', 'cpu')
    problems = []
    if missing:
        problems.append('缺少可选依赖：' + ', '.join(missing))
    if absent:
        problems.append('本地模型目录缺少：' + ', '.join(absent))
    if device not in ('cpu', 'mps', 'cuda'):
        problems.append('CHANNEL_LAB_DDPM_DEVICE 必须为 cpu、mps 或 cuda')
    return {'configured': not problems, 'offline_only': True, 'model_dir': str(path),
            'runs_dir': str(runs_dir()), 'device': device, 'dependencies': versions,
            'missing_dependencies': missing, 'missing_files': absent, 'problems': problems,
            'model_id': 'google/ddpm-cifar10-32',
            'note': '仅检查文件和包是否存在；模型兼容性与设备可用性在启动任务时验证。'}
