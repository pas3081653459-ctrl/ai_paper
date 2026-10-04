"""python -m channel_lab.backend.train --epochs 30 --device auto"""
import argparse
import copy
import json
import time
from datetime import datetime, timezone
import torch
from torch import nn
from .models import paired_models
from .data import ARTIFACTS, DATA, load_tensors, split_records, split_hash


def evaluate(model, images, labels, device, batch=128):
    model.eval()
    predictions = []
    with torch.inference_mode():
        for start in range(0, len(images), batch):
            predictions.append(model(images[start:start+batch].to(device).float()/255).argmax(1).cpu())
    predictions = torch.cat(predictions)
    accuracy = (predictions == labels).float().mean().item()
    recalls = [(predictions[labels == k] == k).float().mean().item() for k in (0, 1)]
    confusion = torch.bincount(labels * 2 + predictions, minlength=4).reshape(2, 2).tolist()
    return {'accuracy': accuracy, 'balanced_accuracy': sum(recalls)/2, 'recall': recalls, 'confusion': confusion}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--epochs', type=int, default=30)
    p.add_argument('--device', default='auto', choices=['auto', 'cpu', 'mps', 'cuda'])
    p.add_argument('--batch-size', type=int, default=64)
    p.add_argument('--only', choices=['all', 'cnn', 'resnet'], default='all', help='保留另一个模型，只训练指定模型')
    args = p.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        p.error('epochs / batch-size 必须大于 0')
    torch.set_num_threads(4)
    device = args.device
    if device == 'auto':
        device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    print('device:', device, flush=True)
    train, val, test = split_records()
    ARTIFACTS.mkdir(exist_ok=True)
    splits = {'train': train, 'val': val, 'test': test}
    (ARTIFACTS/'splits.json').write_text(json.dumps(splits))
    tr_x, tr_y = load_tensors(train)
    va_x, va_y = load_tensors(val)
    te_x, te_y = load_tensors(test)
    metadata = {'dataset': 'Oxford-IIIT Pet', 'source': 'https://www.robots.ox.ac.uk/~vgg/data/pets/',
                'seed': 42, 'split_hash': split_hash(splits), 'sizes': {k: len(v) for k,v in splits.items()},
                'class_names': ['猫', '狗'], 'input_size': 64, 'epochs': args.epochs,
                'optimizer': 'AdamW', 'lr': 0.002, 'weight_decay': 0.0001,
                'batch_size': args.batch_size, 'augmentation': '随机水平翻转',
                'selection': '验证集 balanced accuracy', 'shared_initialization': True,
                'trained_at': datetime.now(timezone.utc).isoformat(), 'device': device, 'models': {}}
    if args.only != 'all' and (ARTIFACTS/'metrics.json').exists():
        previous = json.loads((ARTIFACTS/'metrics.json').read_text())
        for key in ['seed', 'split_hash', 'epochs', 'lr', 'weight_decay', 'batch_size', 'optimizer']:
            if previous[key] != metadata[key]:
                raise ValueError(f'单模型重训必须保持原实验配置一致：{key}')
        metadata['models'] = {k:v for k,v in previous['models'].items() if k != args.only}
    for name, model in paired_models().items():
        if args.only != 'all' and name != args.only:
            continue
        model.to(device)
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.002, weight_decay=0.0001)
        schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
        class_counts = torch.bincount(tr_y).float()
        criterion = nn.CrossEntropyLoss(weight=(len(tr_y)/(2*class_counts)).to(device))
        best, history, best_state, best_epoch = -1, [], None, 0
        started = time.monotonic()
        for epoch in range(1, args.epochs+1):
            # 同轮两个模型使用相同样本顺序及翻转决策。
            generator = torch.Generator().manual_seed(42 + epoch)
            order = torch.randperm(len(tr_y), generator=generator)
            flips = torch.rand(len(tr_y), generator=generator) < 0.5
            model.train()
            total_loss = 0
            for start in range(0, len(order), args.batch_size):
                ids = order[start:start+args.batch_size]
                images = tr_x[ids].to(device).float()/255
                flip = flips[start:start+len(ids)].to(device)
                images[flip] = images[flip].flip(-1)
                targets = tr_y[ids].to(device)
                optimizer.zero_grad(set_to_none=True)
                loss = criterion(model(images), targets)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()*len(ids)
            schedule.step()
            metrics = evaluate(model, va_x, va_y, device)
            history.append({'epoch': epoch, 'loss': total_loss/len(tr_y), **metrics})
            if metrics['balanced_accuracy'] > best:
                best = metrics['balanced_accuracy']
                best_epoch = epoch
                best_state = {k: v.detach().cpu().clone() for k,v in model.state_dict().items()}
                torch.save({'state_dict': best_state, 'architecture': name, 'epoch': epoch,
                            'input_size': 64, 'split_hash': metadata['split_hash']}, ARTIFACTS/f'{name}.pt')
            print(f'{name} epoch={epoch}/{args.epochs} loss={total_loss/len(tr_y):.4f} val_acc={metrics["accuracy"]:.3f} balanced={metrics["balanced_accuracy"]:.3f}', flush=True)
            (ARTIFACTS/f'{name}_history.json').write_text(json.dumps(history, indent=2))
        model.load_state_dict(best_state)
        metadata['models'][name] = {'parameters': sum(p.numel() for p in model.parameters()),
                                  'best_epoch': best_epoch, 'validation': evaluate(model, va_x, va_y, device),
                                  'test': evaluate(model, te_x, te_y, device), 'history': history,
                                  'seconds': time.monotonic()-started}
        (ARTIFACTS/'metrics.json').write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
        model.cpu()
    print('训练完成：', ARTIFACTS/'metrics.json', flush=True)

if __name__ == '__main__':
    main()
