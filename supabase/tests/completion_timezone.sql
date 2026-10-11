begin;
select set_config('request.headers', '{"x-client-timezone":"Asia/Qyzylorda"}', true);
do $$
begin
  if public.client_calendar_day() <> (now() at time zone 'Asia/Qyzylorda')::date then
    raise exception 'Local calendar date mismatch';
  end if;
end $$;
create temp table completion_date_check(completed_on date check(completed_on <= public.client_calendar_day()));
insert into completion_date_check values(public.client_calendar_day());
do $$
begin
  begin
    insert into completion_date_check values(public.client_calendar_day() + 1);
    raise exception 'Future date accepted';
  exception when check_violation then null;
  end;
end $$;
select set_config('request.headers', '{"x-client-timezone":"invalid-zone"}', true);
do $$ begin
  if public.client_calendar_day() <> (now() at time zone 'UTC')::date then
    raise exception 'Timezone fallback mismatch';
  end if;
end $$;
rollback;
