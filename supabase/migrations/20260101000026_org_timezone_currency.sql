-- Per-organization display preferences: what timezone entry/payment
-- timestamps are shown in, and what currency amounts are formatted with.
-- Defaults match this app's original audience (Pakistan) but are editable
-- per org from Settings.
alter table organizations add column if not exists timezone text not null default 'Asia/Karachi';
alter table organizations add column if not exists currency text not null default 'PKR';
