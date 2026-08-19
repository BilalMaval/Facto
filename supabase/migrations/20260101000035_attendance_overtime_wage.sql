-- Overtime can now be paid either the usual way (hours x the derived
-- overtime rate) or as a flat custom amount someone types directly for that
-- day — e.g. a fixed bonus that doesn't map cleanly to an hourly rate.
-- overtime_wage is nullable: null means "use overtime_hours x rate" (the
-- existing behavior, unchanged), a non-null value means "use this amount
-- instead, ignore the hourly calc for this day". overtime_hours is still
-- stored either way so switching back to the hours-based mode doesn't lose
-- what was there before.
alter table attendance add column if not exists overtime_wage numeric(10,2) null
  check (overtime_wage is null or overtime_wage >= 0);

-- Same as 20260101000034_attendance_holiday_and_daily_edit.sql's version,
-- plus: the per-day overtime rate is now computed before the attendance
-- aggregate (rather than after) so the aggregate query can pick, per row,
-- between the custom overtime_wage and hours x rate.
create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date, p_final_amount numeric
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare
  v_worker workers%rowtype; v_org organizations%rowtype;
  v_entries_amount numeric(12,2); v_work_amount numeric(12,2); v_paid_amount numeric(12,2);
  v_payable numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
  v_attendance_count int; v_days_sum numeric(6,2); v_overtime_amount numeric(12,2); v_holiday_wage numeric(12,2);
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

  v_per_day_rate := coalesce(v_worker.weekly_salary, 0) / nullif(v_org.standard_days_per_week, 0);
  v_overtime_hourly_rate := (v_per_day_rate / nullif(v_org.standard_hours_per_day, 0)) * v_org.overtime_rate_multiplier;

  select
      count(*),
      coalesce(sum(case when attendance_date <> p_week_end then
        case status when 'present' then 1 when 'half_day' then 0.5 else 0 end
      else 0 end), 0),
      coalesce(sum(case when overtime_wage is not null then overtime_wage
        else overtime_hours * coalesce(v_overtime_hourly_rate, 0) end), 0),
      coalesce(sum(case when attendance_date = p_week_end and status = 'present' then holiday_wage else 0 end), 0)
    into v_attendance_count, v_days_sum, v_overtime_amount, v_holiday_wage
    from attendance
    where organization_id = p_org_id and worker_id = p_worker_id
      and attendance_date between p_week_start and p_week_end;

  if v_attendance_count = 0 then
    v_salary_component := coalesce(v_worker.weekly_salary, 0);
  else
    v_salary_component := (v_days_sum * v_per_day_rate) + v_overtime_amount + v_holiday_wage;
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
