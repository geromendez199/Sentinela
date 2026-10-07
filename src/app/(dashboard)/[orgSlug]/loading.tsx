import { Skeleton } from '@/components/ui/card';

export default function Loading() {
  return <div role="status" aria-label="Cargando información de la organización" className="space-y-6">
    <span className="sr-only">Cargando información de la organización…</span>
    <div className="flex justify-end"><Skeleton className="h-9 w-32" /></div>
    <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="card p-6"><Skeleton className="h-4 w-32" /><Skeleton className="mt-5 h-11 w-20" /><Skeleton className="mt-2 h-3 w-24" /></div>)}</div>
    <div className="card p-6"><Skeleton className="h-4 w-48" /><Skeleton className="mt-5 h-24 w-full" /></div>
    <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="card p-6"><Skeleton className="h-4 w-32" /><Skeleton className="mt-5 h-24 w-full" /></div>)}</div>
  </div>;
}
