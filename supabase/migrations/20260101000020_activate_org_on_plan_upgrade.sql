-- Paying for the Premium multi-business upgrade should also settle the
-- submitting org's own subscription, the same way a regular 'subscription'
-- payment does. Previously plan_upgrade approval only flipped owner_plans,
-- leaving the org's own subscribed_at/paid_until untouched — so an owner
-- could pay real money and their business's Status stayed stuck on
-- Trial/Pending, next to a Plan column that already said "Premium". The
-- whole point of paying is to become an active, paying customer.
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

    if v_sub.purpose = 'plan_upgrade' then
      insert into owner_plans (user_id, tier, upgraded_at)
        values (v_sub.submitted_by, 'premium', now())
      on conflict (user_id) do update set tier = 'premium', upgraded_at = now();
    end if;
  end if;

  return v_sub;
end; $$;

-- Backfill: any already-approved plan_upgrade submission whose org was
-- never activated under the old logic (owner_plans got set, but the org
-- itself was skipped) — bring it in line using that submission's original
-- payment_date, so already-Premium orgs stop showing Trial/Pending.
with to_fix as (
  select distinct on (ps.organization_id) ps.organization_id, ps.payment_date
  from payment_submissions ps
  join organizations o on o.id = ps.organization_id
  where ps.purpose = 'plan_upgrade'
    and ps.status = 'approved'
    and o.subscribed_at is null
  order by ps.organization_id, ps.payment_date asc
)
update organizations o set
  subscribed_at = tf.payment_date,
  paid_until = (tf.payment_date + interval '1 month' - interval '1 day')::date,
  subscription_status = 'active', suspension_note = null
from to_fix tf
where o.id = tf.organization_id;
