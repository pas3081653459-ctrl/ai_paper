# AI/ML Milestone Papers — Manifest

Downloaded: 2026-09-22 (Asia/Shanghai). Open-access sources only (arXiv, OpenAI CDN, DeepMind media). No Sci-Hub / pirate mirrors.

| # | File | Title | Source | Status |
|---|------|-------|--------|--------|
| 01 | `pdfs/01_resnet.pdf` | Deep Residual Learning for Image Recognition | arXiv:1512.03385 | OK |
| 02 | `pdfs/02_alphago.pdf` | Mastering the game of Go with deep neural networks and tree search (Nature 2016) | DeepMind media: https://storage.googleapis.com/deepmind-media/alphago/AlphaGoNaturePaper.pdf | OK |
| 03 | `pdfs/03_alphazero.pdf` | Mastering Chess and Shogi by Self-Play with a General Reinforcement Learning Algorithm (AlphaZero) | arXiv:1712.01815 | OK |
| 04 | `pdfs/04_transformer.pdf` | Attention Is All You Need | arXiv:1706.03762 | OK |
| 05 | `pdfs/05_gpt-1.pdf` | Improving Language Understanding by Generative Pre-Training (GPT-1) | OpenAI CDN | OK |
| 06 | `pdfs/06_bert.pdf` | BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding | arXiv:1810.04805 | OK |
| 07 | `pdfs/07_gpt-2.pdf` | Language Models are Unsupervised Multitask Learners (GPT-2) | OpenAI CDN | OK |
| 08 | `pdfs/08_gpt-3.pdf` | Language Models are Few-Shot Learners (GPT-3) | arXiv:2005.14165 | OK |
| 09 | `pdfs/09_scaling-laws-kaplan.pdf` | Scaling Laws for Neural Language Models | arXiv:2001.08361 | OK |
| 10 | `pdfs/10_vit.pdf` | An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale (ViT) | arXiv:2010.11929 | OK |
| 11 | `pdfs/11_ddpm.pdf` | Denoising Diffusion Probabilistic Models | arXiv:2006.11239 | OK |
| 12 | `pdfs/12_clip.pdf` | Learning Transferable Visual Models From Natural Language Supervision (CLIP) | arXiv:2103.00020 | OK |
| 13 | `pdfs/13_instructgpt.pdf` | Training language models to follow instructions with human feedback (InstructGPT) | arXiv:2203.02155 | OK |
| 14 | `pdfs/14_chain-of-thought.pdf` | Chain-of-Thought Prompting Elicits Reasoning in Large Language Models | arXiv:2201.11903 | OK |
| 15 | `pdfs/15_chinchilla.pdf` | Training Compute-Optimal Large Language Models (Chinchilla) | arXiv:2203.15556 | OK |
| 16 | `pdfs/16_latent-diffusion.pdf` | High-Resolution Image Synthesis with Latent Diffusion Models | arXiv:2112.10752 | OK |
| 17 | `pdfs/17_llama.pdf` | LLaMA: Open and Efficient Foundation Language Models | arXiv:2302.13971 | OK |
| 18 | `pdfs/18_gpt-4-technical-report.pdf` | GPT-4 Technical Report | arXiv:2303.08774 | OK |
| 19 | `pdfs/19_llava.pdf` | Visual Instruction Tuning (LLaVA) | arXiv:2304.08485 | OK |
| 20 | `pdfs/20_segment-anything.pdf` | Segment Anything | arXiv:2304.02643 | OK |
| 21 | `pdfs/21_react.pdf` | ReAct: Synergizing Reasoning and Acting in Language Models | arXiv:2210.03629 | OK |
| 22 | `pdfs/22_toolformer.pdf` | Toolformer: Language Models Can Teach Themselves to Use Tools | arXiv:2302.04761 | OK |
| 23 | `pdfs/23_mixtral-of-experts.pdf` | Mixtral of Experts | arXiv:2401.04088 | OK |
| 24 | `pdfs/24_deepseek-r1.pdf` | DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning | arXiv:2501.12948 | OK |
| 25 | `pdfs/25_mmada.pdf` | MMaDA: Multimodal Large Diffusion Language Models | arXiv:2505.15809 | OK |
| 26 | `pdfs/26_lavida.pdf` | LaViDa: A Large Diffusion Language Model for Multimodal Understanding | arXiv:2505.16839 | OK |

## Optional

| # | Item | Status |
|---|------|--------|
| 27 | AlphaGo Nature open PDF | SKIPPED (duplicate of 02; same DeepMind-hosted Nature PDF) |
| 28 | OpenAI o1 technical blog PDF | SKIPPED (no freely available standalone technical PDF located; not required as FAILED) |

## Failures (required set)

None. All 26 required papers downloaded and verified as real PDFs (`%PDF` magic).

### Notes on AlphaGo (02)
- Nature URL `https://www.nature.com/articles/nature16961.pdf` returned HTML paywall/landing page (not a PDF).
- Official DeepMind-hosted open PDF succeeded: `https://storage.googleapis.com/deepmind-media/alphago/AlphaGoNaturePaper.pdf`
- AlphaGo Zero preprint is also open on arXiv:1712.01804 (not packaged separately; AlphaZero 1712.01815 is included as 03).

## Verification
Each file checked for `%PDF` magic bytes; non-PDF responses deleted.
