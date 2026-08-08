-- Lets an unauthenticated visitor (following an emailed invite link) see who
-- invited them and to what role before they sign up or log in. Knowledge of
-- the random token is the credential here, same trust model as any emailed
-- invite link — it intentionally does not require org membership to call.
create or replace function public.get_invitation_preview(p_token uuid)
returns table (organization_name text, role text, email text, status text, expires_at timestamptz)
language sql security definer set search_path = public stable as $$
  select o.name, i.role, i.email, i.status, i.expires_at
  from invitations i
  join organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;
