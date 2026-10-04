export type Grid = number[][]
export interface Paper {
 id: string; name: string; year: number; group: string; title: string; file: string; folder: string;
 pages: number[]; section: string; question: string; principle: string; limitation: string;
 exercise: string; dependencies: string[]; quiz: { question: string; options: string[]; answer: number; explanation: string }
}
export interface Knob { key: string; title: string; min: number; max: number; step: number; initial: number; labels?: Record<number,string> }
export interface Stage {
 id: string; title: string; operation: string; shape: number[]; axes: string[]; slices: Grid[];
 description: string; formula: string; code: string; parents: string[]; rows?: string[]; planes?: string[];
 probability?: boolean; kind?: 'tensor'|'state'|'measurement'; note?: string
}
export interface Experiment {
 knobs: Knob[]; stages: Stage[]; metrics: {label:string;value:string}[]; observations: string[];
 image?: Grid; imageHint?: string; sourceCode: string
}
export type Settings = Record<string,number>
