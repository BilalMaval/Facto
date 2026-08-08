-- Platform-level administrators — separate from any organization's
-- owner/admin/staff roles. These accounts manage business owners
-- (organizations) across the whole SaaS, not just one tenant.
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

create or replace function public.is_platform_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create policy platform_admins_select on platform_admins for select
  using (is_platform_admin());
-- No insert/update/delete grants for authenticated — new platform admins are
-- added via direct SQL for now, deliberately outside normal app flows.

-- Manual fee/subscription tracking fields. This is a system of record for
-- the platform admin to track what each org owes/has agreed to — it does
-- NOT collect payment. Wiring up a real payment processor (Stripe etc.) is
-- a separate, much larger integration and hasn't been requested/built.
alter table organizations add column monthly_fee numeric(12,2);
alter table organizations add column billing_notes text;

-- Read-only cross-tenant visibility for the admin panel's organization list
-- (RLS policies are additive/OR'd with each table's existing per-org ones).
create policy platform_admin_org_select on organizations for select
  using (is_platform_admin());
create policy platform_admin_memberships_select on memberships for select
  using (is_platform_admin());
create policy platform_admin_workers_select on workers for select
  using (is_platform_admin());

-- All plan/subscription/fee writes go through this function rather than a
-- direct table update — plan, subscription_status, monthly_fee, and
-- billing_notes are never column-granted to `authenticated`, so this is the
-- only path capable of changing them, regardless of RLS policy state.
create or replace function public.update_organization_billing(
  p_org_id uuid,
  p_plan text,
  p_subscription_status text,
  p_monthly_fee numeric,
  p_billing_notes text
) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype;
begin
  if not is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  update organizations set
    plan = coalesce(p_plan, plan),
    subscription_status = coalesce(p_subscription_status, subscription_status),
    monthly_fee = p_monthly_fee,
    billing_notes = p_billing_notes
  where id = p_org_id
  returning * into v_org;

  if v_org.id is null then
    raise exception 'Organization not found';
  end if;

  return v_org;
end; $$;

-- Bootstrap the first platform admin. No-op if this email hasn't signed up
-- in this Supabase project yet — re-run after they do, if needed.
insert into platform_admins (user_id)
select id from auth.users where email = 'sufyan.afzalk@gmail.com'
on conflict (user_id) do nothing;
