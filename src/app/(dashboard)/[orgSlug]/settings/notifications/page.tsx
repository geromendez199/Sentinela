import Link from 'next/link';
import { requirePermission } from '@/lib/auth/require-role';
import { Card } from '@/components/ui/card';
export default async function NotificationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
 const {orgSlug}=await params;await requirePermission(orgSlug,'org:update');
 const configured=process.env.NOTIFICATIONS_PROVIDER==='resend' && !!process.env.NOTIFICATIONS_API_KEY && !!process.env.NOTIFICATIONS_FROM_EMAIL;
 return <div className="grid gap-6 md:grid-cols-2"><Card title="Alertas dentro de sentinela" subtitle="El centro de alertas reúne las novedades registradas de tu operación."><p className="muted text-sm leading-relaxed">Las órdenes con riesgo alto o crítico generan una alerta deduplicada. Podés revisar su severidad y marcarla como vista.</p><Link href={`/${orgSlug}/alerts`} className="mt-5 inline-block rounded-lg bg-black px-4 py-2 text-sm text-white">Abrir alertas</Link></Card><Card title="Avisos por email" subtitle={configured?'Resend y remitente verificado configurados':'Todavía no configurados'}><p className="muted text-sm leading-relaxed">{configured?'Sentinela puede entregar por email las alertas que tengan un destinatario habilitado. Cada envío usa una clave idempotente y los fallos terminan en la cola de revisión.':'El envío requiere Resend, su API key y un remitente verificado. Las alertas dentro de Sentinela funcionan aunque este canal esté desactivado.'}</p></Card></div>;
}
