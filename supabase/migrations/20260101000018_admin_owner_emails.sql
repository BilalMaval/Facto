-- Lets the super-admin org list show which email owns each organization —
-- auth.users isn't exposed via PostgREST directly, so this SECURITY DEFINER
-- function bridges it, gated the same way as every other admin-only RPC.
create or replace function public.admin_list_org_owner_emails()
returns table (organization_id uuid, email text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  return query
    select m.organization_id, u.email::text
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.role = 'owner';
end; $$;
