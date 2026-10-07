import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { OrgRole } from '@/lib/supabase/schema-types';

export interface OrgContext {
  userId: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
}

/**
 * Resolves the current user's membership in the organization addressed by the
 * route. Returns null when the user is not a member; RLS would hide the rows
 * anyway, this just lets routes answer with 404 instead of an empty page.
 */
export const getOrgContext = cache(async (orgSlug: string): Promise<OrgContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .maybeSingle().throwOnError();
  if (!org) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle().throwOnError();
  if (!membership) return null;

  return {
    userId: user.id,
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    role: membership.role,
  };
});

export const listUserOrganizations = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('name', { ascending: true }).throwOnError();
  return data ?? [];
});
