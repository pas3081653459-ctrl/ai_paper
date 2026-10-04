import type { Component } from 'vue'
import Go from './GoSearchReplay.vue'
import goSource from './GoSearchReplay.vue?raw'
import SelfPlay from './SelfPlayArchive.vue'
import selfPlaySource from './SelfPlayArchive.vue?raw'
import Transfer from './TransferExperiment.vue'
import transferSource from './TransferExperiment.vue?raw'
import BERT from './BERTContextExperiment.vue'
import bertSource from './BERTContextExperiment.vue?raw'
import GPT2 from './GPT2Continuation.vue'
import gpt2Source from './GPT2Continuation.vue?raw'
import Context from './InContextExperiment.vue'
import contextSource from './InContextExperiment.vue?raw'
import Scaling from './ScalingEvidenceLab.vue'
import scalingSource from './ScalingEvidenceLab.vue?raw'
import ViT from './ViTPatchExperiment.vue'
import vitSource from './ViTPatchExperiment.vue?raw'
import DDPM from './DDPMExperiment.vue'
import ddpmSource from './DDPMExperiment.vue?raw'
import CLIP from './CLIPExperiment.vue'
import clipSource from './CLIPExperiment.vue?raw'
import Preference from './PreferenceReview.vue'
import preferenceSource from './PreferenceReview.vue?raw'
import Solution from './SolutionAudit.vue'
import solutionSource from './SolutionAudit.vue?raw'
import Compute from './ComputeBudgetLab.vue'
import computeSource from './ComputeBudgetLab.vue?raw'
import Tradeoff from './ModelTradeoffLab.vue'
import tradeoffSource from './ModelTradeoffLab.vue?raw'
import Report from './ReportEvidenceDesk.vue'
import reportSource from './ReportEvidenceDesk.vue?raw'
import LLaVA from './LLaVAExperiment.vue'
import llavaSource from './LLaVAExperiment.vue?raw'
import SAM from './SAMExperiment.vue'
import samSource from './SAMExperiment.vue?raw'
import ReAct from './ReActExperiment.vue'
import reactSource from './ReActExperiment.vue?raw'
import Tool from './ToolSampleWorkshop.vue'
import toolSource from './ToolSampleWorkshop.vue?raw'
import Expert from './ExpertRoutingReplay.vue'
import expertSource from './ExpertRoutingReplay.vue?raw'
import Group from './ReasoningGroupLab.vue'
import groupSource from './ReasoningGroupLab.vue?raw'
import Denoise from './MultimodalDenoiseReplay.vue'
import denoiseSource from './MultimodalDenoiseReplay.vue?raw'
export const scenes:Record<string,{component:Component;source:string;file:string}>={}
const rows:[string,Component,string,string][]=[
 ['02',Go,goSource,'GoSearchReplay.vue'],['03',SelfPlay,selfPlaySource,'SelfPlayArchive.vue'],
 ['05',Transfer,transferSource,'TransferExperiment.vue'],['06',BERT,bertSource,'BERTContextExperiment.vue'],
 ['07',GPT2,gpt2Source,'GPT2Continuation.vue'],['08',Context,contextSource,'InContextExperiment.vue'],
 ['09',Scaling,scalingSource,'ScalingEvidenceLab.vue'],['10',ViT,vitSource,'ViTPatchExperiment.vue'],
 ['11',DDPM,ddpmSource,'DDPMExperiment.vue'],['12',CLIP,clipSource,'CLIPExperiment.vue'],
 ['13',Preference,preferenceSource,'PreferenceReview.vue'],['14',Solution,solutionSource,'SolutionAudit.vue'],
 ['15',Compute,computeSource,'ComputeBudgetLab.vue'],['17',Tradeoff,tradeoffSource,'ModelTradeoffLab.vue'],
 ['18',Report,reportSource,'ReportEvidenceDesk.vue'],['19',LLaVA,llavaSource,'LLaVAExperiment.vue'],
 ['20',SAM,samSource,'SAMExperiment.vue'],['21',ReAct,reactSource,'ReActExperiment.vue'],
 ['22',Tool,toolSource,'ToolSampleWorkshop.vue'],['23',Expert,expertSource,'ExpertRoutingReplay.vue'],
 ['24',Group,groupSource,'ReasoningGroupLab.vue'],['25',Denoise,denoiseSource,'MultimodalDenoiseReplay.vue']
]
for(const [id,component,source,file] of rows)scenes[id]={component,source,file}
