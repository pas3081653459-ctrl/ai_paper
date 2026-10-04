/**
 * Manual visual reading, NOT author-released raw measurements.
 * Kaplan et al., arXiv:2001.08361, Figure 6 RIGHT (non-embedding N),
 * orange 6-layer curve. Read from the rendered original figure on 2026-09-29:
 * https://ar5iv.labs.arxiv.org/html/2001.08361#S3.F6
 * Coordinates are deliberately rounded; overlapping points and log axes limit precision.
 * No calibrated digitization error or confidence interval is available.
 * Last two points are withheld by this lesson, not by the original paper.
 */
export const scalingFixture = {
  axis: '非 embedding 参数 N（个）',
  controls: 'Figure 6 右图的 6 层曲线；WebText2，训练到接近收敛；不同规模并非仅改变一个张量尺寸。',
  points: [
    { x: 1.6e6, loss: 3.80, held_out: false },
    { x: 6.5e6, loss: 3.40, held_out: false },
    { x: 2.7e7, loss: 3.10, held_out: false },
    { x: 1.4e8, loss: 2.75, held_out: false },
    { x: 2.8e8, loss: 2.62, held_out: true },
    { x: 1.4e9, loss: 2.41, held_out: true },
  ],
}
export const scalingSource = {
  kind: 'manual-figure-reading',
  paper: 'Kaplan et al. 2020, arXiv:2001.08361',
  location: 'Figure 6 right, 6-layer orange curve, PDF page 8',
  url: 'https://arxiv.org/pdf/2001.08361#page=8',
  precision: '近似读图；没有经校准的误差界，不可作为原始测量数据或论文指数复现。',
}
