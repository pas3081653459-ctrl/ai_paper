import base64
import io
import numpy as np
import torch
from PIL import Image
from fastapi.testclient import TestClient
from channel_lab.backend.models import paired_models
from channel_lab.backend.app import app
from channel_lab.backend.data import split_records


def image_bytes():
    buffer = io.BytesIO()
    Image.fromarray(np.random.default_rng(42).integers(0, 255, (100, 130, 3), dtype=np.uint8)).save(buffer, format='PNG')
    return buffer.getvalue()


def test_shared_initialization_and_real_residual_trace():
    models = paired_models()
    for name, parameter in models['cnn'].state_dict().items():
        torch.testing.assert_close(parameter, models['resnet'].state_dict()[name])
    inputs = torch.rand(2, 3, 64, 64)
    for name, model in models.items():
        model.eval()
        with torch.no_grad():
            expected = model(inputs)
            actual, trace = model(inputs, trace=True)
        torch.testing.assert_close(expected, actual)
        for index, (channels, size) in enumerate([(8,64),(16,32),(32,16)], 1):
            prefix = f'block{index}.'
            assert trace[prefix+'output'].shape == (2, channels, size, size)
            if name == 'resnet':
                torch.testing.assert_close(trace[prefix+'sum'], trace[prefix+'main']+trace[prefix+'shortcut'])
                torch.testing.assert_close(trace[prefix+'output'], trace[prefix+'sum'].relu())
            else:
                assert prefix+'sum' not in trace
                torch.testing.assert_close(trace[prefix+'output'], trace[prefix+'main'].relu())
    models['resnet'].train()
    torch.nn.functional.cross_entropy(models['resnet'](inputs), torch.tensor([0, 1])).backward()
    assert models['resnet'].blocks[1].shortcut[0].weight.grad.abs().sum() > 0


def test_api_upload_and_binary_feature_values():
    with TestClient(app) as client:
        response = client.post('/api/analyze?mode=random', files={'file': ('pet.png', image_bytes(), 'image/png')})
        assert response.status_code == 200
        result = response.json()
        assert result['mode'] == 'random'
        assert result['original_size'] == [130, 100]
        assert result['input_shape'] == [1,3,64,64]
        for model in result['models'].values():
            assert abs(sum(model['probabilities'])-1)<1e-6
            for feature in model['features'].values():
                values = np.frombuffer(base64.b64decode(feature['data']), dtype='<f4')
                assert values.size == np.prod(feature['shape'])
                assert np.isfinite(values).all()
                assert float(values.min()) == feature['min']
        trace=result['models']['resnet']['features']
        decode=lambda key: np.frombuffer(base64.b64decode(trace[key]['data']), dtype='<f4')
        np.testing.assert_allclose(decode('block2.sum'), decode('block2.main')+decode('block2.shortcut'))


def test_api_rejects_invalid_files_modes_and_sample_paths():
    with TestClient(app) as client:
        assert client.post('/api/analyze?mode=random', files={'file': ('bad.png', b'not image', 'image/png')}).status_code==400
        assert client.post('/api/analyze?mode=unknown', files={'file': ('pet.png', image_bytes(), 'image/png')}).status_code==400
        assert client.post('/api/analyze?mode=random', files={'file': ('big.png', b'x'*(10*1024*1024+1), 'image/png')}).status_code==413
        assert client.get('/api/samples/not-a-valid-sample').status_code==404
        assert client.post('/api/analyze?mode=random').status_code==422


def test_official_test_is_disjoint_and_splits_reproducible():
    train, val, test = split_records()
    assert (train,val,test)==split_records()
    sets=[{name for name,_ in records} for records in [train,val,test]]
    assert not sets[0]&sets[1] and not sets[0]&sets[2] and not sets[1]&sets[2]
    assert len(train)+len(val)==3680
    assert len(test)==3669
    for records in [train,val,test]:
        assert {label for _,label in records}=={0,1}
