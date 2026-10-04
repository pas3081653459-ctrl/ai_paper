/** Small dependency-free validators. Imported records are claims, not verified provenance. */
export type Parser<T> = (value:unknown)=>T
export function text(v:unknown):string {if(typeof v!=='string'||!v.trim()||v.length>20000)throw Error('需要非空字符串（最多 20000 字符）');return v}
export function number(v:unknown):number {if(typeof v!=='number'||!Number.isFinite(v))throw Error('需要有限数值');return v}
export function positive(v:unknown):number {const n=number(v);if(n<=0)throw Error('需要正数');return n}
export function integer(v:unknown):number {const n=number(v);if(!Number.isInteger(n)||n<0)throw Error('需要非负整数');return n}
export function probability(v:unknown):number {const n=number(v);if(n<0||n>1)throw Error('概率需要在 [0,1]');return n}
export function bool(v:unknown):boolean {if(typeof v!=='boolean')throw Error('需要布尔值');return v}
export function object(v:unknown):Record<string,unknown> {if(!v||typeof v!=='object'||Array.isArray(v))throw Error('需要 JSON 对象');return v as Record<string,unknown>}
export function list<T>(parse:Parser<T>,min=1,max=1000):Parser<T[]> {return v=>{if(!Array.isArray(v)||v.length<min||v.length>max)throw Error(`数组长度需要 ${min}–${max}`);return v.map((x,i)=>{try{return parse(x)}catch(e){throw Error(`第 ${i} 项：${String(e)}`)}})}}
export function fields<S extends Record<string,Parser<unknown>>>(schema:S):Parser<{[K in keyof S]:ReturnType<S[K]>}> {return v=>{const o=object(v),out:Record<string,unknown>={};for(const [key,parse] of Object.entries(schema)){try{out[key]=parse(o[key])}catch(e){throw Error(`${key}: ${String(e)}`)}}return out as {[K in keyof S]:ReturnType<S[K]>}}}
export function choice<const T extends readonly string[]>(...values:T):Parser<T[number]> {return v=>{const s=text(v);if(!values.includes(s))throw Error(`需要 ${values.join(' / ')}`);return s as T[number]}}
export function string(v:unknown):string {if(typeof v!=='string'||v.length>20000)throw Error('需要字符串（最多 20000 字符）');return v}
export function image(v:unknown):string {if(typeof v!=='string'||v.length>6_000_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))throw Error('图片需要内嵌 PNG/JPEG/WebP data URL，最多 6 MB 字符');return v}
export function sameLength(...values:unknown[][]){if(values.some(v=>v.length!==values[0].length))throw Error('相关数组长度不一致')}
export const provenance=fields({source:text,model:text,revision:text,created_at:text,recorder:text,settings:object})
export function envelope(value:unknown,paper:string){const o=object(value);if(o.schema_version!==1||o.paper_id!==paper)throw Error(`需要 schema_version=1、paper_id="${paper}"`);return {provenance:provenance(o.provenance),data:o.data}}
