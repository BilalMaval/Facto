alter table organizations
  add column week_start_day text not null default 'monday'
    check (week_start_day in ('monday', 'saturday'));

grant update (week_start_day) on organizations to authenticated;
