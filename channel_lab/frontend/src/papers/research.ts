import type { Research } from './researchTypes'
import { visionResearch } from './researchVision'
import { languageResearch } from './researchLanguage'
import { learningResearch } from './researchLearning'
import { methodResearch } from './researchMethods'
export const research:Record<string,Research>={...visionResearch,...languageResearch,...learningResearch,...methodResearch}
