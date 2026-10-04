"""Transparent GPT-2 substitute experiments: public solutions, sampling, and aligned NLL."""
import hashlib
import json
import re
import time
from pathlib import Path
from .clip_worker import run, fingerprint
from .language_worker import decode


def final_answer(output):
    output=output.replace('\r\n','\n').replace('\r','\n')
    lines=output.strip().split('\n')
    matches=[m.group(1) for line in output.split('\n')
             if (m:=re.fullmatch(r'FINAL:[ \t]*([+-]?[0-9]{1,12})[ \t]*',line))]
    if len(matches)!=1 or not lines or not re.fullmatch(r'FINAL:[ \t]*[+-]?[0-9]{1,12}[ \t]*',lines[-1]):
        return None
    return str(int(matches[0]))


def sample_decode(model,tokenizer,prompt,device,count,seed,temperature):
    import torch
    ids=tokenizer.encode(prompt,add_special_tokens=False)
    if not ids or len(ids)+count>model.config.max_position_embeddings:
        raise ValueError('输入及生成超过上下文限制；不自动截断')
    sequence=torch.tensor([ids],device=device);past=None;tokens=[]
    generator=torch.Generator(device='cpu').manual_seed(seed)
    for _ in range(count):
        output=model(input_ids=sequence if past is None else sequence[:,-1:],past_key_values=past,use_cache=True)
        probs=(output.logits[0,-1]/temperature).softmax(-1)
        if not torch.isfinite(probs).all():
            raise ValueError('模型概率包含非有限数值')
        next_id=int(torch.multinomial(probs.float().cpu(),1,generator=generator))
        tokens.append({'id':next_id,'piece':tokenizer.decode([next_id]),'p':float(probs[next_id])})
        sequence=torch.cat([sequence,torch.tensor([[next_id]],device=device)],dim=1);past=output.past_key_values
        if next_id==tokenizer.eos_token_id:
            break
    return {'text':prompt,'tokens':tokenizer.convert_ids_to_tokens(ids),'input_ids':ids,
            'generated':tokens,'output':tokenizer.decode([t['id'] for t in tokens],skip_special_tokens=True),
            'stop_reason':'eos' if tokens[-1]['id']==tokenizer.eos_token_id else 'length_limit','seed':seed}


def score_tools(payload,model,tokenizer,device):
    import torch
    results=[]
    for candidate in payload['candidates']:
        a,b,op=candidate['a'],candidate['b'],candidate['op']
        result={'+':lambda:a+b,'-':lambda:a-b,'*':lambda:a*b}[op]()
        call=f'Calculator({a}{op}{b})'
        prefixes=[candidate['prefix'],candidate['prefix']+f' [{call} → ]',candidate['prefix']+f' [{call} → {result}]']
        # The SAME separately encoded target IDs are appended to each prefix.
        # This controls BPE boundary differences; it is not retokenizing each concatenated string.
        targets=tokenizer.encode(candidate['target'],add_special_tokens=False)
        if not targets or len(targets)>64:
            raise ValueError('目标后缀需要1–64个token')
        contexts=[];losses=[]
        for prefix in prefixes:
            prefix_ids=tokenizer.encode(prefix,add_special_tokens=False)
            if not prefix_ids or len(prefix_ids)+len(targets)>model.config.max_position_embeddings:
                raise ValueError('评分序列超过上下文限制')
            ids=prefix_ids+targets
            logits=model(input_ids=torch.tensor([ids],device=device),use_cache=False).logits[0]
            log_probs=logits[len(prefix_ids)-1:len(ids)-1].log_softmax(-1)
            nll=-log_probs.gather(1,torch.tensor(targets,device=device).unsqueeze(1)).squeeze(1)
            if not torch.isfinite(nll).all():
                raise ValueError('评分包含非有限NLL')
            contexts.append({'prefix':prefix,'prefix_ids':prefix_ids,'target_start':len(prefix_ids)})
            losses.append(nll.tolist())
        results.append({'call':call,'tool_return':str(result),'target_text':candidate['target'],
            'target_ids':targets,'target_tokens':tokenizer.convert_ids_to_tokens(targets),
            'weights':[1/len(targets)]*len(targets),'loss_without':losses[0],'loss_empty':losses[1],
            'loss_with':losses[2],'contexts':contexts})
    return {'format':'tool-score-v2','candidates':results}


