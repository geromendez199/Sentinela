import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { Card } from '@/components/ui/card';

const SECTIONS = [
  { href: 'members', label: 'Miembros', description: 'Roles owner/admin/operator/viewer.' },
  { href: 'integrations', label: 'Integraciones', description: 'Cuentas MercadoLibre y capabilities.' },
  { href: 'notifications', label: 'Notificaciones', description: 'Proveedor saliente y throttling.' },
  { href: 'security', label: 'Seguridad', description: 'Kill switches y estado de credenciales.' },
  { href: 'privacy', label: 'Privacidad', description: 'Retencion, legal hold y solicitudes.' },
  { href: 'audit', label: 'Auditoria', description: 'Registro de acciones sensibles.' },
];

export default async function SettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);

  return (
    <Card title="Configuracion" subtitle={`${ctx.orgName} · tu rol: ${ctx.role}`}>
      <ul className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link className="card block p-3 text-sm" href={`/${orgSlug}/settings/${section.href}`}>
              <span className="font-medium">{section.label}</span>
              <span className="muted block text-xs">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
