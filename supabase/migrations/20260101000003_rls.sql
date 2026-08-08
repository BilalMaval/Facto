alter table organizations enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table work_codes enable row level security;
alter table workers enable row level security;
alter table work_entries enable row level security;
alter table payments enable row level security;
alter table weekly_slips enable row level security;

create policy org_select on organizations for select using (is_org_member(id));
create policy org_update_owner on organizations for update
  using (has_org_role(id, array['owner'])) with check (has_org_role(id, array['owner']));
revoke insert on organizations from authenticated;         -- creation only via create_organization()
grant update (name) on organizations to authenticated;      -- plan/subscription_status stay locked for future Stripe webhook

create policy membership_select on memberships for select using (is_org_member(organization_id));
create policy membership_delete on memberships for delete using (has_org_role(organization_id, array['owner','admin']));
create policy membership_update_role on memberships for update
  using (has_org_role(organization_id, array['owner','admin']))
  with check (has_org_role(organization_id, array['owner','admin']));
revoke insert on memberships from authenticated;            -- creation only via create_organization()/accept_invitation()

create policy invitations_select on invitations for select using (has_org_role(organization_id, array['owner','admin']));
revoke insert, update, delete on invitations from authenticated; -- all writes via create/accept/revoke_invitation()

create policy work_codes_select on work_codes for select using (is_org_member(organization_id));
create policy work_codes_write on work_codes for all
  using (has_org_role(organization_id, array['owner','admin']))
  with check (has_org_role(organization_id, array['owner','admin']));

create policy workers_select on workers for select using (is_org_member(organization_id));
create policy workers_write on workers for all
  using (has_org_role(organization_id, array['owner','admin']))
  with check (has_org_role(organization_id, array['owner','admin']));
revoke update (advance_balance) on workers from authenticated;  -- mutable only via finalize/reopen functions

create policy work_entries_select on work_entries for select using (is_org_member(organization_id));
create policy work_entries_insert on work_entries for insert
  with check (has_org_role(organization_id, array['owner','admin','staff']));
create policy work_entries_update on work_entries for update
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid())
  with check (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());
create policy work_entries_delete on work_entries for delete
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());

create policy payments_select on payments for select using (is_org_member(organization_id));
create policy payments_insert on payments for insert
  with check (has_org_role(organization_id, array['owner','admin','staff']));
create policy payments_update on payments for update
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid())
  with check (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());
create policy payments_delete on payments for delete
  using (has_org_role(organization_id, array['owner','admin']) or created_by = auth.uid());

create policy weekly_slips_select on weekly_slips for select using (is_org_member(organization_id));
revoke insert, update, delete on weekly_slips from authenticated; -- all writes via finalize_weekly_slip()/reopen_weekly_slip()
