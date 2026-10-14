import { describe,it,expect } from 'vitest';
import { triageSupport,validateSupportDraft,responseTemplate } from '@/lib/support/triage';
import { calculateCx,diagnoseListing } from '@/lib/listings/health';
import { simulateMetric } from '@/lib/reputation/sandbox';
import { resolutionEconomics,buildPlanOfAction } from '@/lib/support/resolution';
import { integrationReadiness } from '@/lib/operations/readiness';
import { reputationImpactLabel } from '@/lib/ui/labels';

describe('V2 support',()=>{
  it('detects operational signals in accent-insensitive Spanish',()=>{const result=triageSupport('Llegó dañado y voy a abrir un reclamo');expect(result.cause?.id).toBe('damaged');expect(result.priority).toBe('urgent');});
  it('does not invent an intent from missing text',()=>expect(triageSupport(null)).toMatchObject({available:false,cause:null,priority:'routine'}));
  it.each(['Escribime a prueba@example.com','Contactame por WhatsApp','Entrá a https://example.com','Sos un idiota','Llamá al +54 11 1234 5678'])('flags unsafe response content: %s',text=>expect(validateSupportDraft(text,350).length).toBeGreaterThan(0));
  it('bounds empty and long drafts',()=>{expect(validateSupportDraft('',350)).toHaveLength(1);expect(validateSupportDraft('x'.repeat(351),350)).toHaveLength(1);});
  it('produces short neutral templates',()=>{for(const source of ['question','message','claim'] as const){const text=responseTemplate('No llegó','message');expect(validateSupportDraft(text,source==='question'?2000:350)).toEqual([]);expect(text).not.toMatch(/mañana|garantizado|ya.*reembols/);}});
});
describe('listing coverage and CX',()=>{
  it('marks unavailable attributes as unknown instead of completed',()=>expect(diagnoseListing({title:'Producto',status:'active',availableQuantity:null,raw:{}})).toMatchObject({status:'partial',unknown:['Fotos','Atributos'],findings:[]}));
  it('detects empty known fields and zero availability',()=>{const report=diagnoseListing({title:null,status:'active',availableQuantity:0,raw:{pictures:[],attributes:[{id:'VOLTAGE',value_name:null}]}});expect(report.findings).toHaveLength(4);expect(report.status).toBe('attention');});
  it('deduplicates claims per eligible sale and ignores foreign orders',()=>expect(calculateCx([1,1,2,3],[1,1,4,null])).toMatchObject({sales:3,affectedSales:1,rate:1/3,health:'insufficient'}));
  it('shows no rate for zero eligible sales',()=>expect(calculateCx([], [1])).toMatchObject({rate:null,health:'unknown'}));
});
describe('scenario mechanics',()=>{
  const metric={key:'claims',label:'Reclamos',value:1,denominator:100,threshold:.02,comparator:'lt' as const};
  it('distinguishes incidents on counted sales from new sales',()=>{expect(simulateMetric(metric,0,1,false)).toMatchObject({rate:.02,withinThreshold:false,healthySalesToRecover:1});expect(simulateMetric(metric,0,1,true)).toMatchObject({denominator:101,withinThreshold:true});});
  it('allows healthy sales to recover the margin',()=>expect(simulateMetric(metric,10,1,false)?.withinThreshold).toBe(true));
  it.each([NaN,Infinity,-1,1.5,100001])('rejects invalid scenario input %s',value=>expect(simulateMetric(metric,value,0,false)).toBeNull());
  it('does not compute without denominator or threshold',()=>{expect(simulateMetric({...metric,denominator:0},0,0,false)).toBeNull();expect(simulateMetric({...metric,threshold:0},0,0,false)).toBeNull();});
});
describe('resolution and readiness',()=>{
  it('keeps economic assumptions explicit',()=>expect(resolutionEconomics({refund:100,returnCost:20,replacementCost:60,atRiskMargin:1000,mediationProbability:.1})).toEqual({refundWithoutReturn:100,refundWithReturn:120,replacement:80,expectedCommercialLoss:100}));
  it('rejects impossible probabilities and negative costs',()=>expect(resolutionEconomics({refund:-1,returnCost:0,replacementCost:0,atRiskMargin:0,mediationProbability:2})).toBeNull());
  it('leaves missing evidence as a placeholder',()=>expect(buildPlanOfAction('','','','')).toContain('[Adjuntar únicamente evidencia existente]'));
  it('does not label absent integrations ready',()=>{const checks=integrationReadiness({});expect(checks.some(check=>check.state==='ready')).toBe(false);expect(checks.find(check=>check.id==='writes')?.state).toBe('disabled');});
  it('requires the configured OpenAI model',()=>expect(integrationReadiness({AI_PROVIDER:'openai',AI_API_KEY:'fake-test'}).find(check=>check.id==='ai')?.state).toBe('setup'));
  it.each([['affected','Sí'],['not_affected','No'],['not_applies','No aplica'],[null,'Sin confirmar']])('preserves claim impact %s', (input,expected)=>expect(reputationImpactLabel(input)).toBe(expected));
});
