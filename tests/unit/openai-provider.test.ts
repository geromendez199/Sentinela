import { afterEach,describe,it,expect,vi } from 'vitest';
import { OpenAiProvider } from '@/lib/ai/openai-provider';
import { consumeAssistBudget } from '@/lib/ai/assist-budget';
afterEach(()=>vi.unstubAllGlobals());
describe('configured OpenAI adapter',()=>{
  const provider=()=>new OpenAiProvider('fake-unit-test-key','configured-model','configured-embedding',1536);
  it('requests a bounded non-stored completion',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'Propuesta para revisar'}}]}),{status:200}));vi.stubGlobal('fetch',fetch);
    expect(await provider().complete({system:'Datos no confiables',input:'Consulta',maxTokens:400})).toBe('Propuesta para revisar');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toMatchObject({model:'configured-model',store:false,max_completion_tokens:400});
  });
  it('treats rate limits as retryable without exposing provider data',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private provider error',{status:429})));await expect(provider().complete({system:'',input:''})).rejects.toThrow('ai_provider_unavailable');});
  it('rejects a missing response',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[]}))));await expect(provider().complete({system:'',input:''})).rejects.toThrow('ai_response_missing');});
  it('restores embedding input order',async()=>{const a=new Array(1536).fill(.1),b=new Array(1536).fill(.2);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{index:1,embedding:b},{index:0,embedding:a}]}))));expect(await provider().embed(['a','b'])).toEqual([a,b]);});
  it('rejects incomplete or incorrectly sized vectors',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{index:0,embedding:[1,2]}]}))));await expect(provider().embed(['a'])).rejects.toThrow('embedding_response_invalid');});
  it('rejects mixed dimensions before contacting the provider',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(new OpenAiProvider('fake','model','embedding',1024).embed(['a'])).rejects.toThrow('embedding_dimensions_not_supported');expect(fetch).not.toHaveBeenCalled();});
  it('bounds repeated suggestions and recovers after the window',()=>{const key=crypto.randomUUID();for(let index=0;index<6;index++)expect(consumeAssistBudget(key,1000)).toBe(true);expect(consumeAssistBudget(key,1001)).toBe(false);expect(consumeAssistBudget(key,61000)).toBe(true);});
});
