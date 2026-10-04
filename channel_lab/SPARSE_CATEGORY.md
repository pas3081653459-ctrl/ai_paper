# 稀疏路由与多模态生成 · 23 / 25

状态：源码实现、静态检查；未编译、未运行导出工具、未进行浏览器验收，dist 未更新。没有安装依赖、下载权重、训练或新增推理服务。

## 从哪里进入

`#/papers/23`：八个手动gate分数 → softmax → Top-2重新归一化；真实记录模式为两个语境、共同层、分别选token、路由分支和非PAD负载。不要给专家附会固定职业。输入和合并结果都为[1,D]；没有输出向量则不伪造结果。

`#/papers/25`：无模型位置顺序练习；真实记录模式提供播放/暂停、前后帧、固定参照、恢复/再遮蔽/改写统计、图像码网格、具体位置时间线及真实解码图片。参照可以晚于当前帧，页面会提示比较方向。图像码ID不是RGB像素。

两课都有理解问题、浏览器本地笔记和导出，以及原文证据入口。Mixtral Table 2 的质量比较不等于硬件测速；MMaDA Table 5 的训练阶段消融不等于采样帧。

## 前端依赖和部署

沿用已有 Vue/Vite/TypeScript，无新增npm包、3D库或后端端口。记录只在浏览器读取，不上传。Mixtral SHA256使用Web Crypto，需要HTTPS或localhost。修改源码不会改变现有dist；构建和发布待用户明确要求。

## Mixtral 可选真实导出

这是后续由用户主动执行的说明，本轮没有执行以下命令。建议单独Python3.11环境。安装与硬件匹配的PyTorch，再固定`transformers==4.55.4`、`safetensors`、`sentencepiece`。PyTorch CUDA版本按本机驱动选择，不提供跨平台统一wheel保证。

```bash
python -m venv .venv-mixtral
source .venv-mixtral/bin/activate
pip install torch transformers==4.55.4 safetensors sentencepiece
python channel_lab/recorders/export_mixtral.py --model /absolute/local/mixtral --output /absolute/new/routing-pack --device cuda
```

模型目录需有config、tokenizer及完整safetensors分片/index；脚本只使用本地文件，禁止远程代码，不自动下载。目标目录必须不存在。CPU使用float32，CUDA使用float16；不支持量化、offload或多卡。8x7B总参数约47B，仅FP16权重就约94GB十进制（另需激活和加载余量）；普通笔记本不适合此导出器。CPU FP32需要更多内存。缺少资源时直接使用手工数学练习，或从有资源的机器带回记录。

默认比较river bank与bank loan，也可指定`--text-a`/`--text-b`。每段最多256token，不截断；不生成回答。脚本对本地相关文件计算SHA256、在逐层MoE forward hook中读取router logits，用同一softmax/Top-k和dtype重算合并权重，最后写manifest。中途失败可能留下层文件，没有manifest的目录不是完整记录，应换新输出目录重新导出。

在网页一次选中manifest.json与全部层JSON。最多257文件、总64MiB、清单1MiB、单层4MiB；只按需解析共同观察层，缓存最多4层。清单哈希可检测意外文件混用，不证明提供者可信。

实现依据：[Transformers v4.55.4 Mixtral源码](https://github.com/huggingface/transformers/blob/v4.55.4/src/transformers/models/mixtral/modeling_mixtral.py)。换版本需重新核对hook输出和权重归一化，不能直接忽略版本检查。导出脚本尚未运行验证。

## MMaDA 真实采样接入

网页回放不需要安装MMaDA。`recorders/denoise_recorder.py`只依赖Python标准库。真实生成需另外按[MMaDA官方仓库](https://github.com/Gen-Verse/MMaDA)的固定commit和依赖安装模型、tokenizer、图像解码器；把commit、权重版本和采样设置写入provenance。本项目未安装该环境，未实现通用MMaDA推理服务。

在你实际使用的采样器完成一次token状态更新后调用`DenoiseRecorder.append`。具体挂点随官方版本而变，本项目没有宣称提供已验证的drop-in补丁。调用者必须提供实际token IDs/显示字符串、实际掩码ID、固定条件位置；不是把模拟帧包装成真实记录。

```python
from channel_lab.recorders.denoise_recorder import DenoiseRecorder
# 以下变量来自你已配置的实际采样程序，不是可独立运行的示例。
recorder = DenoiseRecorder(
    provenance=actual_provenance, positions=actual_positions,
    mask_id=actual_mask_id, tokenizer_revision=tokenizer_commit,
    decoder_revision=decoder_commit, image_grid=actual_code_grid,
    image_shape=actual_decoded_image_shape)
# 每个选定的实际采样步骤更新完毕后：
recorder.append(step=actual_step, token_ids=actual_ids,
    tokens=actual_display_tokens, confidence=actual_confidences_or_none,
    decoded_text=actual_decoded_text, png=actual_decoded_png_or_none)
recorder.save('/absolute/new/mmada-trace.json')
```

`provenance`必填字符串source/model/revision/created_at/recorder及对象settings。settings应描述seed、温度、采样轮数、重新遮蔽策略、置信度定义、记录间隔。不得记录或冒充不可获得的隐藏推理；decoded_text仅使用实际公开输出。

positions每项为`{kind:'text'|'image',condition:bool}`；image_grid为rows/cols或null，image_shape为width/height或null。逐帧顺序必须和positions一致。置信度未提供为null，MASK位置必须null；固定条件不可改写或遮蔽。最多512位置、100帧、总20MiB；图片只接受实际PNG，单图base64≤600万字符、≤400万像素。可降低记录频率、缩短实验，但不能剪掉条件而不重新定义位置映射。图像网格仅适用于明确行列布局的图像token。

前端还兼容旧版单文件记录；旧格式不提供新版token-ID/置信度等保证，不能视作已转换的新记录。
