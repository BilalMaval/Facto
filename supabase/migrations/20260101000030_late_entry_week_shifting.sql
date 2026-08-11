-- Which week's slip an entry/payment counts toward is normally just the
-- week its own date falls in. But if that week was already finalized by
-- the time the entry/payment gets logged, the original slip is a locked
-- snapshot — so instead of being rejected outright (or corrupting a signed
-- slip), the amount gets counted toward the CURRENT week instead, while
-- the entry itself keeps its real (old) date. counted_week_start is that
-- target week's start date, decided once at insert time by the app layer
-- (which checks whether the target week is already finalized).
alter table work_entries add column if not exists counted_week_start date;
alter table payments add column if not exists counted_week_start date;

-- Backfill existing rows: counted_week_start = the week their own date
-- already falls in (per each org's own week_start_day setting), matching
-- current behavior exactly — nothing already logged shifts anywhere. This
-- is a one-time schema backfill, not a real edit, so it needs to bypass
-- the finalized-week write lock below (that lock exists to stop USERS
-- from tampering with settled entries, not to block this migration).
alter table work_entries disable trigger trg_work_entries_before_write;
alter table payments disable trigger trg_payments_before_write;

update work_entries e
set counted_week_start = e.entry_date - (
  case o.week_start_day
    when 'saturday' then (extract(dow from e.entry_date)::int - 6 + 7) % 7
    else (extract(dow from e.entry_date)::int - 1 + 7) % 7
  end
)
from organizations o
where o.id = e.organization_id and e.counted_week_start is null;

update payments p
set counted_week_start = p.payment_date - (
  case o.week_start_day
    when 'saturday' then (extract(dow from p.payment_date)::int - 6 + 7) % 7
    else (extract(dow from p.payment_date)::int - 1 + 7) % 7
  end
)
from organizations o
where o.id = p.organization_id and p.counted_week_start is null;

alter table work_entries enable trigger trg_work_entries_before_write;
alter table payments enable trigger trg_payments_before_write;

alter table work_entries alter column counted_week_start set not null;
alter table payments alter column counted_week_start set not null;

create index if not exists work_entries_counted_week_idx
  on work_entries (organization_id, worker_id, counted_week_start);
create index if not exists payments_counted_week_idx
  on payments (organization_id, worker_id, counted_week_start);

-- The finalized-week write lock now protects counted_week_start, not the
-- entry/payment's own date — that's the whole point of this migration: a
-- NEW backdated entry into an already-finalized week is now allowed
-- through (the app sets its counted_week_start to the current week
-- instead of the locked one), while editing or deleting a row that's
-- actually counted toward a finalized week stays blocked, same as before.
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
      and week_start = coalesce(new.counted_week_start, old.counted_week_start)
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;

create or replace function public.payments_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_locked boolean;
begin
  select exists (
    select 1 from weekly_slips
    where organization_id = coalesce(new.organization_id, old.organization_id)
      and worker_id = coalesce(new.worker_id, old.worker_id)
      and status = 'finalized'
      and week_start = coalesce(new.counted_week_start, old.counted_week_start)
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;

-- Weekly settlement math now sums by counted_week_start instead of the
-- entry/payment's own date range — the only change from before.
create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date, p_final_amount numeric
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare
  v_worker workers%rowtype;
  v_entries_amount numeric(12,2); v_work_amount numeric(12,2); v_paid_amount numeric(12,2);
  v_payable numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if p_final_amount is null or p_final_amount < 0 then raise exception 'Final amount must be zero or more'; end if;

  select * into v_worker from workers where id = p_worker_id and organization_id = p_org_id for update;
  if not found then raise exception 'Worker not found'; end if;

  select coalesce(sum(amount),0) into v_entries_amount from work_entries
    where organization_id = p_org_id and worker_id = p_worker_id and counted_week_start = p_week_start;
  select coalesce(sum(amount),0) into v_paid_amount from payments
    where organization_id = p_org_id and worker_id = p_worker_id and counted_week_start = p_week_start;

  v_work_amount := case v_worker.employment_type
    when 'salary' then coalesce(v_worker.weekly_salary, 0)
    when 'hybrid' then v_entries_amount + coalesce(v_worker.weekly_salary, 0)
    else v_entries_amount
  end;

  v_payable := v_work_amount - v_paid_amount;
  v_delta := p_final_amount - v_payable;

  insert into weekly_slips (organization_id, worker_id, week_start, week_end,
    work_amount, paid_amount, advance_delta, grand_total, payable_balance, final_amount,
    status, finalized_at, finalized_by)
  values (p_org_id, p_worker_id, p_week_start, p_week_end,
    v_work_amount, v_paid_amount, v_delta, v_work_amount, v_payable, p_final_amount,
    'finalized', now(), auth.uid())
  on conflict (organization_id, worker_id, week_start) do update set
    week_end = excluded.week_end, work_amount = excluded.work_amount, paid_amount = excluded.paid_amount,
    advance_delta = excluded.advance_delta, grand_total = excluded.grand_total,
    payable_balance = excluded.payable_balance, final_amount = excluded.final_amount,
    status = 'finalized', finalized_at = now(), finalized_by = auth.uid(), reopened_at = null, reopened_by = null
  where weekly_slips.status = 'draft'
  returning * into v_slip;

  if v_slip.id is null then raise exception 'Already finalized — reopen it first to recalculate'; end if;

  update workers set advance_balance = advance_balance + v_delta where id = p_worker_id;
  return v_slip;
end; $$;
