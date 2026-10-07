import Link from 'next/link';
import { requirePermission } from '@/lib/auth/require-role';
import { Card } from '@/components/ui/card';
export default async function NotificationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
 const {orgSlug}=await params;await requirePermission(orgSlug,'org:update');
 const configured=!!process.env.NOTIFICATIONS_API_KEY && !!process.env.NOTIFICATIONS_PROVIDER && process.env.NOTIFICATIONS_PROVIDER!=='none';
 return <div className="grid gap-6 md:grid-cols-2"><Card title="Alertas dentro de sentinela" subtitle="El centro de alertas reúne las novedades registradas de tu operación."><p className="muted text-sm leading-relaxed">Podés revisar su severidad y marcarlas como vistas. Su generación depende de la sincronización y del análisis de tus datos.</p><Link href={`/${orgSlug}/alerts`} className="mt-5 inline-block rounded-lg bg-black px-4 py-2 text-sm text-white">Abrir alertas</Link></Card><Card title="Avisos por email" subtitle={configured?'Proveedor configurado · entrega pendiente de validar':'Todavía no configurados'}><p className="muted text-sm leading-relaxed">{configured?'La presencia de credenciales no confirma la entrega. Falta verificar el remitente, los destinatarios y una prueba de envío antes de usar este canal.':'El envío por email requiere configurar un proveedor y verificar el remitente. Por ahora, consultá las alertas desde la app.'}</p></Card></div>;
}
