-- Per-ticket "last read" timestamps for each side of the conversation, so
-- notifications are message-level (one per unseen reply) and clear the
-- moment the thread is actually opened — not just when ticket.status
-- happens to change, which only tracks who owes the next reply, not who
-- has actually seen what.
alter table support_tickets
  add column org_last_read_at timestamptz,
  add column admin_last_read_at timestamptz;

-- Existing conversations are "caught up" as of this migration, so it
-- doesn't suddenly flag every historical ticket as unread.
update support_tickets set org_last_read_at = now(), admin_last_read_at = now();

create or replace function public.create_support_ticket(p_org_id uuid, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ticket_id uuid;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if trim(p_subject) = '' or trim(p_body) = '' then raise exception 'Subject and message are required'; end if;

  insert into support_tickets (organization_id, subject, created_by, org_last_read_at)
    values (p_org_id, p_subject, auth.uid(), now()) returning id into v_ticket_id;
  insert into support_ticket_messages (ticket_id, sender_id, is_platform_admin, body)
    values (v_ticket_id, auth.uid(), false, p_body);

  return v_ticket_id;
end; $$;

create or replace function public.post_ticket_message(p_ticket_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ticket support_tickets%rowtype; v_is_admin boolean; v_message_id uuid;
begin
  select * into v_ticket from support_tickets where id = p_ticket_id for update;
  if v_ticket.id is null then raise exception 'Ticket not found'; end if;

  v_is_admin := is_platform_admin();
  if not v_is_admin and not has_org_role(v_ticket.organization_id, array['owner','admin']) then
    raise exception 'Not authorized';
  end if;
  if trim(p_body) = '' then raise exception 'Message cannot be empty'; end if;

  insert into support_ticket_messages (ticket_id, sender_id, is_platform_admin, body)
    values (p_ticket_id, auth.uid(), v_is_admin, p_body)
    returning id into v_message_id;

  -- The sender has obviously "seen" their own message; the other side's
  -- last-read stays put, so the new message correctly shows as unread for
  -- them until they open the thread.
  update support_tickets set
    status = case when v_is_admin then 'answered' else 'open' end,
    updated_at = now(),
    admin_last_read_at = case when v_is_admin then now() else admin_last_read_at end,
    org_last_read_at = case when v_is_admin then org_last_read_at else now() end
  where id = p_ticket_id;

  return v_message_id;
end; $$;

create or replace function public.mark_ticket_read(p_ticket_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_ticket support_tickets%rowtype; v_is_admin boolean;
begin
  select * into v_ticket from support_tickets where id = p_ticket_id;
  if v_ticket.id is null then raise exception 'Ticket not found'; end if;

  v_is_admin := is_platform_admin();
  if not v_is_admin and not has_org_role(v_ticket.organization_id, array['owner','admin']) then
    raise exception 'Not authorized';
  end if;

  if v_is_admin then
    update support_tickets set admin_last_read_at = now() where id = p_ticket_id;
  else
    update support_tickets set org_last_read_at = now() where id = p_ticket_id;
  end if;
end; $$;
