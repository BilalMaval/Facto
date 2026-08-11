-- The old `unique (organization_id, email, status)` constraint meant an
-- email could only ever have ONE revoked (or accepted) invitation row per
-- org, ever — so revoking a second invite to the same email (after an
-- earlier one was already revoked), or re-accepting after leaving and
-- being re-invited, hit a spurious duplicate-key error. Only the PENDING
-- state actually needs to stay unique (one active invite per email at a
-- time); revoked/accepted are just history and should be allowed to repeat.
alter table invitations drop constraint if exists invitations_organization_id_email_status_key;
create unique index if not exists invitations_org_email_pending_key
  on invitations (organization_id, email) where status = 'pending';
