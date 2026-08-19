-- The finalized-week lock on attendance writes (attendance_before_write, in
-- 20260101000033_attendance_tracking.sql) computed "which week does this
-- date belong to" using only the org's CURRENT week_start_day — it never
-- learned about week_scheme_previous_start_day/week_scheme_transition_date
-- when that transition system was added later
-- (20260101000036_week_scheme_transition.sql), so it silently drifted out
-- of sync with the transition-aware boundaries the rest of the app uses
-- (resolveWeekBounds in lib/dates.ts). Concretely: right after a Week Start
-- Day change, a date that the app correctly places in a new, still-draft
-- week could get misclassified by this trigger as belonging to an old,
-- already-finalized week that happens to share the same naive week_start —
-- and the write would be wrongly rejected with "This date falls in a
-- finalized week."
--
-- These functions are a direct SQL port of the same-named functions in
-- lib/dates.ts (weekStartOf, nextAnchorAfter, nextAnchorOnOrAfter,
-- resolveWeekBounds) — keep them in sync if that file's algorithm ever
-- changes. Only the week START is needed here (not the end), since the
-- lock check only ever needs to know which weekly_slips.week_start a date
-- resolves to.

-- Monday=1 .. Saturday=6 anchor day (Postgres extract(dow): Sunday=0).
create or replace function public.week_anchor_day(p_week_start_day text) returns int
language sql immutable as $$
  select case p_week_start_day when 'saturday' then 6 else 1 end;
$$;

create or replace function public.week_start_of(p_date date, p_week_start_day text) returns date
language sql immutable as $$
  select p_date - ((extract(dow from p_date)::int - public.week_anchor_day(p_week_start_day) + 7) % 7);
$$;

-- The smallest date strictly after p_date that itself anchors a week under
-- p_week_start_day.
create or replace function public.next_anchor_after(p_date date, p_week_start_day text) returns date
language plpgsql immutable as $$
declare v_candidate date;
begin
  for i in 1..7 loop
    v_candidate := p_date + i;
    if public.week_start_of(v_candidate, p_week_start_day) = v_candidate then
      return v_candidate;
    end if;
  end loop;
  return p_date + 7; -- unreachable — a matching day-of-week always occurs within 7 days
end; $$;

-- Unlike next_anchor_after, recognizes p_date itself as a valid anchor —
-- lets a scheme transition start its first clean week the same day when
-- the transition date already happens to be the new scheme's anchor day.
create or replace function public.next_anchor_on_or_after(p_date date, p_week_start_day text) returns date
language sql immutable as $$
  select case when public.week_start_of(p_date, p_week_start_day) = p_date
    then p_date
    else public.next_anchor_after(p_date, p_week_start_day)
  end;
$$;

-- The week_start that p_date resolves into, aware of a pending scheme
-- transition exactly like resolveWeekBounds in lib/dates.ts: before the new
-- scheme's first clean anchor day, classified under the OLD scheme; on/after
-- it, under the new scheme.
create or replace function public.resolve_week_start(
  p_date date, p_week_start_day text, p_previous_week_start_day text, p_transition_date date
) returns date
language plpgsql immutable as $$
declare v_clean_anchor date;
begin
  if p_previous_week_start_day is not null and p_transition_date is not null then
    v_clean_anchor := public.next_anchor_on_or_after(p_transition_date, p_week_start_day);
    if p_date < v_clean_anchor then
      return public.week_start_of(p_date, p_previous_week_start_day);
    end if;
  end if;
  return public.week_start_of(p_date, p_week_start_day);
end; $$;

create or replace function public.attendance_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org organizations%rowtype; v_date date; v_week_start date; v_locked boolean;
begin
  v_date := coalesce(new.attendance_date, old.attendance_date);
  select * into v_org from organizations where id = coalesce(new.organization_id, old.organization_id);
  v_week_start := public.resolve_week_start(
    v_date, v_org.week_start_day, v_org.week_scheme_previous_start_day, v_org.week_scheme_transition_date
  );

  select exists (
    select 1 from weekly_slips
    where organization_id = coalesce(new.organization_id, old.organization_id)
      and worker_id = coalesce(new.worker_id, old.worker_id)
      and status = 'finalized'
      and week_start = v_week_start
  ) into v_locked;
  if v_locked then raise exception 'This date falls in a finalized week. Reopen the week first.'; end if;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end; $$;
