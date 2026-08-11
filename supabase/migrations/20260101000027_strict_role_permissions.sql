-- Tighten mutation permissions to an explicit ownership model:
--   - Work entries & payments: any org member can still log new ones, but
--     only the OWNER may edit or delete an existing one — not admin, and
--     not even the staff/admin member who originally created it. The old
--     "or created_by = auth.uid()" self-edit escape hatch is removed.
--   - Workers: admin keeps two narrow, single-purpose mutations — creating
--     a worker, and (via the functions below) toggling active/inactive and
--     changing payment type (employment_type/weekly_salary). Everything
--     else about a worker's profile (name, CNIC, contact info, etc.) is
--     now owner-only to edit. RLS can't restrict which *columns* a plain
--     UPDATE touches, only whether the row-level operation is allowed at
--     all — so admin's two allowed mutations go through SECURITY DEFINER
--     functions that touch only their own columns, while the general
--     UPDATE policy locks to owner.

drop policy if exists work_entries_update on work_entries;
create policy work_entries_update on work_entries for update
  using (has_org_role(organization_id, array['owner']))
  with check (has_org_role(organization_id, array['owner']));

drop policy if exists work_entries_delete on work_entries;
create policy work_entries_delete on work_entries for delete
  using (has_org_role(organization_id, array['owner']));

drop policy if exists payments_update on payments;
create policy payments_update on payments for update
  using (has_org_role(organization_id, array['owner']))
  with check (has_org_role(organization_id, array['owner']));

drop policy if exists payments_delete on payments;
create policy payments_delete on payments for delete
  using (has_org_role(organization_id, array['owner']));

drop policy if exists workers_write on workers;
create policy workers_insert on workers for insert
  with check (has_org_role(organization_id, array['owner','admin']));
create policy workers_update on workers for update
  using (has_org_role(organization_id, array['owner']))
  with check (has_org_role(organization_id, array['owner']));
create policy workers_delete on workers for delete
  using (has_org_role(organization_id, array['owner']));

create or replace function public.set_worker_active(p_org_id uuid, p_worker_id uuid, p_is_active boolean)
returns workers language plpgsql security definer set search_path = public as $$
declare v_worker workers%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;

  update workers set is_active = p_is_active
  where id = p_worker_id and organization_id = p_org_id
  returning * into v_worker;

  if v_worker.id is null then raise exception 'Worker not found'; end if;
  return v_worker;
end; $$;

create or replace function public.set_worker_payment_type(
  p_org_id uuid, p_worker_id uuid, p_employment_type text, p_weekly_salary numeric
) returns workers language plpgsql security definer set search_path = public as $$
declare v_worker workers%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;
  if p_employment_type not in ('contract', 'salary', 'hybrid') then raise exception 'Invalid payment type'; end if;
  if p_employment_type <> 'contract' and (p_weekly_salary is null or p_weekly_salary <= 0) then
    raise exception 'Weekly salary is required for salary/hybrid workers';
  end if;

  update workers set
    employment_type = p_employment_type,
    weekly_salary = case when p_employment_type = 'contract' then null else p_weekly_salary end
  where id = p_worker_id and organization_id = p_org_id
  returning * into v_worker;

  if v_worker.id is null then raise exception 'Worker not found'; end if;
  return v_worker;
end; $$;
