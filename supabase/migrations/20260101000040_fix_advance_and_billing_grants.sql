-- SECURITY FIX — column-level REVOKE cannot narrow a coexisting
-- table-level GRANT for the same role. 20260101000039 (and, on hosted
-- Supabase, the platform's own automatic project bootstrap before that)
-- both grant blanket `update` on every public table to `authenticated`.
-- The column-scoped revokes already in the migration history —
-- `revoke update (advance_balance) on workers from authenticated` in
-- 20260101000003 chief among them — never actually took effect against
-- that table-level grant, because Postgres privilege checks pass if a
-- role holds *either* the table-level privilege *or* the column-level
-- one; narrowing requires removing the table-level grant and re-stating
-- only the columns that should remain writable.
--
-- Confirmed via information_schema.column_privileges (not
-- role_table_grants, which only shows table-level grants and masked
-- this) that, before this migration, any authenticated org owner could
-- PATCH workers.advance_balance directly — bypassing
-- finalize_weekly_slip()/reopen_weekly_slip() and its advance-delta
-- bookkeeping entirely — and any org owner could PATCH
-- organizations.subscription_status / monthly_fee / paid_until directly,
-- bypassing update_organization_billing()'s is_platform_admin() check
-- and the entire proof-upload-and-review billing workflow. Confirmed
-- identical on production; this predates and is unrelated to any schema
-- change made this session.
--
-- Fix: revoke the blanket table-level UPDATE on both tables for
-- `authenticated`, then re-grant UPDATE on exactly the columns the app
-- actually writes to directly via a plain table update. Every other
-- column already goes through a SECURITY DEFINER function that layers
-- its own has_org_role()/is_platform_admin() check — set_worker_active,
-- set_worker_payment_type, finalize_weekly_slip, reopen_weekly_slip,
-- update_organization_billing, review_payment_submission,
-- admin_rename_organization, create_organization, set_org_hidden_nav_tabs
-- (see 20260101000017) — none of those need a table-level grant, since a
-- SECURITY DEFINER function runs as its owner, not as the caller.

revoke update on workers from authenticated;
grant update (
  worker_code, name, father_name, contact_no, designation, address,
  cnic, date_of_birth, photo_url
) on workers to authenticated;
-- Deliberately NOT granted: advance_balance (finalize/reopen only),
-- is_active (set_worker_active only), employment_type, weekly_salary
-- (set_worker_payment_type only) — see 20260101000027's own comment,
-- which already documented this intent for admin; it turns out owner
-- needed the same column-level restriction and didn't have it.

revoke update on organizations from authenticated;
grant update (
  name, week_start_day, timezone, currency, date_format, show_decimals,
  standard_days_per_week, standard_hours_per_day, overtime_rate_multiplier,
  week_scheme_previous_start_day, week_scheme_transition_date
) on organizations to authenticated;
-- Deliberately NOT granted: subscription_status, monthly_fee,
-- billing_notes, trial_ends_at, subscribed_at, paid_until,
-- suspension_note (all update_organization_billing/
-- review_payment_submission only), hidden_nav_tabs (its own RPC only).
