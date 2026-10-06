import { requireOrg } from '@/lib/auth/require-role';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  return <DashboardShell orgSlug={ctx.orgSlug} orgName={ctx.orgName} role={ctx.role}>{children}</DashboardShell>;
}
