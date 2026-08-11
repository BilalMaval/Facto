-- Team page needs to show WHO has joined (not just pending invites), let
-- the owner remove a member, and let any non-owner member leave on their
-- own. auth.users isn't exposed via PostgREST, so bridge it the same way
-- admin_list_org_owner_emails() already does for the platform admin panel.
create or replace function public.list_org_members(p_org_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not is_org_member(p_org_id) then raise exception 'Not authorized'; end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org_id
    order by m.created_at asc;
end; $$;

-- Removing an existing member is now owner-only. The previous policy only
-- checked the ACTOR's role (owner or admin), not the target row, which
-- meant an admin could technically remove the owner or another admin —
-- tightened here to match the rest of this app's ownership model.
drop policy if exists membership_delete on memberships;
create policy membership_delete on memberships for delete
  using (has_org_role(organization_id, array['owner']));

-- Self-service leave: any non-owner member can remove their own
-- membership whenever they want. SECURITY DEFINER so it isn't blocked by
-- the now owner-only delete policy above — the function itself only ever
-- targets the caller's own row, and refuses if they're the owner (leaving
-- would orphan the business).
create or replace function public.leave_organization(p_org_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from memberships where organization_id = p_org_id and user_id = auth.uid();
  if v_role is null then raise exception 'Not a member of this organization'; end if;
  if v_role = 'owner' then raise exception 'The owner cannot leave — transfer ownership or contact support first'; end if;

  delete from memberships where organization_id = p_org_id and user_id = auth.uid();
end; $$;
