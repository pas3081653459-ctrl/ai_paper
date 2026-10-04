import type { Experiment, Settings } from './types'
import { vision } from './vision'
import { language } from './language'
import { science } from './science'
import { learning } from './learning'
import { multimodal } from './multimodal'
import { toolsLesson } from './tools'
export function experiment(id:string, settings:Settings):Experiment {
 if(['01','10'].includes(id))return vision(id,settings)
 if(['04','05','06','07','08','17'].includes(id))return language(id,settings)
 if(['09','11','15','25'].includes(id))return science(id,settings)
 if(['02','03','13','24'].includes(id))return learning(id,settings)
 if(['12','18','19','20','23'].includes(id))return multimodal(id,settings)
 if(['14','21','22'].includes(id))return toolsLesson(id,settings)
 throw new Error('尚未注册的论文实验')
}
