create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on support_tickets(organization_id);
create index on support_tickets(status);

create table support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  is_platform_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index on support_ticket_messages(ticket_id);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

create policy support_tickets_select on support_tickets for select
  using (has_org_role(organization_id, array['owner','admin']) or is_platform_admin());
revoke insert, update, delete on support_tickets from authenticated; -- all writes via functions below

create policy support_ticket_messages_select on support_ticket_messages for select
  using (
    exists (
      select 1 from support_tickets t
      where t.id = ticket_id
        and (has_org_role(t.organization_id, array['owner','admin']) or is_platform_admin())
    )
  );
revoke insert, update, delete on support_ticket_messages from authenticated;

create or replace function public.create_support_ticket(p_org_id uuid, p_subject text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ticket_id uuid;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if trim(p_subject) = '' or trim(p_body) = '' then raise exception 'Subject and message are required'; end if;

  insert into support_tickets (organization_id, subject, created_by)
    values (p_org_id, p_subject, auth.uid()) returning id into v_ticket_id;
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

  update support_tickets set
    status = case when v_is_admin then 'answered' else 'open' end,
    updated_at = now()
  where id = p_ticket_id;

  return v_message_id;
end; $$;

create or replace function public.set_ticket_status(p_ticket_id uuid, p_status text) returns support_tickets
language plpgsql security definer set search_path = public as $$
declare v_ticket support_tickets%rowtype;
begin
  select * into v_ticket from support_tickets where id = p_ticket_id for update;
  if v_ticket.id is null then raise exception 'Ticket not found'; end if;
  if not is_platform_admin() and not has_org_role(v_ticket.organization_id, array['owner','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('open','answered','closed') then raise exception 'Invalid status'; end if;

  update support_tickets set status = p_status, updated_at = now()
    where id = p_ticket_id returning * into v_ticket;
  return v_ticket;
end; $$;
