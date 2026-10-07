import { hasPermission, type Permission } from '@/lib/auth/permissions';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { Card } from '@/components/ui/card';

const SECTIONS: Array<{ href: string; label: string; description: string; permission: Permission }> = [
  { href: 'members', permission: 'members:manage', label: 'Miembros', description: 'Personas, roles y permisos del equipo.' },
  { href: 'integrations', permission: 'org:update', label: 'Integraciones', description: 'Cuentas vinculadas y funciones disponibles.' },
  { href: 'notifications', permission: 'org:update', label: 'Notificaciones', description: 'Estado de los avisos de tu operación.' },
  { href: 'security', permission: 'org:update', label: 'Seguridad', description: 'Controles de ejecución y conexiones.' },
  { href: 'privacy', permission: 'privacy:manage', label: 'Privacidad', description: 'Conservación de datos y solicitudes de privacidad.' },
  { href: 'audit', permission: 'audit:read', label: 'Auditoria', description: 'Historial de cambios importantes.' },
  { href: 'operations', permission: 'org:update', label: 'Operaciones', description: 'DLQ, trabajos pendientes y recuperación.' },
];

export default async function SettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);

  return (
    <Card title="Configuracion" subtitle={`${ctx.orgName} · tu rol: ${ctx.role}`}>
      <ul className="grid gap-3 md:grid-cols-2">
        {SECTIONS.filter(section => hasPermission(ctx.role, section.permission)).map((section) => (
          <li key={section.href}>
            <Link className="card block p-3 text-sm" href={`/${orgSlug}/settings/${section.href}`}>
              <span className="font-medium">{section.label}</span>
              <span className="muted block text-xs">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!hasPermission(ctx.role, 'org:update') && <p className="muted mt-5 text-sm">La configuración de este espacio está a cargo de sus administradores.</p>}
    </Card>
  );
}