def infer(payload):
    import importlib.metadata
    import torch
    from transformers import GPT2Tokenizer,GPT2LMHeadModel
    torch.set_num_threads(2)
    root=Path(payload['model_dir']);device=payload['device'];paper=payload['paper_id']
    if device=='cuda' and not torch.cuda.is_available() or device=='mps' and not torch.backends.mps.is_available():
        raise ValueError('所选设备不可用')
    tokenizer=GPT2Tokenizer.from_pretrained(str(root),local_files_only=True)
    model,info=GPT2LMHeadModel.from_pretrained(str(root),local_files_only=True,use_safetensors=True,
                                           torch_dtype=torch.float32,output_loading_info=True)
    if info.get('missing_keys') or info.get('mismatched_keys') or info.get('error_msgs'):
        raise ValueError('权重缺参数或不兼容，不使用随机补全输出')
    model=model.eval().to(device)
    cases=json.loads(Path(__file__).with_name('reasoning_cases.json').read_text())
    with torch.inference_mode():
        if paper=='22':
            data=score_tools(payload,model,tokenizer,device)
        else:
            tasks=[]
            for case in cases['tasks']:
                if case['id'] not in payload['task_ids']:
                    continue
                base=f"Question: {case['question']}\n"
                # Public concise worked solution only; no private reasoning fields are requested or stored.
                direct=base+'Return only the answer on a line formatted FINAL: integer.\nAnswer:\n'
                explained=base+'Write a brief worked solution that a student can check. End with a line formatted FINAL: integer.\nSolution:\n'
                if paper=='14':
                    responses=[]
                    for name,prompt in [('direct',direct),('worked',explained)]:
                        result=decode(model,tokenizer,prompt,device,payload['max_new_tokens'])
                        responses.append(dict(result,condition=name,answer=final_answer(result['output'])))
                    tasks.append(dict(case,responses=responses))
                else:
                    answers=[]
                    for i in range(payload['samples']):
                        result=sample_decode(model,tokenizer,explained,device,payload['max_new_tokens'],payload['seed']+i,payload['temperature'])
                        answers.append(dict(result,answer=final_answer(result['output'])))
                    tasks.append(dict(case,answers=answers))
            data={'format':'solution-audit-v2' if paper=='14' else 'reward-group-v2','route':'substitute',
                  'dataset_version':cases['version'],'tasks':tasks}
    files=['config.json','model.safetensors','tokenizer_config.json','vocab.json','merges.txt']
    files += [n for n in ('special_tokens_map.json','added_tokens.json','tokenizer.json') if (root/n).is_file()]
    settings={'substitute':'GPT-2; no original-paper training or benchmark reproduction','device':device,'dtype':'float32',
        'decoding':'teacher-forced-NLL' if paper=='22' else 'greedy' if paper=='14' else 'full-vocabulary-temperature-sampling',
        'parameters':{k:v for k,v in payload.items() if k not in ('parent_pid','model_dir','device')},
        'files_sha256':{n:fingerprint(root/n) for n in files},'worker_sha256':fingerprint(Path(__file__)),
        'decoder_sha256':fingerprint(Path(__file__).with_name('language_worker.py')),
        'cases_sha256':fingerprint(Path(__file__).with_name('reasoning_cases.json')),
        'torch':torch.__version__,'transformers':importlib.metadata.version('transformers')}
    settings['request_sha256']=hashlib.sha256(json.dumps(settings['parameters'],sort_keys=True).encode()).hexdigest()
    return {'schema_version':1,'paper_id':paper,'provenance':{'source':'local-model-inference',
        'model':str(root),'revision':fingerprint(root/'model.safetensors'),'created_at':str(time.time()),
        'recorder':'training_worker.py','settings':settings},'data':data}

if __name__=='__main__':
    run(infer)
