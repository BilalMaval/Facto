-- Android-only: Desktop never writes here — it listens to Realtime directly
-- (already RLS-scoped per subscriber) and fires a native OS notification
-- in-process instead, since it doesn't need a device token to receive
-- server-initiated pushes the way a backgrounded/killed Android app does.
create table device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, token)
);
create index on device_push_tokens(user_id);

alter table device_push_tokens enable row level security;

create policy device_push_tokens_select on device_push_tokens for select using (user_id = auth.uid());
create policy device_push_tokens_insert on device_push_tokens for insert with check (user_id = auth.uid());
create policy device_push_tokens_update on device_push_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy device_push_tokens_delete on device_push_tokens for delete using (user_id = auth.uid());

-- Explicit, not inherited: see 20260101000042's comment on why a new table
-- states its own grants up front rather than assuming they exist.
grant select, insert, update, delete on device_push_tokens to authenticated;

-- Recipient-lookup functions for the web app's push-sending code. Each
-- re-derives its own authorization from auth.uid() rather than trusting the
-- caller, the same way has_org_role/is_platform_admin/get_invitation_preview
-- do — there is no service-role client anywhere in this app, so a plain
-- RLS-scoped select could never read another user's device_push_tokens row;
-- these are the sanctioned way past that, scoped narrowly to exactly the
-- three notification triggers that need it.

create or replace function public.get_ticket_reply_recipient_tokens(p_ticket_id uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_tokens text[];
begin
  select organization_id into v_org_id from support_tickets where id = p_ticket_id;
  if v_org_id is null then raise exception 'Ticket not found'; end if;

  if is_platform_admin() then
    -- An org member just replied — notify that org's owners/admins.
    select array_agg(dpt.token) into v_tokens
      from device_push_tokens dpt
      join memberships m on m.user_id = dpt.user_id
      where m.organization_id = v_org_id and m.role in ('owner','admin');
  elsif has_org_role(v_org_id, array['owner','admin']) then
    -- The org just replied — notify platform admins.
    select array_agg(dpt.token) into v_tokens
      from device_push_tokens dpt
      join platform_admins pa on pa.user_id = dpt.user_id;
  else
    raise exception 'Not authorized';
  end if;

  return coalesce(v_tokens, array[]::text[]);
end; $$;

create or replace function public.get_payment_submission_recipient_tokens(p_submission_id uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_submitted_by uuid;
  v_tokens text[];
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  select submitted_by into v_submitted_by from payment_submissions where id = p_submission_id;
  if v_submitted_by is null then raise exception 'Submission not found'; end if;

  select array_agg(token) into v_tokens from device_push_tokens where user_id = v_submitted_by;
  return coalesce(v_tokens, array[]::text[]);
end; $$;

create or replace function public.get_invite_recipient_tokens(p_invitation_id uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_email text;
  v_tokens text[];
begin
  select organization_id, email into v_org_id, v_email from invitations where id = p_invitation_id;
  if v_org_id is null then raise exception 'Invitation not found'; end if;
  if not has_org_role(v_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;

  -- Only reachable if the invited email already belongs to an existing user
  -- with a registered device — e.g. inviting an existing staff member to a
  -- second org. A brand-new invitee has no account yet, so this correctly
  -- returns an empty array rather than erroring.
  select array_agg(dpt.token) into v_tokens
    from device_push_tokens dpt
    join auth.users u on u.id = dpt.user_id
    where lower(u.email) = lower(v_email);

  return coalesce(v_tokens, array[]::text[]);
end; $$;

grant execute on function get_ticket_reply_recipient_tokens(uuid) to authenticated;
grant execute on function get_payment_submission_recipient_tokens(uuid) to authenticated;
grant execute on function get_invite_recipient_tokens(uuid) to authenticated;
