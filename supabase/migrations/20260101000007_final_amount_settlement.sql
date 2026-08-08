-- Admin enters a manual "final amount" when closing out a week — the actual
-- cash handed over at settlement, which may be less/more than what's payable
-- after netting out the week's daily payments. This isn't derivable from
-- work_entries/payments, so it has to be captured and stored explicitly.
alter table weekly_slips add column final_amount numeric(12,2);

drop function if exists public.finalize_weekly_slip(uuid, uuid, date, date);

create or replace function public.finalize_weekly_slip(
  p_org_id uuid, p_worker_id uuid, p_week_start date, p_week_end date, p_final_amount numeric
) returns weekly_slips
language plpgsql security definer set search_path = public as $$
declare
  v_work_amount numeric(12,2); v_paid_amount numeric(12,2);
  v_payable numeric(12,2); v_delta numeric(12,2); v_slip weekly_slips%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if p_final_amount is null or p_final_amount < 0 then raise exception 'Final amount must be zero or more'; end if;

  perform 1 from workers where id = p_worker_id and organization_id = p_org_id for update;
  if not found then raise exception 'Worker not found'; end if;

  select coalesce(sum(amount),0) into v_work_amount from work_entries
    where organization_id = p_org_id and worker_id = p_worker_id and entry_date between p_week_start and p_week_end;
  select coalesce(sum(amount),0) into v_paid_amount from payments
    where organization_id = p_org_id and worker_id = p_worker_id and payment_date between p_week_start and p_week_end;

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
