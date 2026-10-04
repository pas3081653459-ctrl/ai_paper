"""Inspectable local vision experiments. No pipeline, training, remote code or downloads."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import time
from .clip_worker import run, fingerprint
from .vision_api import weight_files
from .ddpm_config import runs_dir


def png(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


def decode(value):
    from PIL import Image, ImageOps
    raw = base64.b64decode(value, validate=True)
    with Image.open(io.BytesIO(raw)) as image:
        if image.format not in ('PNG', 'JPEG', 'WEBP') or max(image.size)>768 or min(image.size)<1:
            raise ValueError('模型输入需为最长边不超过768的 PNG/JPEG/WebP')
        return ImageOps.exif_transpose(image).convert('RGB')


def digest_image(image):
    return hashlib.sha256(str(image.size).encode()+image.tobytes()).hexdigest()


def provenance(root, payload):
    import importlib.metadata
    files = weight_files(root)
    hashes = {p.name: fingerprint(p) for p in files}
    configs = {p.name: fingerprint(p) for p in root.iterdir()
               if p.is_file() and p.suffix in ('.json', '.jinja', '.model') and p.stat().st_size<20_000_000}
    revision = hashlib.sha256(json.dumps({'weights':hashes,'configuration':configs},sort_keys=True).encode()).hexdigest()
    return {'source':'local-model-inference', 'model':str(root), 'revision':revision,
            'created_at':str(time.time()), 'recorder':'vision_worker.py',
            'settings':{'device':payload['device'],'dtype':payload['dtype'],'weights_sha256':hashes,
                        'configuration_sha256':configs,'worker_sha256':fingerprint(Path(__file__)),
                        'versions':{p:importlib.metadata.version(p) for p in ('torch','transformers','Pillow','numpy','safetensors')},
                        'offline_only':True}}


def vit(payload, root, device, dtype, source):
    import torch
    from transformers import ViTForImageClassification, ViTImageProcessor
    images = [decode(payload['image_base64']), decode(payload['changed_base64'])]
    if any(image.size != (224,224) for image in images):
        raise ValueError('ViT 对照图必须都是224×224，不能暗中再次缩放')
    processor = ViTImageProcessor.from_pretrained(str(root), local_files_only=True)
    model = ViTForImageClassification.from_pretrained(str(root), local_files_only=True,
        use_safetensors=True, torch_dtype=dtype, attn_implementation='eager').eval().to(device)
    size, patch = model.config.image_size, model.config.patch_size
    if size != 224 or not isinstance(patch,int) or 224%patch:
        raise ValueError('只支持224输入、整数且整除224的patch_size')
    pixels = processor(images=images, do_resize=False, return_tensors='pt')['pixel_values'].to(device=device,dtype=dtype)
    # Projection is Conv2d(kernel=stride=patch), then spatial flatten and transpose.
    raw = model.vit.embeddings.patch_embeddings(pixels)
    tokens = model.vit.embeddings(pixels)  # prepend CLS + learned position + eval dropout
    output = model(pixel_values=pixels, output_hidden_states=True)
    probabilities = output.logits.float().softmax(-1)
    if not bool(torch.isfinite(probabilities).all()):
        raise ValueError('分类输出包含非有限数值')
    delta = (raw[1].float()-raw[0].float()).square().mean(-1).sqrt()
    conditions = []
    for i, name in enumerate(('original','changed')):
        scores, ids = probabilities[i].topk(min(5,probabilities.shape[-1]))
        conditions.append({'name':name,'image':png(images[i]),'input_sha256':digest_image(images[i]),
            'top': [{'id':int(k),'label':model.config.id2label.get(int(k),str(int(k))),'p':float(p)} for k,p in zip(ids,scores)],
            'patch_vectors':raw[i,:,:16].float().cpu().tolist(),
            'token_vectors':tokens[i,1:,:16].float().cpu().tolist()})
    original_id = int(probabilities[0].argmax())
    source['settings'].update(processor=processor.to_dict(),do_resize=False,patch_size=patch,
                              preview_dimensions=16,intervention='pixels only; learned positions unchanged')
    return {'image_size':224,'patch_size':patch,'hidden_size':int(raw.shape[-1]),
        'conditions':conditions,'position_vectors':model.vit.embeddings.position_embeddings[0,1:,:16].float().cpu().tolist(),
        'patch_delta':delta.cpu().tolist(),'layer_shapes':[list(h.shape) for h in output.hidden_states],
        'reference_class':{'label':model.config.id2label.get(original_id,str(original_id)),
                           'probabilities':probabilities[:,original_id].cpu().tolist()}}


def sam(payload, root, device, dtype, source):
    import numpy as np
    import torch
    from PIL import Image
    from safetensors.torch import load_file, save_file
    from transformers import SamModel, SamProcessor
    image = decode(payload['image_base64'])
    width,height = image.size
    for point in payload['points']:
        if not (0<=point['x']<width and 0<=point['y']<height):
            raise ValueError('提示点超出当前实验图')
    box = payload['box']
    if box and (box[2]>width or box[3]>height):
        raise ValueError('提示框超出当前实验图')
    processor = SamProcessor.from_pretrained(str(root),local_files_only=True)
    model = SamModel.from_pretrained(str(root),local_files_only=True,use_safetensors=True,
                                    torch_dtype=dtype).eval().to(device)
    prompts = {}
    if payload['points']:
        prompts['input_points'] = [[[p['x'],p['y']] for p in payload['points']]]
        prompts['input_labels'] = [[1 if p['label']=='positive' else 0 for p in payload['points']]]
    if box:
        prompts['input_boxes'] = [[box]]
    inputs = processor(images=image, return_tensors='pt', **prompts)
    # Cached content depends on weights/config, RGB pixels, device, dtype and library version.
    key_material = source['revision']+digest_image(image)+json.dumps(source['settings']['versions'],sort_keys=True)+device+str(dtype)+source['settings']['worker_sha256']
    key = hashlib.sha256(key_material.encode()).hexdigest()
    directory = runs_dir()/'.sam-image-cache'
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    # Soft TTL is enforced on access. At most 8 artifacts remain after each successful write.
    for path in directory.iterdir():
        if path.suffix in ('.safetensors','.tmp') and not path.is_symlink() and len(path.stem)==64 and all(c in '0123456789abcdef' for c in path.stem) and time.time()-path.stat().st_mtime>1200:
            path.unlink(missing_ok=True)
    path = directory/f'{key}.safetensors'
    hit = path.is_file() and not path.is_symlink()
    embedding = None
    if hit:
        try:
            embedding = load_file(str(path))['image_embeddings'].to(device=device,dtype=dtype)
            grid=model.config.vision_config.image_size//model.config.vision_config.patch_size
            if embedding.shape != (1,model.config.vision_config.output_channels,grid,grid) or not bool(torch.isfinite(embedding).all()):
                embedding=None; hit=False
        except Exception:
            # Optional cache may be truncated by a previous interrupted write.
            # Recompute from the actual image instead of trusting damaged features.
            embedding=None; hit=False
    if embedding is None:
        embedding = model.get_image_embeddings(inputs['pixel_values'].to(device=device,dtype=dtype))
        temporary = directory/f'{key}.tmp'
        save_file({'image_embeddings':embedding.cpu().contiguous()},str(temporary))
        os.replace(temporary,path)
        entries = sorted(directory.glob('*.safetensors'),key=lambda p:p.stat().st_mtime,reverse=True)
        for old in entries[8:]:
            if len(old.stem)==64 and all(c in '0123456789abcdef' for c in old.stem):
                old.unlink(missing_ok=True)
    args = {k:v.to(device=device,dtype=dtype) if v.is_floating_point() else v.to(device)
            for k,v in inputs.items() if k in ('input_points','input_labels','input_boxes')}
    output = model(image_embeddings=embedding, multimask_output=True, **args)
    masks = processor.image_processor.post_process_masks(output.pred_masks.float().cpu(),
            inputs['original_sizes'].cpu(),inputs['reshaped_input_sizes'].cpu())[0][0]
    scores = output.iou_scores[0,0].float().cpu()
    if not bool(torch.isfinite(scores).all()):
        raise ValueError('模型质量分非有限数值')
    candidates=[]
    for mask,score in zip(masks,scores):
        rgba = np.zeros((height,width,4),dtype=np.uint8)
        rgba[mask.numpy().astype(bool)] = [37,99,235,200]
        candidates.append({'image':png(Image.fromarray(rgba,'RGBA')),'predicted_iou':float(score)})
    source['settings'].update(image_sha256=digest_image(image),cache_key=key,cache_hit=hit,
        embedding_shape=list(embedding.shape),coordinate_system='submitted RGB image pixels',multimask_output=True)
    return {'image':png(image),'width':width,'height':height,'cases':[{'name':'本地当前提示',
        'points':payload['points'],'box':box,'masks':candidates}]}


def llava(payload, root, device, dtype, source):
    import torch
    import numpy as np
    from PIL import Image
    from transformers import LlavaForConditionalGeneration, LlavaProcessor
    original,changed=decode(payload['image_base64']),decode(payload['changed_base64'])
    if original.size != changed.size:
        raise ValueError('对照图尺寸必须相同')
    processor=LlavaProcessor.from_pretrained(str(root),local_files_only=True,trust_remote_code=False)
    model=LlavaForConditionalGeneration.from_pretrained(str(root),local_files_only=True,
        use_safetensors=True,torch_dtype=dtype,attn_implementation='eager').eval().to(device)
    if not processor.chat_template:
        raise ValueError('缺少该checkpoint的processor聊天模板，请保留同revision的chat_template.json/jinja')
    if processor.patch_size != model.config.vision_config.patch_size:
        raise ValueError('processor patch_size 与视觉主干不匹配')
    if processor.vision_feature_select_strategy != model.config.vision_feature_select_strategy:
        raise ValueError('processor 的视觉特征选择策略与模型不一致')
    conditions=[]
    sources=[('original',original),('occluded',changed)]
    if payload['include_no_image']:
        sources.append(('no_image',None))
    for name,image in sources:
        content=([{'type':'image'}] if image is not None else [])+[{'type':'text','text':payload['question']}]
        prompt=processor.apply_chat_template([{'role':'user','content':content}],tokenize=False,add_generation_prompt=True)
        inputs=processor(text=prompt,images=image,return_tensors='pt')
        ids=inputs['input_ids'][0].tolist()
        if len(ids)+payload['max_new_tokens']>model.config.text_config.max_position_embeddings:
            raise ValueError('提示和生成长度超过该模型上下文上限')
        model_view=None
        if 'pixel_values' in inputs:
            p=inputs['pixel_values'][0].float()
            if processor.image_processor.do_normalize:
                mean=torch.tensor(processor.image_processor.image_mean).view(3,1,1)
                std=torch.tensor(processor.image_processor.image_std).view(3,1,1)
                p=p*std+mean
            if processor.image_processor.do_rescale:
                p=p/processor.image_processor.rescale_factor
            rgb=p.clamp(0,255).permute(1,2,0).numpy().round().astype(np.uint8)
            model_view=png(Image.fromarray(rgb))
        args={k:v.to(device=device,dtype=dtype) if v.is_floating_point() else v.to(device) for k,v in inputs.items()}
        generated=[]; past=None; total=len(ids)
        eos=model.generation_config.eos_token_id
        eos_ids=eos if isinstance(eos,list) else [eos]
        for _ in range(payload['max_new_tokens']):
            output=model(**args,use_cache=True)
            p=output.logits[0,-1].float().softmax(-1)
            if not bool(torch.isfinite(p).all()):
                raise ValueError('生成分布包含非有限数值')
            next_id=int(p.argmax())
            generated.append({'id':next_id,'piece':processor.tokenizer.decode([next_id]),'p':float(p[next_id])})
            if next_id in eos_ids:
                break
            past=output.past_key_values; total+=1
            args={'input_ids':torch.tensor([[next_id]],device=device),'attention_mask':torch.ones((1,total),device=device,dtype=torch.long),'past_key_values':past}
        conditions.append({'name':name,'condition':name,'image':png(image) if image is not None else None,
            'model_view':model_view,'input_sha256':digest_image(image) if image is not None else None,
            'prompt':prompt,'input_ids':ids,'generated':generated,
            'stop_reason':'eos' if generated[-1]['id'] in eos_ids else 'length_limit',
            'answer':processor.tokenizer.decode([t['id'] for t in generated],skip_special_tokens=True)})
    source['settings'].update(question=payload['question'],decoding='greedy',max_new_tokens=payload['max_new_tokens'],
        include_no_image=payload['include_no_image'],comparison='same model, question and decoding; image and required image tokens differ',
        model_family='HF LLaVA (Llama backbone), e.g. LLaVA-1.5; not the original 2023 model reproduction')
    source['settings']['comparison_sha256']=hashlib.sha256(json.dumps({
        'revision':source['revision'],'settings':source['settings'],
        'images':[digest_image(original),digest_image(changed)]},sort_keys=True).encode()).hexdigest()
    return {'question':payload['question'],'conditions':conditions}


def infer(payload):
    import torch
    torch.set_num_threads(2)
    device=payload['device']
    if device=='mps' and not torch.backends.mps.is_available():
        raise ValueError('当前环境没有MPS')
    if device=='cuda' and not torch.cuda.is_available():
        raise ValueError('当前环境没有CUDA')
    dtype=torch.float16 if payload['dtype']=='float16' else torch.float32
    root=Path(payload['model_dir'])
    source=provenance(root,payload)
    with torch.inference_mode():
        data={'10':vit,'20':sam,'19':llava}[payload['paper_id']](payload,root,device,dtype,source)
    return {'schema_version':1,'paper_id':payload['paper_id'],'provenance':source,'data':data}


if __name__=='__main__':
    run(infer)
