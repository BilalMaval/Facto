-- Billing cycle fields. subscribed_at/paid_until are the anchor-preserving
-- cycle tracker: paid_until always advances by exactly +1 month from its own
-- previous value on renewal (never from "today"), which is what keeps the
-- due date pinned to the original subscription day-of-month even when a
-- renewal payment is late. Effective status (trial/active/grace/suspended)
-- is computed live from these in src/lib/billing.ts — nothing here depends
-- on a cron job running for access control to be correct.
alter table organizations
  add column trial_ends_at timestamptz,
  add column subscribed_at date,
  add column paid_until date,
  add column suspension_note text;

create or replace function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  insert into organizations (name, subscription_status, trial_ends_at, monthly_fee)
    values (p_name, 'trial', now() + interval '3 days', 1599)
    returning id into v_org_id;
  insert into memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'owner');
  return v_org_id;
end; $$;

create table payment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('easypaisa','jazzcash','bank_transfer')),
  transaction_reference text not null,
  payment_date date not null,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text
);
create index on payment_submissions(organization_id);
create index on payment_submissions(status);

alter table payment_submissions enable row level security;

create policy payment_submissions_select on payment_submissions for select
  using (has_org_role(organization_id, array['owner','admin']) or is_platform_admin());
create policy payment_submissions_insert on payment_submissions for insert
  with check (has_org_role(organization_id, array['owner','admin']) and submitted_by = auth.uid());
revoke update, delete on payment_submissions from authenticated; -- status changes only via review_payment_submission()

-- Platform-admin approval/rejection. On approval, advances the billing
-- cycle using the anchor-preserving math described above.
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

  return v_sub;
end; $$;

-- Manual override escape hatch for the super admin (goodwill extensions,
-- corrections) — separate from the plan/status/fee form in
-- update_organization_billing().
create or replace function public.admin_adjust_billing_dates(
  p_org_id uuid, p_subscribed_at date, p_paid_until date, p_suspension_note text
) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  update organizations set
    subscribed_at = p_subscribed_at,
    paid_until = p_paid_until,
    suspension_note = p_suspension_note
  where id = p_org_id
  returning * into v_org;

  if v_org.id is null then raise exception 'Organization not found'; end if;
  return v_org;
end; $$;

-- path convention: payment-proofs/{organization_id}/{submission_id}/{filename}
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
on conflict do nothing;

create policy payment_proofs_select on storage.objects for select
  using (
    bucket_id = 'payment-proofs' and
    (has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']) or is_platform_admin())
  );
create policy payment_proofs_write on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']));
