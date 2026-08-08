-- membership/role check helpers (security definer avoids RLS recursion on memberships itself)
create or replace function public.is_org_member(p_org_id uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where organization_id = p_org_id and user_id = auth.uid());
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles text[]) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from memberships where organization_id = p_org_id and user_id = auth.uid() and role = any(p_roles));
$$;

-- server computes rate_snapshot/amount; also blocks writes into finalized weeks
create or replace function public.work_entries_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_rate numeric(12,2); v_locked boolean;
begin
  if TG_OP in ('INSERT','UPDATE') then
    select rate into v_rate from work_codes where id = new.work_code_id and organization_id = new.organization_id;
    if v_rate is null then raise exception 'Invalid work code for this organization'; end if;
    new.rate_snapshot := v_rate;
    new.amount := new.quantity * v_rate;
  end if;

  select exists (
    select 1 from weekly_slips
    where organization_id = coalesce(new.organization_id, old.organization_id)
      and worker_id = coalesce(new.worker_id, old.worker_id)
      and status = 'finalized'
      and coalesce(new.entry_date, old.entry_date) between week_start and week_end
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger trg_work_entries_before_write
before insert or update or delete on work_entries
for each row execute function public.work_entries_before_write();

-- same lock check for payments (no amount computation needed there)
create or replace function public.payments_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_locked boolean;
begin
  select exists (
    select 1 from weekly_slips
    where organization_id = coalesce(new.organization_id, old.organization_id)
      and worker_id = coalesce(new.worker_id, old.worker_id)
      and status = 'finalized'
      and coalesce(new.payment_date, old.payment_date) between week_start and week_end
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger trg_payments_before_write
before insert or update or delete on payments
for each row execute function public.payments_before_write();

-- signup: create org + owner membership atomically
create or replace function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  insert into organizations (name) values (p_name) returning id into v_org_id;
  insert into memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'owner');
  return v_org_id;
end; $$;

-- invite flow
create or replace function public.create_invitation(p_org_id uuid, p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if p_role not in ('admin','staff') then raise exception 'Invalid role'; end if;
  insert into invitations (organization_id, email, role, invited_by)
    values (p_org_id, lower(p_email), p_role, auth.uid()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.accept_invitation(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv invitations%rowtype; v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from invitations
    where token = p_token and status = 'pending' and expires_at > now() for update;
  if v_inv.id is null then raise exception 'Invitation not found or expired'; end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'Issued to a different email'; end if;
  insert into memberships (user_id, organization_id, role)
    values (auth.uid(), v_inv.organization_id, v_inv.role) on conflict do nothing;
  update invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.organization_id;
end; $$;

create or replace function public.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  select organization_id into v_org_id from invitations where id = p_invitation_id;
  if not has_org_role(v_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  update invitations set status = 'revoked' where id = p_invitation_id;
end; $$;

-- THE core reconciliation logic — atomic, server-only
create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare v_work_amount numeric(12,2); v_paid_amount numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  perform 1 from workers where id = p_worker_id and organization_id = p_org_id for update;
  if not found then raise exception 'Worker not found'; end if;

  select coalesce(sum(amount),0) into v_work_amount from work_entries
    where organization_id = p_org_id and worker_id = p_worker_id and entry_date between p_week_start and p_week_end;
  select coalesce(sum(amount),0) into v_paid_amount from payments
    where organization_id = p_org_id and worker_id = p_worker_id and payment_date between p_week_start and p_week_end;

  v_delta := v_paid_amount - v_work_amount; -- + = overpay (debt grows), - = shortfall (debt shrinks)

  insert into weekly_slips (organization_id, worker_id, week_start, week_end,
    work_amount, paid_amount, advance_delta, grand_total, payable_balance, status, finalized_at, finalized_by)
  values (p_org_id, p_worker_id, p_week_start, p_week_end,
    v_work_amount, v_paid_amount, v_delta, v_work_amount, v_work_amount - v_paid_amount, 'finalized', now(), auth.uid())
  on conflict (organization_id, worker_id, week_start) do update set
    week_end = excluded.week_end, work_amount = excluded.work_amount, paid_amount = excluded.paid_amount,
    advance_delta = excluded.advance_delta, grand_total = excluded.grand_total, payable_balance = excluded.payable_balance,
    status = 'finalized', finalized_at = now(), finalized_by = auth.uid(), reopened_at = null, reopened_by = null
  where weekly_slips.status = 'draft'
  returning * into v_slip;

  if v_slip.id is null then raise exception 'Already finalized — reopen it first to recalculate'; end if;

  update workers set advance_balance = advance_balance + v_delta where id = p_worker_id;
  return v_slip;
end; $$;

create or replace function public.reopen_weekly_slip(p_slip_id uuid) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare v_slip weekly_slips%rowtype;
begin
  select * into v_slip from weekly_slips where id = p_slip_id for update;
  if v_slip.id is null then raise exception 'Not found'; end if;
  if not has_org_role(v_slip.organization_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if v_slip.status <> 'finalized' then raise exception 'Not finalized'; end if;

  update workers set advance_balance = advance_balance - v_slip.advance_delta where id = v_slip.worker_id;
  update weekly_slips set status = 'draft', reopened_at = now(), reopened_by = auth.uid()
    where id = p_slip_id returning * into v_slip;
  return v_slip;
end; $$;
