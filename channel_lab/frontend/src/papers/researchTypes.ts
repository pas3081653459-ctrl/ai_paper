export interface Evidence {
 title: string
 question: string
 setup: string
 control: string
 change: string
 metrics: { name: string; unit: string; better: 'up'|'down'|'neutral' }[]
 rows: { name: string; values: number[] }[]
 finding: string
 boundary: string
 source: { pages: number[]; label: string }
}
export interface Research {
 problem: string
 previous: { name: string; approach: string; gap: string }[]
 insight: string
 method: { title: string; detail: string }[]
 experiments: Evidence[]
 conclusion: string
 openQuestion: string
}
