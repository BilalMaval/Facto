-- Per-organization display preference for how dates are formatted
-- throughout the app (list/table displays — native <input type="date">
-- pickers still render in the browser's own locale format, which can't be
-- overridden). Defaults to ISO (unchanged from current behavior).
alter table organizations add column if not exists date_format text not null default 'YYYY-MM-DD';
alter table organizations drop constraint if exists organizations_date_format_check;
alter table organizations add constraint organizations_date_format_check
  check (date_format in ('YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD MMM YYYY'));
