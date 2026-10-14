export interface ReadinessCheck { id:string; label:string; state:'ready'|'setup'|'disabled'|'verify'; detail:string }
export function integrationReadiness(env:Record<string,string|undefined>):ReadinessCheck[] {
  const has=(...keys:string[])=>keys.every(key=>Boolean(env[key]?.trim()));
  const ai=env.AI_PROVIDER??'none';
  return [
    {id:'auth',label:'Acceso y almacenamiento',state:has('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY')?'ready':'setup',detail:'Configuración del servidor web. Verificá también permisos y políticas en la base.'},
    {id:'meli',label:'Vinculación de Mercado Libre',state:has('MELI_APP_ID','MELI_CLIENT_SECRET','MELI_REDIRECT_URI')?'ready':'setup',detail:'Requiere la misma URL de retorno en el servidor y en la aplicación de Mercado Libre.'},
    {id:'ai',label:'Asistencia de IA en web',state:ai==='none'?'disabled':has('AI_API_KEY')&&(ai==='anthropic'||ai==='openai'&&has('AI_CLASSIFIER_MODEL'))?'ready':'setup',detail:ai==='none'?'Podés usar el diagnóstico orientativo y las plantillas sin IA.':'La clasificación en Edge Functions se verifica por separado; este chequeo no prueba al proveedor ni al modelo.'},
    {id:'email',label:'Alertas por email',state:env.NOTIFICATIONS_PROVIDER==='resend'&&has('NOTIFICATIONS_API_KEY','NOTIFICATIONS_FROM_EMAIL')?'ready':'setup',detail:'Requiere remitente verificado y secretos configurados también en el worker. Las alertas del panel son independientes.'},
    {id:'writes',label:'Acciones externas aprobadas',state:env.MELI_WRITES_ENABLED==='true'?'verify':'disabled',detail:'Cada contrato de escritura debe verificarse antes de habilitarlo. Los borradores pueden revisarse con envíos desactivados.'},
  ];
}
