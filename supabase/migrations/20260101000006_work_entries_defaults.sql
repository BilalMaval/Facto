-- rate_snapshot and amount are always overwritten by trg_work_entries_before_write
-- before the row is stored. These defaults exist only so the generated
-- TypeScript Insert type treats them as optional — they never actually persist.
alter table work_entries alter column rate_snapshot set default 0;
alter table work_entries alter column amount set default 0;
