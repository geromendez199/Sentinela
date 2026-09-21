import 'server-only';
import { notFound } from 'next/navigation';
import { getOrgContext, type OrgContext } from './org-context';
import { hasPermission, type Permission } from './permissions';

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`forbidden:${permission}`);
    this.name = 'ForbiddenError';
  }
}

/** Server-component guard: 404 rather than leaking the existence of an org. */
export async function requireOrg(orgSlug: string): Promise<OrgContext> {
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) notFound();
  return ctx;
}

export async function requirePermission(orgSlug: string, permission: Permission): Promise<OrgContext> {
  const ctx = await requireOrg(orgSlug);
  if (!hasPermission(ctx.role, permission)) throw new ForbiddenError(permission);
  return ctx;
}

/** Route-handler guard: returns a context or a typed failure, never throws a render. */
export async function checkPermission(
  orgSlug: string,
  permission: Permission,
): Promise<{ ok: true; ctx: OrgContext } | { ok: false; status: 403 | 404 }> {
  const ctx = await getOrgContext(orgSlug);
  if (!ctx) return { ok: false, status: 404 };
  if (!hasPermission(ctx.role, permission)) return { ok: false, status: 403 };
  return { ok: true, ctx };
}
