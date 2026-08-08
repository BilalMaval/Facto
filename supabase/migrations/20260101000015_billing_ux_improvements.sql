-- Payment method titles (to match against the account number when paying)
-- and per-method instruction notes shown to the business owner.
alter table platform_settings
  add column easypaisa_title text,
  add column jazzcash_title text,
  add column easypaisa_note text,
  add column jazzcash_note text,
  add column bank_note text;

-- New orgs no longer auto-start a trial — they land in 'pending' with no
-- trial_ends_at set, and get zero access to gated screens (see
-- src/lib/billing.ts) until they explicitly choose Activate Now or Free
-- Trial on the billing page.
create or replace function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  insert into organizations (name, subscription_status, monthly_fee)
    values (p_name, 'pending', 1599)
    returning id into v_org_id;
  insert into memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'owner');
  return v_org_id;
end; $$;

create or replace function public.start_free_trial(p_org_id uuid) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype;
begin
  if not has_org_role(p_org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;

  select * into v_org from organizations where id = p_org_id for update;
  if v_org.id is null then raise exception 'Organization not found'; end if;
  if v_org.subscribed_at is not null then raise exception 'This organization already has a paid plan'; end if;
  if v_org.trial_ends_at is not null then raise exception 'Free trial already used'; end if;

  update organizations set
    subscription_status = 'trial',
    trial_ends_at = now() + interval '3 days'
  where id = p_org_id
  returning * into v_org;

  return v_org;
end; $$;
