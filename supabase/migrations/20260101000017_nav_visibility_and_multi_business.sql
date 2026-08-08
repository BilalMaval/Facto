-- #2: per-org nav tab hiding (super-admin controlled). Values are route-
-- segment keys: 'billing' | 'support' | 'settings'. This only hides the nav
-- link (see DashboardNav) — it does not block direct navigation, since the
-- suspended/trial_expired block screen links into /dashboard/billing and we
-- don't want a hidden tab to create a dead end.
alter table organizations add column hidden_nav_tabs text[] not null default '{}';

create or replace function public.admin_set_hidden_tabs(p_org_id uuid, p_hidden_tabs text[]) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;
  update organizations set hidden_nav_tabs = p_hidden_tabs where id = p_org_id returning * into v_org;
  if v_org.id is null then raise exception 'Organization not found'; end if;
  return v_org;
end; $$;

-- #3: multi-business plan. This is a per-OWNER entitlement (not per-org) —
-- it governs how many organizations a user is allowed to create, not any
-- single business's own billing.
create table owner_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'basic' check (tier in ('basic','premium')),
  upgraded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table owner_plans enable row level security;

create policy owner_plans_select on owner_plans for select
  using (user_id = auth.uid() or is_platform_admin());
revoke insert, update, delete on owner_plans from authenticated; -- written only via review_payment_submission()

-- Reuse the existing payment-proof/review pipeline for plan-upgrade requests
-- instead of building a parallel one — 'subscription' is the existing org
-- billing flow, 'plan_upgrade' is the new per-owner Premium upgrade.
alter table payment_submissions
  add column purpose text not null default 'subscription' check (purpose in ('subscription','plan_upgrade'));

alter table platform_settings add column multi_business_price numeric(12,2) not null default 2599;

create or replace function public.review_payment_submission(
  p_submission_id uuid, p_approve boolean, p_note text
) returns payment_submissions
language plpgsql security definer set search_path = public as $$
declare v_sub payment_submissions%rowtype; v_org organizations%rowtype;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  select * into v_sub from payment_submissions where id = p_submission_id for update;
  if v_sub.id is null then raise exception 'Submission not found'; end if;
  if v_sub.status <> 'pending' then raise exception 'Already reviewed'; end if;

  update payment_submissions set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_submission_id
  returning * into v_sub;

  if p_approve then
    if v_sub.purpose = 'plan_upgrade' then
      insert into owner_plans (user_id, tier, upgraded_at)
        values (v_sub.submitted_by, 'premium', now())
      on conflict (user_id) do update set tier = 'premium', upgraded_at = now();
    else
      select * into v_org from organizations where id = v_sub.organization_id for update;

      if v_org.subscribed_at is null then
        update organizations set
          subscribed_at = v_sub.payment_date,
          paid_until = (v_sub.payment_date + interval '1 month' - interval '1 day')::date,
          subscription_status = 'active', suspension_note = null
        where id = v_org.id;
      else
        update organizations set
          paid_until = (coalesce(paid_until, v_sub.payment_date) + interval '1 month')::date,
          subscription_status = 'active', suspension_note = null
        where id = v_org.id;
      end if;
    end if;
  end if;

  return v_sub;
end; $$;

-- First org (onboarding) is always free — the guard only fires once a user
-- already owns one, requiring Premium to add more.
create or replace function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_owns_existing boolean; v_tier text;
begin
  select exists(select 1 from memberships where user_id = auth.uid() and role = 'owner') into v_owns_existing;
  if v_owns_existing then
    select coalesce((select tier from owner_plans where user_id = auth.uid()), 'basic') into v_tier;
    if v_tier <> 'premium' then
      raise exception 'Upgrade to the Premium plan to add another business';
    end if;
  end if;

  insert into organizations (name, subscription_status, monthly_fee)
    values (p_name, 'pending', 1599)
    returning id into v_org_id;
  insert into memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'owner');
  return v_org_id;
end; $$;
