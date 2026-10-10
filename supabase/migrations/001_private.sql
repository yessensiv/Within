-- Этап 2. Приватные данные и аккаунты.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', avatar_path text,
 is_public boolean not null default false,
 public_slug text check(public_slug is null or length(public_slug)>=12),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index profiles_public_slug on public.profiles(public_slug) where public_slug is not null;
create table public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(trim(title))>0), description text, category text not null default 'Личное' check(category in ('Путешествия','Карьера','Здоровье','Деньги','Творчество','Отношения','Личное')),
 cover_path text, completed_on date check(completed_on<=current_date),is_public boolean not null default false,
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id)
);
create table public.notes (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,title text not null default '',body text not null default '',pinned boolean not null default false,goal_id uuid,
 deleted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(goal_id,user_id) references public.goals(id,user_id) on delete set null (goal_id)
);
create table public.memories (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,goal_id uuid not null unique,body text not null default '',is_public boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade
);
create index goals_owner on public.goals(user_id,deleted_at,completed_on desc);
create index notes_owner on public.notes(user_id,deleted_at,pinned,updated_at desc);
create index notes_goal on public.notes(goal_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now();return new;end; $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));return new;end; $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create trigger create_profile after insert on auth.users for each row execute function public.handle_new_user();
do $$ declare t text; begin foreach t in array array['profiles','goals','notes','memories'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 if t='profiles' then
 execute 'create policy owner_select on public.profiles for select to authenticated using(id=auth.uid())';
 execute 'create policy owner_insert on public.profiles for insert to authenticated with check(id=auth.uid())';
 execute 'create policy owner_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid())';
 execute 'create policy owner_delete on public.profiles for delete to authenticated using(id=auth.uid())';
 else
 execute format('create policy owner_select on public.%I for select to authenticated using(user_id=auth.uid())',t);
 execute format('create policy owner_insert on public.%I for insert to authenticated with check(user_id=auth.uid())',t);
 execute format('create policy owner_update on public.%I for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
 execute format('create policy owner_delete on public.%I for delete to authenticated using(user_id=auth.uid())',t);
 end if;end loop;end $$;
-- Единственная атомарная операция конвертации; блокировка не допускает двух целей для одной записи.
create function public.goal_from_note(note_id uuid,goal jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare n public.notes; target uuid;
begin
 select * into n from public.notes where id=note_id and user_id=auth.uid() and deleted_at is null for update;
 if not found then raise exception 'Запись недоступна';end if;
 if n.goal_id is not null then return n.goal_id;end if;
 target=(goal->>'id')::uuid;
 insert into public.goals(id,user_id,title,description,category,cover_path) values(target,auth.uid(),goal->>'title',goal->>'description',coalesce(goal->>'category','Личное'),goal->>'cover_path');
 update public.notes set goal_id=target where id=n.id;
 return target;
end $$;
revoke all on function public.goal_from_note(uuid,jsonb) from public,anon;
grant execute on function public.goal_from_note(uuid,jsonb) to authenticated;
create function public.purge_my_trash() returns void language sql security invoker set search_path = '' as $$
 delete from public.notes where user_id=auth.uid() and deleted_at < now()-interval '30 days';
 delete from public.goals where user_id=auth.uid() and deleted_at < now()-interval '30 days';
$$;
revoke all on function public.purge_my_trash() from public,anon;
grant execute on function public.purge_my_trash() to authenticated;

