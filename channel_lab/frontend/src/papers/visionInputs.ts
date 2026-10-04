export interface LabPhoto { url:string; width:number; height:number; source:string }
export interface PromptPoint { x:number; y:number; label:'positive'|'negative' }
export type PromptBox = [number,number,number,number]
export const base64Payload=(url:string)=>url.slice(url.indexOf(',')+1)
export async function imageElement(url:string){const img=new Image();img.src=url;await img.decode();return img}
export async function occludePhoto(photo:LabPhoto,box:PromptBox|null){
  const img=await imageElement(photo.url),canvas=document.createElement('canvas');canvas.width=photo.width;canvas.height=photo.height
  const context=canvas.getContext('2d')!;context.drawImage(img,0,0)
  if(box){context.fillStyle='rgb(127,127,127)';context.fillRect(box[0],box[1],box[2]-box[0],box[3]-box[1])}
  return canvas.toDataURL('image/png')
}
