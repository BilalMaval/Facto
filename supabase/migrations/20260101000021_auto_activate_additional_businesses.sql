-- Every additional business (2nd, 3rd, ...) created by an already-Premium
-- owner is now created already-active — the owner already paid the
-- multi-business fee to unlock the ability to add more, so asking them to
-- separately trial/pay for each new business would be charging twice for
-- the same thing. The owner's very first org is unaffected: it still goes
-- through its own normal pending -> trial/subscribe flow.
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

    insert into organizations (name, subscription_status, monthly_fee, subscribed_at, paid_until, billing_notes)
      values (
        p_name, 'active', 0, current_date, current_date + interval '100 years',
        'Covered under owner''s Premium multi-business plan — no separate subscription required.'
      )
      returning id into v_org_id;
  else
    insert into organizations (name, subscription_status, monthly_fee)
      values (p_name, 'pending', 1599)
      returning id into v_org_id;
  end if;

  insert into memberships (user_id, organization_id, role) values (auth.uid(), v_org_id, 'owner');
  return v_org_id;
end; $$;

-- Backfill: additional businesses created before this fix, under an owner
-- who is already Premium, that never got their own subscription started.
update organizations o set
  subscription_status = 'active',
  monthly_fee = 0,
  subscribed_at = current_date,
  paid_until = current_date + interval '100 years',
  billing_notes = coalesce(
    o.billing_notes,
    'Covered under owner''s Premium multi-business plan — no separate subscription required.'
  )
from memberships m
join owner_plans op on op.user_id = m.user_id
where m.organization_id = o.id
  and m.role = 'owner'
  and op.tier = 'premium'
  and o.subscribed_at is null;
