import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { OrgNav } from '@/components/layout/org-nav';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href={`/${ctx.orgSlug}/overview`} className="text-sm font-semibold">
          Sentinela ML · {ctx.orgName}
        </Link>
        <span className="muted text-xs">rol: {ctx.role}</span>
      </header>
      <OrgNav orgSlug={ctx.orgSlug} />
      <main className="px-4 py-6">{children}</main>
    </div>
  );
}
