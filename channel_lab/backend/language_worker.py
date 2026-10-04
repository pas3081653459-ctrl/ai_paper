"""离线语言实验：MLM 概率、显式贪心解码、固定题集上下文干预。不训练。"""
from pathlib import Path
import hashlib
import json
import time
from .clip_worker import run, fingerprint


def decode(model, tokenizer, text, device, count):
    import torch
    inputs = tokenizer(text, return_tensors='pt')
    ids = inputs['input_ids'][0].tolist()
    if len(ids) + count > model.config.max_position_embeddings:
        raise ValueError('输入与生成长度超过上下文上限；不自动截断示例')
    sequence = inputs['input_ids'].to(device)
    generated, past = [], None
    for _ in range(count):
        output = model(input_ids=sequence if past is None else sequence[:, -1:],
                       past_key_values=past, use_cache=True)
        probs = output.logits[0, -1].softmax(-1)
        if not torch.isfinite(probs).all():
            raise ValueError('模型输出包含非有限概率')
        next_id = int(probs.argmax())
        generated.append({'id':next_id, 'piece':tokenizer.decode([next_id]), 'p':float(probs[next_id])})
        sequence = torch.cat([sequence, torch.tensor([[next_id]], device=device)], dim=1)
        past = output.past_key_values
        if next_id == tokenizer.eos_token_id:
            break
    return {'text':text, 'tokens':tokenizer.convert_ids_to_tokens(ids), 'input_ids':ids,
            'attention_mask':inputs['attention_mask'][0].tolist(), 'generated':generated,
            'output':tokenizer.decode([t['id'] for t in generated], skip_special_tokens=True),
            'stop_reason':'eos' if generated[-1]['id'] == tokenizer.eos_token_id else 'length_limit'}


def context_experiment(payload, model, tokenizer, device):
    cases = json.loads(Path(__file__).with_name('context_cases.json').read_text())
    examples = {e['id']:e for e in cases['examples']}
    conditions = []
    for spec in payload['conditions']:
        mapping = {'positive':'A', 'negative':'B'} if spec['renamed'] else {'positive':'positive', 'negative':'negative'}
        shown = []
        for key in spec['example_ids']:
            e = examples[key]
            label = e['label']
            if key == spec['corrupt_id']:
                label = 'negative' if label == 'positive' else 'positive'
            shown.append({'id':key, 'input':e['input'], 'label':mapping[label]})
        # Test gold labels are deliberately absent from the prompt builder.
        instruction = f"Classify the sentiment. Reply with {mapping['positive']} for positive or {mapping['negative']} for negative.\n"
        prefix = instruction + ''.join(f"Review: {e['input']}\nLabel: {e['label']}\n\n" for e in shown)
        results = []
        for case in cases['tests']:
            prompt = prefix + f"Review: {case['input']}\nLabel:"
            result = decode(model, tokenizer, prompt, device, payload['max_new_tokens'])
            first_line = result['output'].strip().split('\n')[0].strip()
            predicted = next((k for k, v in mapping.items() if v == first_line), 'other')
            results.append(dict(result, test_id=case['id'], test_input=case['input'],
                                target=mapping[case['label']], target_class=case['label'],
                                prediction=predicted, correct=predicted == case['label']))
        conditions.append({'name':spec['name'], 'examples':shown, 'mapping':mapping, 'results':results})
    return {'dataset_version':cases['version'], 'conditions':conditions}


def infer(payload):
    import importlib.metadata
    import torch
    from transformers import BertTokenizer, BertForMaskedLM, GPT2Tokenizer, GPT2LMHeadModel
    torch.set_num_threads(2)
    root, device, paper = Path(payload['model_dir']), payload['device'], payload['paper_id']
    if device == 'mps' and not torch.backends.mps.is_available():
        raise ValueError('MPS 不可用')
    if device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA 不可用')
    tokenizer_cls, model_cls = (BertTokenizer, BertForMaskedLM) if paper == '06' else (GPT2Tokenizer, GPT2LMHeadModel)
    tokenizer = tokenizer_cls.from_pretrained(str(root), local_files_only=True)
    model, loading = model_cls.from_pretrained(str(root), local_files_only=True, use_safetensors=True,
                                               torch_dtype=torch.float32, output_loading_info=True)
    if loading.get('missing_keys') or loading.get('mismatched_keys') or loading.get('error_msgs'):
        raise ValueError('checkpoint 缺少模型/输出头参数或维度不符；不使用随机补全的参数生成教学结果')
    model = model.eval().to(device)
    conditions = []
    with torch.inference_mode():
        if paper == '08':
            data = context_experiment(payload, model, tokenizer, device)
        else:
            for text in payload['texts']:
                if paper == '07':
                    conditions.append(decode(model, tokenizer, text, device, payload['max_new_tokens']))
                    continue
                inputs = tokenizer(text, return_tensors='pt')
                ids = inputs['input_ids'][0].tolist()
                if len(ids) > model.config.max_position_embeddings:
                    raise ValueError('输入超过 BERT 上下文上限；不自动截断')
                positions = [i for i, token in enumerate(ids) if token == tokenizer.mask_token_id]
                if len(positions) != 1:
                    raise ValueError('每个 BERT 条件恰好需要一个 [MASK]')
                logits = model(**{k:v.to(device) for k,v in inputs.items()}).logits[0, positions[0]]
                probabilities = logits.softmax(-1)
                if not torch.isfinite(probabilities).all():
                    raise ValueError('模型输出包含非有限概率')
                values, indices = probabilities.topk(min(8, probabilities.numel()))
                conditions.append({'text':text, 'tokens':tokenizer.convert_ids_to_tokens(ids), 'input_ids':ids,
                    'attention_mask':inputs['attention_mask'][0].tolist(), 'mask_index':positions[0],
                    'candidates':[{'token':tokenizer.convert_ids_to_tokens(int(i)), 'id':int(i), 'p':float(p)}
                                  for i,p in zip(indices,values)]})
            data = {'conditions':conditions}
    files = ['config.json', 'model.safetensors', 'tokenizer_config.json'] + (['vocab.txt'] if paper == '06' else ['vocab.json','merges.txt'])
    for name in ('special_tokens_map.json', 'added_tokens.json', 'tokenizer.json'):
        if (root/name).is_file():
            files.append(name)
    settings = {'device':device, 'dtype':'float32', 'decoding':'masked-softmax' if paper == '06' else 'greedy',
        'max_new_tokens':payload['max_new_tokens'], 'files_sha256':{name:fingerprint(root/name) for name in files},
        'worker_sha256':fingerprint(Path(__file__)), 'transformers':importlib.metadata.version('transformers'),
        'torch':torch.__version__}
    if paper == '08':
        settings.update(substitute_for='GPT-3 input-condition teaching only; GPT-2 weights',
                        cases_sha256=fingerprint(Path(__file__).with_name('context_cases.json')))
    settings['request_sha256'] = hashlib.sha256(json.dumps({k:v for k,v in payload.items() if k != 'parent_pid'},
                                                         sort_keys=True).encode()).hexdigest()
    return {'schema_version':1, 'paper_id':paper, 'provenance':{'source':'local-model-inference', 'model':str(root),
        'revision':fingerprint(root/'model.safetensors'), 'created_at':str(time.time()),
        'recorder':'language_worker.py', 'settings':settings}, 'data':data}


if __name__ == '__main__':
    run(infer)
