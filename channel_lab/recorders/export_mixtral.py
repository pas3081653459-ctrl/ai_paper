"""Offline routing export for transformers==4.55.4. Explicitly run by the user only.
No generation, training, network download, quantization or device dispatch.
"""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def write_json(path, value):
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')
    if len(raw) > 4 * 1024 * 1024:
        raise ValueError('Layer file exceeds browser limit')
    with path.open('xb') as stream:
        stream.write(raw)
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--text-a', default='I sat on the bank of the river.')
    parser.add_argument('--text-b', default='I asked the bank for a loan.')
    args = parser.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import torch
    import transformers
    from transformers import AutoTokenizer, MixtralForCausalLM
    if transformers.__version__ != '4.55.4':
        raise ValueError('This recorder targets transformers==4.55.4; review hooks before changing versions')
    root = args.model.resolve(strict=True)
    if not root.is_dir() or args.output.exists():
        raise ValueError('Model must be a local directory; output must not already exist')
    files = sorted(p for p in root.rglob('*') if p.is_file() and p.suffix in {'.json', '.safetensors', '.model', '.txt'})
    if not any(p.suffix == '.safetensors' for p in files):
        raise ValueError('Local safetensors weights required')
    fingerprints = {}
    for file in files:
        digest = hashlib.sha256()
        with file.open('rb') as stream:
            for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
                digest.update(chunk)
        fingerprints[str(file.relative_to(root))] = digest.hexdigest()
    tokenizer = AutoTokenizer.from_pretrained(root, local_files_only=True, trust_remote_code=False)
    model, info = MixtralForCausalLM.from_pretrained(root, local_files_only=True,
        use_safetensors=True, torch_dtype=torch.float32 if args.device == 'cpu' else torch.float16,
        output_loading_info=True)
    if any(info.get(k) for k in ('missing_keys', 'unexpected_keys', 'mismatched_keys', 'error_msgs')):
        raise ValueError(f'Incomplete checkpoint loading: {info}')
    model.to(args.device).eval()
    blocks = [layer.block_sparse_moe for layer in model.model.layers]
    e, k, d = model.config.num_local_experts, model.config.num_experts_per_tok, model.config.hidden_size
    if not (2 <= e <= 128 and 1 <= k <= min(8, e) and len(blocks) <= 64 and d <= 65536):
        raise ValueError('Model exceeds viewer limits')
    args.output.mkdir(parents=True)
    cases = []
    # Manifest is written last. If interrupted, discard the incomplete output directory.
    for case_index, sentence in enumerate([args.text_a, args.text_b]):
        inputs = tokenizer(sentence, return_tensors='pt')
        ids = inputs['input_ids'][0].tolist()
        if not 1 <= len(ids) <= 256:
            raise ValueError('Each context must contain 1–256 tokens; no silent truncation')
        case_id = f'context-{case_index}'
        layers = []
        def hook_for(index):
            def capture(module, inputs, output):
                logits = output[1].detach()
                probs = torch.softmax(logits, dim=-1, dtype=torch.float32)
                weights, selected = torch.topk(probs, k, dim=-1)
                weights = (weights / weights.sum(dim=-1, keepdim=True)).to(inputs[0].dtype)
                name, filename = f'layer-{index}', f'case-{case_index}-layer-{index}.json'
                sha = write_json(args.output / filename, dict(case_id=case_id, layer=name,
                    probabilities=probs.cpu().tolist(), selected=selected.cpu().tolist(),
                    weights=weights.float().cpu().tolist()))
                layers.append(dict(name=name, file=filename, sha256=sha))
            return capture
        handles = [block.register_forward_hook(hook_for(i)) for i, block in enumerate(blocks)]
        try:
            with torch.inference_mode():
                model.model(**{key: value.to(args.device) for key, value in inputs.items()}, use_cache=False)
        finally:
            for handle in handles:
                handle.remove()
        cases.append(dict(id=case_id, text=sentence, tokens=[dict(text=tokenizer.convert_ids_to_tokens(i) or f'ID:{i}', id=i, padding=False) for i in ids], layers=layers))
    manifest = dict(schema_version=1, paper_id='23', provenance=dict(
        source='local forward hooks on MixtralSparseMoeBlock', model=root.name,
        revision=hashlib.sha256(json.dumps(fingerprints, sort_keys=True).encode()).hexdigest(),
        created_at=datetime.now(timezone.utc).isoformat(), recorder='export_mixtral.py/v2',
        settings=dict(transformers=transformers.__version__, torch=torch.__version__,
            device=args.device, fingerprints=fingerprints, generation=False)), data=dict(
        format='routing-pack-v2', experts=e, top_k=k, hidden_size=d,
        parameter_counts=dict(total=sum(p.numel() for p in model.parameters()),
            expert_total=sum(p.numel() for b in blocks for p in b.experts.parameters())), cases=cases))
    raw = json.dumps(manifest, ensure_ascii=False, allow_nan=False).encode()
    if len(raw) > 1024 * 1024 or sum(p.stat().st_size for p in args.output.iterdir()) + len(raw) > 64 * 1024 * 1024:
        raise ValueError('Routing pack exceeds browser limits')
    write_json(args.output / 'manifest.json', manifest)


if __name__ == '__main__':
    main()
