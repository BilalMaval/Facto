-- Singleton settings row the super admin configures once: payment
-- instructions shown on the business-owner billing page, support contact,
-- and the plan's advertised price/features.
create table platform_settings (
  id boolean primary key default true check (id),
  easypaisa_number text,
  jazzcash_number text,
  bank_name text,
  bank_account_title text,
  bank_account_number text,
  bank_iban text,
  support_email text,
  plan_price numeric(12,2) not null default 1599,
  plan_features text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

insert into platform_settings (id) values (true);

alter table platform_settings enable row level security;

create policy platform_settings_select on platform_settings for select using (auth.uid() is not null);
create policy platform_settings_update on platform_settings for update
  using (is_platform_admin()) with check (is_platform_admin());
revoke insert, delete on platform_settings from authenticated;
