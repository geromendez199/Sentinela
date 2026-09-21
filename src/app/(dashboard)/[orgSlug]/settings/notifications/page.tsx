import { requirePermission } from '@/lib/auth/require-role';
import { Card } from '@/components/ui/card';

export default async function NotificationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePermission(orgSlug, 'org:update');

  return (
    <Card
      title="Notificaciones"
      subtitle="Un unico proveedor saliente, abstraido por interfaz y con secretos server-side."
    >
      <ul className="space-y-2 text-sm">
        <li>Las alertas salen del worker send-alert con throttling y dedupe.</li>
        <li>El payload saliente es minimo: nunca lleva PII del comprador ni tokens.</li>
        <li>Severidades: info, warning, high, critical. Solo high/critical despiertan guardia.</li>
      </ul>
    </Card>
  );
}
