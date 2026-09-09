-- Per-user preferences that must follow a person across every organization
-- they belong to. This is deliberately separate from organizations' own
-- timezone/currency/date_format columns, which are correctly shared by
-- every member of one org — language is not: a single org can have both
-- English- and Urdu-preferring members (see OrgSwitcher.tsx for the
-- multi-org-per-user model this needs to survive).
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ur')),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy user_settings_select on user_settings for select using (user_id = auth.uid());
create policy user_settings_insert on user_settings for insert with check (user_id = auth.uid());
create policy user_settings_update on user_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Explicit, not inherited: this repo's own history (see
-- 20260101000039_grant_baseline_privileges.sql) shows table-level grants
-- can't be assumed to exist implicitly for a table created after that
-- baseline migration ran, so a new table states its own grants up front.
grant select, insert, update on user_settings to authenticated;
