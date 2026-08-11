-- Worker ID becomes optional — CNIC is now the durable, primary identifier
-- for a worker, so it takes over the uniqueness/required role worker_code
-- used to have.
alter table workers alter column worker_code drop not null;

-- Some existing rows share a placeholder CNIC entered by mistake (real,
-- distinct workers, not duplicates of each other) — clear it on every row
-- except the earliest-created one per (org, cnic) so the uniqueness rule
-- below can be added without guessing at anyone's real CNIC. Affected
-- workers just need their correct CNIC re-entered via the Workers screen,
-- which now requires and validates it.
with dupes as (
  select id, row_number() over (partition by organization_id, cnic order by created_at asc) as rn
  from workers
  where cnic is not null
)
update workers set cnic = null
where id in (select id from dupes where rn > 1);

alter table workers drop constraint if exists workers_org_cnic_key;
alter table workers add constraint workers_org_cnic_key unique (organization_id, cnic);

-- Employment type drives how weekly pay is computed:
--   contract — paid per work_entries logged this week (existing behavior).
--   salary   — paid a fixed weekly_salary regardless of entries logged.
--   hybrid   — paid entries + weekly_salary combined into one payable pool.
-- Everything downstream (payments subtracted, advance settlement, finalize/
-- reopen) stays exactly as-is — only what counts as "work_amount" changes
-- per type, in finalize_weekly_slip() below and mirrored in SlipView.tsx.
alter table workers add column if not exists employment_type text not null default 'contract'
  check (employment_type in ('contract', 'salary', 'hybrid'));
alter table workers add column if not exists weekly_salary numeric(12,2);
alter table workers drop constraint if exists workers_weekly_salary_required;
alter table workers add constraint workers_weekly_salary_required
  check (employment_type = 'contract' or weekly_salary is not null);

drop function if exists public.finalize_weekly_slip(uuid, uuid, date, date, numeric);

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
    where organization_id = p_org_id and worker_id = p_worker_id and entry_date between p_week_start and p_week_end;
  select coalesce(sum(amount),0) into v_paid_amount from payments
    where organization_id = p_org_id and worker_id = p_worker_id and payment_date between p_week_start and p_week_end;

  v_work_amount := case v_worker.employment_type
    when 'salary' then coalesce(v_worker.weekly_salary, 0)
    when 'hybrid' then v_entries_amount + coalesce(v_worker.weekly_salary, 0)
    else v_entries_amount
  end;

  v_payable := v_work_amount - v_paid_amount;
  v_delta := p_final_amount - v_payable; -- + = overpay (debt grows), - = shortfall (debt shrinks)

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
