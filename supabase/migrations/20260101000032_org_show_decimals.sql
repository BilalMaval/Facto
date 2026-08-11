-- Whether amounts always show 2 decimal places, or trim a trailing ".00"
-- for whole numbers (default) to keep tables less crowded. Non-whole
-- amounts (e.g. 150.50) still show their cents either way.
alter table organizations add column if not exists show_decimals boolean not null default false;
