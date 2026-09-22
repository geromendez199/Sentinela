-- A1 QA fix: SECURITY DEFINER membership RPCs must deny callers that are not members.
-- PostgreSQL NULL NOT IN (...) evaluates to NULL, so NULL must be rejected explicitly.

create or replace function public.set_organization_member_role(
  p_org_id uuid,
  p_user_id uuid,
  p_role public.org_role
)
returns public.org_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.org_role;
  v_existing_role public.org_role;
  v_owner_count integer;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  perform 1 from public.organizations where id = p_org_id for update;
  if not found then raise exception 'organization_not_found'; end if;

  select role into v_actor_role
  from public.organization_members
  where org_id = p_org_id and user_id = v_actor;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'insufficient_role';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user_not_found';
  end if;

  select role into v_existing_role
  from public.organization_members
  where org_id = p_org_id and user_id = p_user_id;

  if v_actor_role = 'admin' then
    if p_role in ('owner', 'admin') or v_existing_role in ('owner', 'admin') then
      raise exception 'owner_role_required';
    end if;
  end if;

  if v_existing_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where org_id = p_org_id and role = 'owner';

    if v_owner_count <= 1 then raise exception 'last_owner_required'; end if;
  end if;

  insert into public.organization_members(org_id, user_id, role)
  values (p_org_id, p_user_id, p_role)
  on conflict (org_id, user_id)
  do update set role = excluded.role, updated_at = now();

  insert into public.security_audit_log(
    org_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_org_id,
    v_actor,
    case when v_existing_role is null then 'organization_member_added' else 'organization_member_role_changed' end,
    'organization_member',
    p_user_id::text,
    jsonb_build_object('from_role', v_existing_role, 'to_role', p_role)
  );

  return p_role;
end;
$$;

create or replace function public.remove_organization_member(
  p_org_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role public.org_role;
  v_target_role public.org_role;
  v_owner_count integer;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;

  perform 1 from public.organizations where id = p_org_id for update;
  if not found then raise exception 'organization_not_found'; end if;

  select role into v_actor_role
  from public.organization_members
  where org_id = p_org_id and user_id = v_actor;

  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'insufficient_role';
  end if;

  select role into v_target_role
  from public.organization_members
  where org_id = p_org_id and user_id = p_user_id;

  if v_target_role is null then return false; end if;

  if v_actor_role = 'admin' and v_target_role in ('owner', 'admin') then
    raise exception 'owner_role_required';
  end if;

  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where org_id = p_org_id and role = 'owner';

    if v_owner_count <= 1 then raise exception 'last_owner_required'; end if;
  end if;

  delete from public.organization_members
  where org_id = p_org_id and user_id = p_user_id;

  insert into public.security_audit_log(
    org_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_org_id,
    v_actor,
    'organization_member_removed',
    'organization_member',
    p_user_id::text,
    jsonb_build_object('from_role', v_target_role)
  );

  return true;
end;
$$;

revoke all on function public.set_organization_member_role(uuid,uuid,public.org_role) from public, anon;
revoke all on function public.remove_organization_member(uuid,uuid) from public, anon;
grant execute on function public.set_organization_member_role(uuid,uuid,public.org_role) to authenticated;
grant execute on function public.remove_organization_member(uuid,uuid) to authenticated;
