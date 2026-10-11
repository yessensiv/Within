begin;
update public.profiles set is_public = false where is_public;
update public.goals set is_public = false where is_public;
update public.memories set is_public = false where is_public;
-- Keep the schema compatible with private user data; disable public access.
create or replace function public.public_profile_by_slug(slug text)
returns table(display_name text) language sql stable security definer set search_path = '' as $$
  select null::text where false;
$$;
create or replace function public.public_goals_by_slug(slug text)
returns table(title text,category text,completed_on date,body text)
language sql stable security definer set search_path = '' as $$
  select null::text,null::text,null::date,null::text where false;
$$;
revoke all on function public.public_profile_by_slug(text) from public, anon, authenticated;
revoke all on function public.public_goals_by_slug(text) from public, anon, authenticated;
commit;
