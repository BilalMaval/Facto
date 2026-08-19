-- Two changes to attendance:
--
-- 1. Holiday day. The last day of the org's week (Friday for Saturday-start
--    orgs, Sunday for Monday-start orgs) defaults to a day off, not a
--    working day — it's excluded from the 6-day present/absent/half-day sum
--    that drives the per-day rate. If someone actually worked that day, it
--    can be flipped to "present", but since it isn't one of the 6 days the
--    per-day rate is derived from, its pay isn't a fraction of weekly_salary
--    — the person entering it types a flat wage for that specific day
--    (holiday_wage), which is added on top of the normal salary component
--    entirely separately from the weekly_salary/per-day-rate math.
--
-- 2. Daily-edit permission. Attendance is meant to be marked day-by-day as
--    it happens, not batch-edited later, so staff/admin can only write
--    today's row — editing a past day's attendance (correcting a mistake,
--    backdating) is restricted to the org owner.
alter table attendance add column if not exists holiday_wage numeric(10,2) not null default 0
  check (holiday_wage >= 0);

alter table attendance drop constraint if exists attendance_status_check;
alter table attendance add constraint attendance_status_check
  check (status in ('present', 'absent', 'half_day', 'holiday'));

drop policy if exists attendance_insert on attendance;
drop policy if exists attendance_update on attendance;

create policy attendance_insert on attendance for insert
  with check (
    has_org_role(organization_id, array['owner'])
    or (has_org_role(organization_id, array['admin', 'staff']) and attendance_date = current_date)
  );
create policy attendance_update on attendance for update
  using (
    has_org_role(organization_id, array['owner'])
    or (has_org_role(organization_id, array['admin', 'staff']) and attendance_date = current_date)
  )
  with check (
    has_org_role(organization_id, array['owner'])
    or (has_org_role(organization_id, array['admin', 'staff']) and attendance_date = current_date)
  );

-- Same as 20260101000033_attendance_tracking.sql's version, plus:
-- days_sum now excludes the holiday day (attendance_date = p_week_end) from
-- the 6-day present/absent/half-day count, and a separate holiday_wage is
-- added on top when that day was marked present.
create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date, p_final_amount numeric
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare
  v_worker workers%rowtype; v_org organizations%rowtype;
  v_entries_amount numeric(12,2); v_work_amount numeric(12,2); v_paid_amount numeric(12,2);
  v_payable numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
  v_attendance_count int; v_days_sum numeric(6,2); v_overtime_hours numeric(8,2); v_holiday_wage numeric(12,2);
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

  select
      count(*),
      coalesce(sum(case when attendance_date <> p_week_end then
        case status when 'present' then 1 when 'half_day' then 0.5 else 0 end
      else 0 end), 0),
      coalesce(sum(overtime_hours), 0),
      coalesce(sum(case when attendance_date = p_week_end and status = 'present' then holiday_wage else 0 end), 0)
    into v_attendance_count, v_days_sum, v_overtime_hours, v_holiday_wage
    from attendance
    where organization_id = p_org_id and worker_id = p_worker_id
      and attendance_date between p_week_start and p_week_end;

  if v_attendance_count = 0 then
    v_salary_component := coalesce(v_worker.weekly_salary, 0);
  else
    v_per_day_rate := coalesce(v_worker.weekly_salary, 0) / nullif(v_org.standard_days_per_week, 0);
    v_overtime_hourly_rate := (v_per_day_rate / nullif(v_org.standard_hours_per_day, 0)) * v_org.overtime_rate_multiplier;
    v_salary_component := (v_days_sum * v_per_day_rate) + (v_overtime_hours * coalesce(v_overtime_hourly_rate, 0)) + v_holiday_wage;
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
