begin;
-- completed_on is a calendar day in the user's timezone, not the UTC day.
create or replace function public.client_calendar_day()
returns date language plpgsql stable security invoker set search_path = pg_catalog as $$
declare zone text;
begin
  zone := coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-client-timezone', 'UTC');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = zone) then
    zone := 'UTC';
  end if;
  return (now() at time zone zone)::date;
end;
$$;
revoke all on function public.client_calendar_day() from public, anon;
grant execute on function public.client_calendar_day() to authenticated;
alter table public.goals drop constraint goals_completed_on_check;
alter table public.goals add constraint goals_completed_on_check
  check(completed_on <= public.client_calendar_day());
commit;
