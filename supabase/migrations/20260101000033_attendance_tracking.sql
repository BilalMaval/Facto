-- Attendance-based pay for salary/hybrid workers: present/absent/half-day
-- per day plus overtime hours, instead of always paying the flat
-- weekly_salary regardless of attendance. Contract workers are entirely
-- unaffected — they're still paid per work_entries logged.
--
-- Backward-compat: if a worker has NO attendance rows for a week (an org
-- that hasn't started using this feature, or just hasn't filled it in yet),
-- finalize_weekly_slip() falls back to the old behavior — full
-- weekly_salary, no attendance math. The attendance-driven calculation only
-- takes over once at least one row exists for that week.
alter table organizations add column if not exists standard_days_per_week int not null default 6
  check (standard_days_per_week between 1 and 7);
alter table organizations add column if not exists standard_hours_per_day numeric(4,2) not null default 8
  check (standard_hours_per_day > 0);
alter table organizations add column if not exists overtime_rate_multiplier numeric(4,2) not null default 1.5
  check (overtime_rate_multiplier >= 0);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'half_day')),
  overtime_hours numeric(5,2) not null default 0 check (overtime_hours >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, worker_id, attendance_date)
);
create index if not exists attendance_org_worker_date_idx
  on attendance (organization_id, worker_id, attendance_date);

alter table attendance enable row level security;

create policy attendance_select on attendance for select using (is_org_member(organization_id));
create policy attendance_insert on attendance for insert
  with check (has_org_role(organization_id, array['owner','admin','staff']));
create policy attendance_update on attendance for update
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid())
  with check (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());
create policy attendance_delete on attendance for delete
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());

-- Unlike work_entries/payments, attendance has no counted_week_start — the
-- weekly grid always targets the week currently being viewed, and once that
-- week is finalized the grid simply renders read-only, so there's no
-- "backdate into a finalized week" case to shift elsewhere. The lock here
-- just computes which week attendance_date falls into (same dow-based
-- formula as the work_entries/payments backfill in
-- 20260101000030_late_entry_week_shifting.sql) and blocks the write if
-- that week is already finalized.
create or replace function public.attendance_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_week_start_day text; v_date date; v_week_start date; v_locked boolean;
begin
  v_date := coalesce(new.attendance_date, old.attendance_date);
  select week_start_day into v_week_start_day from organizations
    where id = coalesce(new.organization_id, old.organization_id);
  v_week_start := v_date - (
    case v_week_start_day
      when 'saturday' then (extract(dow from v_date)::int - 6 + 7) % 7
      else (extract(dow from v_date)::int - 1 + 7) % 7
    end
  );

  select exists (
    select 1 from weekly_slips
    where organization_id = coalesce(new.organization_id, old.organization_id)
      and worker_id = coalesce(new.worker_id, old.worker_id)
      and status = 'finalized'
      and week_start = v_week_start
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;

create trigger trg_attendance_before_write
before insert or update or delete on attendance
for each row execute function public.attendance_before_write();

-- Weekly settlement math now also folds in attendance-based pay for
-- salary/hybrid workers (see the backward-compat note at the top of this
-- file for the no-attendance-rows fallback). Everything else — entries
-- amount, payments, advance settlement, the finalize/reopen mechanics —
-- is unchanged from 20260101000030_late_entry_week_shifting.sql.
create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date, p_final_amount numeric
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare
  v_worker workers%rowtype; v_org organizations%rowtype;
  v_entries_amount numeric(12,2); v_work_amount numeric(12,2); v_paid_amount numeric(12,2);
  v_payable numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
  v_attendance_count int; v_days_sum numeric(6,2); v_overtime_hours numeric(8,2);
  v_per_day_rate numeric(14,4); v_overtime_hourly_rate numeric(14,4); v_salary_component numeric(12,2);
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if p_final_amount is null or p_final_amount < 0 then raise exception 'Final amount must be zero or more'; end if;

  select * into v_worker from workers where id = p_worker_id and organization_id = p_org_id for update;
  if not found then raise exception 'Worker not found'; end if;
  select * into v_org from organizations where id = p_org_id;

  select coalesce(sum(amount),0) into v_entries_amount from work_entries
    where organization_id = p_org_id and worker_id = p_worker_id and counted_week_start = p_week_start;
  select coalesce(sum(amount),0) into v_paid_amount from payments
    where organization_id = p_org_id and worker_id = p_worker_id and counted_week_start = p_week_start;

  select count(*),
    coalesce(sum(case status when 'present' then 1 when 'half_day' then 0.5 else 0 end), 0),
    coalesce(sum(overtime_hours), 0)
    into v_attendance_count, v_days_sum, v_overtime_hours
    from attendance
    where organization_id = p_org_id and worker_id = p_worker_id
      and attendance_date between p_week_start and p_week_end;

  if v_attendance_count = 0 then
    v_salary_component := coalesce(v_worker.weekly_salary, 0);
  else
    v_per_day_rate := coalesce(v_worker.weekly_salary, 0) / nullif(v_org.standard_days_per_week, 0);
    v_overtime_hourly_rate := (v_per_day_rate / nullif(v_org.standard_hours_per_day, 0)) * v_org.overtime_rate_multiplier;
    v_salary_component := (v_days_sum * v_per_day_rate) + (v_overtime_hours * coalesce(v_overtime_hourly_rate, 0));
  end if;

  v_work_amount := case v_worker.employment_type
    when 'salary' then v_salary_component
    when 'hybrid' then v_entries_amount + v_salary_component
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
