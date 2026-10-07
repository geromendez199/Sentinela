export interface SyncJob { status: string; updated_at: string; progress: number | null }
export const JOB_LABELS: Record<string, string> = { queued: 'En espera', running: 'Procesando', paused: 'Pausada', done: 'Completada', failed: 'Con error', cancelled: 'Cancelada' };
export const RESOURCE_LABELS: Record<string, string> = { items: 'Publicaciones', orders: 'Órdenes', claims: 'Reclamos', messages: 'Mensajes', questions: 'Preguntas', shipments: 'Envíos' };
export function progressPercent(progress: number | null): number {
  return Number.isFinite(progress) ? Math.round(Math.max(0, Math.min(1, progress ?? 0)) * 100) : 0;
}
export function syncHealth(jobs: SyncJob[], now = Date.now()) {
  if (!jobs.length) return { label: 'Sin tareas registradas', message: 'Todavía no hay una carga registrada para esta cuenta.' };
  if (jobs.some(job => job.status === 'failed')) return { label: 'Necesita revisión', message: 'Hay tareas con error. Revisá su detalle antes de interpretar los indicadores.' };
  if (jobs.some(job => job.status === 'paused')) return { label: 'Carga pausada', message: 'Algunas tareas están pausadas. Los indicadores pueden estar incompletos.' };
  const running=jobs.filter(job => job.status === 'running');
  if (running.length) {
    const fresh=running.some(job => Number.isFinite(Date.parse(job.updated_at)) && now-Date.parse(job.updated_at) < 15*60*1000);
    return fresh ? {label:'Carga en curso', message:'Hay tareas procesando datos. Actualizá para consultar su avance.'} : {label:'Sin avance reciente', message:'No se registran avances de las tareas en ejecución en los últimos 15 minutos. Revisá el servicio de sincronización.'};
  }
  if (jobs.some(job => job.status === 'queued')) return { label: 'Esperando sincronización', message: 'Hay tareas pendientes que todavía no están en ejecución. Si la espera continúa, el administrador debe revisar el servicio de sincronización.' };
  if (jobs.every(job => job.status === 'done')) return { label: 'Carga completada', message: 'Las tareas mostradas terminaron. Consultá la fecha de actualización de cada indicador.' };
  return {label:'Carga detenida',message:'Las tareas fueron canceladas. Revisá el estado de la conexión.'};
}
