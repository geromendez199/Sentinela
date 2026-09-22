import type { Database } from './database.types';

/** Stable app aliases derived from the generated Supabase schema. */
export type OrgRole = Database['public']['Enums']['org_role'];
export type FidelityStatus = Database['public']['Enums']['fidelity_status'];
