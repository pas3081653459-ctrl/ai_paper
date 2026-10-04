"""Optional offline inference/scoring for lessons 14/22/24. No training endpoint."""
from typing import Literal
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, model_validator
from .language_api import configuration
from .clip_api import run_worker
router = APIRouter(prefix='/api/experiments/training', tags=['Training signal lessons'])

class ToolCandidate(BaseModel):
    prefix: str = Field(min_length=1,max_length=800)
    target: str = Field(min_length=1,max_length=200)
    a: int = Field(ge=-10000,le=10000,strict=True)
    b: int = Field(ge=-10000,le=10000,strict=True)
    op: Literal['+','-','*']

class ExperimentRequest(BaseModel):
    paper_id: Literal['14','22','24']
    task_ids: list[Literal['boxes','tickets','books']] = Field(default_factory=lambda:['boxes'],min_length=1,max_length=3)
    candidates: list[ToolCandidate] = Field(default_factory=list,max_length=3)
    max_new_tokens: int = Field(default=64,ge=8,le=128,strict=True)
    samples: int = Field(default=4,ge=2,le=8,strict=True)
    seed: int = Field(default=7,ge=0,le=1000000,strict=True)
    temperature: float = Field(default=0.8,ge=0.1,le=2,allow_inf_nan=False)

    @model_validator(mode='after')
    def check(self):
        if len(set(self.task_ids)) != len(self.task_ids):
            raise ValueError('题目不能重复')
        if self.paper_id=='22' and not self.candidates:
            raise ValueError('需要1–3个工具候选')
        if self.paper_id!='22' and self.candidates:
            raise ValueError('此课程不接收工具候选')
        if any(not c.prefix.strip() or not c.target.strip() for c in self.candidates):
            raise ValueError('上下文和目标不能只有空白')
        return self

@router.get('/config/{paper_id}')
def config(paper_id:Literal['14','22','24']):
    return configuration('07')

@router.post('/run')
async def run(payload:ExperimentRequest,request:Request):
    return await run_worker(payload.model_dump(),request,configuration('07'),'channel_lab.backend.training_worker')
