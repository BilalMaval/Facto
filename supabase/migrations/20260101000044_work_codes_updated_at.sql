-- Lets the work codes page offer "recently modified" sorting alongside the
-- existing created_at. Set explicitly by application code on every write
-- (updateWorkCode, toggleWorkCodeActive) rather than a DB trigger, matching
-- this codebase's existing pattern (see admin/settings/actions.ts,
-- lib/localeActions.ts, app/actions/pushTokens.ts).
alter table work_codes add column updated_at timestamptz not null default now();
