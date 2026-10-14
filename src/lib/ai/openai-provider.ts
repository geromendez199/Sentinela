import 'server-only';
import type { AiProvider, CompletionRequest } from './provider';
import { RetryableError } from '@/lib/meli/errors';

export class OpenAiProvider implements AiProvider {
  readonly name='openai';
  constructor(private readonly apiKey:string,readonly classifierModel:string,readonly embeddingModel:string,readonly embeddingDimensions:number) {}
  private async call(path:string,body:Record<string,unknown>) {
    const response=await fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.apiKey},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
    if(response.status===429||response.status>=500)throw new RetryableError('ai_provider_unavailable');
    if(!response.ok)throw new Error('ai_provider_error:'+response.status);
    return response.json();
  }
  async complete(request:CompletionRequest):Promise<string> {
    const payload=await this.call('chat/completions',{model:this.classifierModel,store:false,max_completion_tokens:request.maxTokens??512,messages:[{role:'system',content:request.system},{role:'user',content:request.input}]}) as {choices?:Array<{message?:{content?:string|null}}>};
    const text=payload.choices?.[0]?.message?.content;
    if(typeof text!=='string'||!text.trim())throw new Error('ai_response_missing');
    return text;
  }
  async embed(texts:string[]):Promise<number[][]> {
    if(!texts.length)return [];
    if(texts.length>32||texts.some(text=>!text.trim()||text.length>4000))throw new Error('embedding_input_invalid');
    if(this.embeddingDimensions!==1536)throw new Error('embedding_dimensions_not_supported');
    const payload=await this.call('embeddings',{model:this.embeddingModel,input:texts,dimensions:this.embeddingDimensions,encoding_format:'float'}) as {data?:Array<{index:number;embedding:number[]}>};
    const data=payload.data;
    if(!Array.isArray(data)||data.length!==texts.length)throw new Error('embedding_response_invalid');
    const ordered=[...data].sort((a,b)=>a.index-b.index);
    if(ordered.some((row,index)=>row.index!==index||!Array.isArray(row.embedding)||row.embedding.length!==1536||row.embedding.some(value=>!Number.isFinite(value))))throw new Error('embedding_response_invalid');
    return ordered.map(row=>row.embedding);
  }
}
