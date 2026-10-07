import {describe,it,expect} from 'vitest';
import type {Profile,Task,TimeEntry} from '@vexa/domain/types';
import {memberMetrics} from './team-model';
const profile:Profile={id:'person',name:'Persona',role:'collaborator',area:'technical',weeklyHours:15,active:true};
const task=(id:string,status:Task['status'],assigneeId='person'):Task=>({id,title:id,status,assigneeId,projectId:null,sprintId:null,estimateHours:null,link:null});
const entry=(id:string,patch:Partial<TimeEntry>={}):TimeEntry=>({id,userId:'person',taskId:null,startedAt:'2026-10-06T12:00:00Z',endedAt:'2026-10-06T14:00:00Z',hours:2,paid:false,validated:false,validatedAt:null,createdAt:'2026-10-06T14:00:00Z',voidedAt:null,voidReason:null,...patch});
describe('team metrics',()=>{
 it('includes collaborators and computes completion from assigned tasks only',()=>{const result=memberMetrics(profile,[task('a','done'),task('b','review'),task('c','in_progress'),task('d','todo','other')],[]);expect(result.total).toBe(3);expect(result.done).toBe(1);expect(result.pending).toBe(2);expect(result.completion).toBe(33);expect(result.review).toBe(1);});
 it('excludes draft, running, voided, older and other-user hours',()=>{const result=memberMetrics(profile,[],[entry('valid',{validated:true}),entry('pending'),entry('draft',{draft:true}),entry('running',{endedAt:null}),entry('void',{voidedAt:'2026-10-06'}),entry('old',{startedAt:'2026-08-01T12:00:00Z'}),entry('other',{userId:'other'})],'2026-10-01');expect(result.hours).toBe(4);expect(result.validatedHours).toBe(2);});
 it('keeps empty members at zero without dividing by zero',()=>{expect(memberMetrics(profile,[],[])).toMatchObject({total:0,completion:0,hours:0,done:0});});
});
