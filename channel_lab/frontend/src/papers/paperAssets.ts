import {papers} from './catalog'
/** Vite copies public/papers into dist/papers; no Python API needed for PDFs. */
export function paperPdf(id:string,page?:number){
 const paper=papers.find(p=>p.id===id)
 if(!paper)throw new Error(`Unknown paper: ${id}`)
 const url=`${import.meta.env.BASE_URL}papers/${encodeURIComponent(paper.file)}`
 return page?`${url}#page=${page}&view=FitH`:url
}
