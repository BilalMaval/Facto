-- Broadcasts changes on every app table over Realtime so both business
-- owners and the platform admin see fresh data live across the whole app —
-- not just support tickets — without ever needing a manual reload. The
-- client only uses the change event as a signal to re-fetch through the
-- normal RLS-protected query path, never reading the broadcast payload
-- itself, so this is safe to enable broadly.
--
-- Wrapped in a existence check per table (rather than a plain series of
-- ALTER PUBLICATION ADD TABLE statements) so this is safe to run even if
-- some of these tables were already added to the publication by hand or by
-- an earlier partial run — ADD TABLE errors instead of no-op'ing when a
-- table is already a member.
do $$
declare
  t text;
  tables text[] := array[
    'organizations', 'memberships', 'invitations',
    'workers', 'work_codes', 'work_entries', 'payments', 'weekly_slips',
    'support_tickets', 'support_ticket_messages',
    'payment_submissions', 'owner_plans', 'platform_settings', 'platform_admins'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
