-- LOCAL-DEVELOPMENT PARITY FIX — not a business-logic or RLS change.
--
-- Every one of this project's RLS policies has always assumed the
-- `anon`/`authenticated` Postgres roles already hold baseline table-level
-- privileges (SELECT/INSERT/UPDATE/DELETE) on every public table — RLS only
-- ever narrows access further, it never grants it. On Supabase's hosted
-- platform, those baseline grants are set up automatically and invisibly
-- the moment a project is created via the dashboard/API; no migration file
-- in this repo ever had to state them, because they already existed before
-- the first migration ever ran.
--
-- A local Postgres instance started via `supabase start` has no such
-- platform bootstrapping — it only ever has what these migration files
-- state. Without this migration, every table-level query gets
-- "permission denied for table X" regardless of how correct its RLS
-- policies are, since a role needs the underlying grant before RLS is
-- even evaluated. This was found and confirmed by comparing
-- information_schema.role_table_grants between local and production
-- (production has the full baseline on every table; local had none).
--
-- This grants the exact same baseline production already has, then
-- reapplies — verbatim, same tables, same columns, same comments — every
-- `revoke`/column-scoped `grant` already present in this migration
-- history, so the net privilege state exactly matches production, table
-- for table, role for role. Nothing here changes what any table's RLS
-- policies allow; it only makes the baseline those policies have always
-- silently depended on explicit and reproducible outside the hosted
-- platform.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- Verbatim from 20260101000003_rls.sql:
revoke insert on organizations from authenticated;         -- creation only via create_organization()
grant update (name) on organizations to authenticated;      -- plan/subscription_status stay locked for future Stripe webhook
revoke insert on memberships from authenticated;            -- creation only via create_organization()/accept_invitation()
revoke insert, update, delete on invitations from authenticated; -- all writes via create/accept/revoke_invitation()
revoke update (advance_balance) on workers from authenticated;  -- mutable only via finalize/reopen functions
revoke insert, update, delete on weekly_slips from authenticated; -- all writes via finalize_weekly_slip()/reopen_weekly_slip()

-- Verbatim from 20260101000010_week_start_day.sql:
grant update (week_start_day) on organizations to authenticated;

-- Verbatim from 20260101000012_billing_engine.sql:
revoke update, delete on payment_submissions from authenticated; -- status changes only via review_payment_submission()

-- Verbatim from 20260101000013_platform_settings.sql:
revoke insert, delete on platform_settings from authenticated;

-- Verbatim from 20260101000014_support_tickets.sql:
revoke insert, update, delete on support_tickets from authenticated; -- all writes via functions below
revoke insert, update, delete on support_ticket_messages from authenticated;

-- Verbatim from 20260101000017_nav_visibility_and_multi_business.sql:
revoke insert, update, delete on owner_plans from authenticated; -- written only via review_payment_submission()
