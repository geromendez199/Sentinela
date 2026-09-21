import type { OrgRole } from '@/lib/supabase/database.types';

/**
 * Permission matrix, section 5.1. `owner` is a strict superset of `admin`, which
 * is a strict superset of `operator`, which is a strict superset of `viewer`.
 */
export const PERMISSIONS = {
  'org:read': ['owner', 'admin', 'operator', 'viewer'],
  'org:update': ['owner', 'admin'],
  'members:manage': ['owner', 'admin'],
  'members:manage_owner': ['owner'],
  'billing:manage': ['owner'],
  'accounts:connect': ['owner', 'admin'],
  'accounts:disconnect': ['owner', 'admin'],
  'playbooks:manage': ['owner', 'admin'],
  'actions:approve': ['owner', 'admin', 'operator'],
  'actions:execute': ['owner', 'admin', 'operator'],
  'alerts:ack': ['owner', 'admin', 'operator'],
  'privacy:manage': ['owner', 'admin'],
  'audit:read': ['owner', 'admin'],
} as const satisfies Record<string, readonly OrgRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly OrgRole[]).includes(role);
}
