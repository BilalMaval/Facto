-- The free-text "plan" field was purely decorative (defaulted to 'free',
-- never actually set by anyone) and sat confusingly next to Status and the
-- multi-business indicator. Replaced by a computed Free Trial / Basic /
-- Premium value derived from real billing data (see
-- src/lib/billing.ts:deriveOrgPlan) — nothing to type, nothing to drift out
-- of sync.
drop function if exists public.update_organization_billing(uuid, text, text, numeric, text);

create or replace function public.update_organization_billing(
  p_org_id uuid, p_subscription_status text, p_monthly_fee numeric, p_billing_notes text
) returns organizations
language plpgsql security definer set search_path = public as $$
declare v_org organizations%rowtype;
begin
  if not is_platform_admin() then raise exception 'Not authorized'; end if;

  update organizations set
    subscription_status = coalesce(p_subscription_status, subscription_status),
    monthly_fee = p_monthly_fee,
    billing_notes = p_billing_notes
  where id = p_org_id
  returning * into v_org;

  if v_org.id is null then raise exception 'Organization not found'; end if;
  return v_org;
end; $$;

alter table organizations drop column plan;
