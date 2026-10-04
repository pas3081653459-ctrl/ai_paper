import { papers } from './catalog'
import type { Settings } from './types'
export interface LessonProgress { step: number; settings: Settings; complete: boolean }
interface Progress { last?: string; lessons: Record<string,LessonProgress> }
const key='channel-lab-papers-v1'
const valid=(id:string)=>papers.some(p=>p.id===id)
export function readProgress():Progress {
 try {
  const raw=JSON.parse(localStorage.getItem(key)??'{}')
  const lessons:Progress['lessons']={}
  for(const paper of papers) {
   const record=raw?.lessons?.[paper.id]
   if(!record||typeof record!=='object')continue
   const settings:Settings={}
   if(record.settings&&typeof record.settings==='object')for(const [k,v] of Object.entries(record.settings)) {
    if(/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)&&typeof v==='number'&&Number.isFinite(v))settings[k]=v
   }
   lessons[paper.id]={step:Number.isInteger(record.step)?Math.max(0,record.step):0,settings,complete:record.complete===true}
  }
  return {last:typeof raw?.last==='string'&&valid(raw.last)?raw.last:undefined,lessons}
 } catch {return {lessons:{}}}
}
// 只保存用户学习设置，不保存图片或任何模型参数。
export function saveProgress(id:string,lesson:LessonProgress):boolean {
 if(!valid(id))return false
 try {const progress=readProgress();progress.last=id;progress.lessons[id]=lesson;localStorage.setItem(key,JSON.stringify(progress));return true} catch {return false}
}
