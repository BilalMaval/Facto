-- Changing Week Start Day mid-cycle can't just apply retroactively or wait
-- for a "clean" boundary — the two schemes' anchor days (Monday, Saturday)
-- aren't 7 days apart, so their natural week boundaries overlap rather than
-- meeting cleanly (Saturday is simultaneously the last working day of a
-- Mon-Sat week and the first working day of a Sat-Thu week). The only
-- correct transition is: everything up to and including the day the
-- setting was changed stays under the OLD scheme; a short "bridge" week
-- covers whatever days are left until the NEW scheme's next anchor day;
-- every week after that is a normal, fully-aligned week under the new
-- scheme. These two columns are what let the app reconstruct that bridge
-- on demand (see resolveWeekBounds/resolveCountedWeekStart in the app
-- layer) — they're a single most-recent transition record, not unlimited
-- history, which is fine given switching schemes is meant to be rare.
alter table organizations add column if not exists week_scheme_previous_start_day text
  check (week_scheme_previous_start_day in ('monday', 'saturday'));
alter table organizations add column if not exists week_scheme_transition_date date;
