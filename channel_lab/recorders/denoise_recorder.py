"""Snapshot adapter, not a sampler. Call only with actual post-update model states.
Standard library only; pass image bytes already decoded/encoded by your pipeline.
"""
import base64
import copy
import json
from pathlib import Path


class DenoiseRecorder:
    def __init__(self, *, provenance, positions, mask_id, tokenizer_revision,
                 decoder_revision, image_grid=None, image_shape=None):
        if not 1 <= len(positions) <= 512:
            raise ValueError('Viewer supports 1–512 positions')
        if any(p.get('kind') not in ('text', 'image') or type(p.get('condition')) is not bool for p in positions):
            raise ValueError('Each position needs kind and boolean condition')
        if type(mask_id) is not int or mask_id < 0:
            raise ValueError('Invalid mask ID')
        for key in ('source', 'model', 'revision', 'created_at', 'recorder'):
            if not isinstance(provenance.get(key), str) or not provenance[key].strip():
                raise ValueError(f'Missing provenance {key}')
        if not isinstance(provenance.get('settings'), dict):
            raise ValueError('Describe sampling and confidence settings')
        if not tokenizer_revision or not decoder_revision:
            raise ValueError('Record exact tokenizer and decoder revisions')
        count = sum(p['kind'] == 'image' for p in positions)
        if image_grid is not None and (image_grid['rows'] <= 0 or image_grid['cols'] <= 0 or image_grid['rows'] * image_grid['cols'] != count):
            raise ValueError('Image grid does not match image positions')
        if image_shape is not None and not (0 < image_shape['width'] * image_shape['height'] <= 4_000_000 and min(image_shape.values()) > 0):
            raise ValueError('Invalid image dimensions')
        self.provenance = copy.deepcopy(provenance)
        self.data = dict(format='denoise-v2', positions=copy.deepcopy(positions), mask_id=mask_id,
            tokenizer_revision=tokenizer_revision, decoder_revision=decoder_revision,
            image_grid=image_grid, image_shape=image_shape, frames=[])

    def append(self, *, step, token_ids, tokens, confidence=None, decoded_text='', png=None):
        frames, n = self.data['frames'], len(self.data['positions'])
        if len(frames) >= 100 or type(step) is not int or step < 0 or (frames and step <= frames[-1]['step']):
            raise ValueError('At most 100 strictly increasing nonnegative steps')
        ids, labels = list(token_ids), list(tokens)
        conf = [None] * n if confidence is None else list(confidence)
        if any(len(a) != n for a in (ids, labels, conf)):
            raise ValueError('Snapshot position count changed')
        if any(type(i) is not int or i < 0 for i in ids) or any(not isinstance(s, str) or not s.strip() or len(s) > 20000 for s in labels):
            raise ValueError('Invalid token IDs or display strings')
        masked = [i == self.data['mask_id'] for i in ids]
        if any(v is not None and (type(v) not in (int, float) or not 0 <= v <= 1) for v in conf):
            raise ValueError('Confidence must be probability or None')
        if any(masked[i] and conf[i] is not None for i in range(n)):
            raise ValueError('Masked positions must have null confidence')
        for i, p in enumerate(self.data['positions']):
            if p['condition'] and (masked[i] or frames and (ids[i] != frames[0]['token_ids'][i] or labels[i] != frames[0]['tokens'][i])):
                raise ValueError('Condition positions must remain fixed')
        if not isinstance(decoded_text, str) or len(decoded_text) > 20000:
            raise ValueError('Decoded text exceeds viewer limit')
        encoded = None
        if png is not None:
            if not png.startswith(b'\x89PNG\r\n\x1a\n') or len(png) < 24:
                raise ValueError('Provide actual encoded PNG bytes')
            shape = self.data['image_shape']
            if not shape or (int.from_bytes(png[16:20], 'big'), int.from_bytes(png[20:24], 'big')) != (shape['width'], shape['height']):
                raise ValueError('PNG dimensions differ from declared shape')
            encoded = 'data:image/png;base64,' + base64.b64encode(png).decode('ascii')
            if len(encoded) > 6_000_000:
                raise ValueError('Image exceeds viewer limit')
        frames.append(dict(step=step, token_ids=ids, tokens=labels, masked=masked,
            confidence=conf, decoded_text=decoded_text, decoded_image=encoded))

    def save(self, path):
        if not self.data['frames']:
            raise ValueError('No actual snapshots recorded')
        raw = json.dumps(dict(schema_version=1, paper_id='25', provenance=self.provenance,
            data=self.data), ensure_ascii=False, allow_nan=False).encode('utf-8')
        if len(raw) > 20 * 1024 * 1024:
            raise ValueError('Record exceeds 20 MiB; reduce snapshot frequency')
        with Path(path).open('xb') as stream:
            stream.write(raw)
