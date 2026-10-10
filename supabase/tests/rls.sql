-- Запускать в локальном тестовом Supabase (psql или SQL Editor), после обеих миграций.
-- Всё откатывается. Не использует настоящие аккаунты или пароли.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','{"display_name":"Первый"}'),
 ('22222222-2222-4222-8222-222222222222','{"display_name":"Второй"}');
insert into public.goals(id,user_id,title,category,completed_on,is_public) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Открытая цель','Личное',current_date,true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Чужая цель','Личное',current_date,false),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Приватная цель','Личное',current_date,false),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','Активная цель','Личное',null,true);
insert into public.notes(id,user_id,title,body) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','Приватная запись','Секрет');
insert into public.memories(user_id,goal_id,body,is_public) values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Приватное воспоминание',false);
update public.profiles set is_public=true,public_slug='test-slug-user-one' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.goals)<>3 then raise exception 'RLS SELECT первого пользователя';end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'RLS профиля';end if;
 update public.goals set title='Взлом' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 if found then raise exception 'RLS UPDATE чужой строки';end if;
 delete from public.goals where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 if found then raise exception 'RLS DELETE чужой строки';end if;
 begin
 insert into public.goals(user_id,title) values('22222222-2222-4222-8222-222222222222','Взлом');
 raise exception 'INSERT WITH CHECK отсутствует';
 exception when insufficient_privilege then null;end;
 begin
 update public.goals set user_id='22222222-2222-4222-8222-222222222222' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 raise exception 'UPDATE WITH CHECK отсутствует';
 exception when insufficient_privilege then null;end;
 begin
 update public.notes set goal_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 raise exception 'Можно привязать чужую цель';
 exception when foreign_key_violation then null;end;
 begin
 insert into public.memories(user_id,goal_id) values('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 raise exception 'Можно привязать чужое воспоминание';
 exception when foreign_key_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin if (select count(*) from public.goals)<>1 then raise exception 'RLS второго пользователя';end if;if (select count(*) from public.notes)<>0 then raise exception 'Утечка блокнота';end if;if (select count(*) from public.memories)<>0 then raise exception 'Утечка воспоминания';end if;end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 begin perform * from public.profiles;raise exception 'anon читает таблицу';exception when insufficient_privilege then null;end;
 begin perform * from public.goals;raise exception 'anon читает цели';exception when insufficient_privilege then null;end;
 begin perform * from public.notes;raise exception 'anon читает блокнот';exception when insufficient_privilege then null;end;
 if (select count(*) from public.public_profile_by_slug('test-slug-user-one'))<>1 then raise exception 'Публичное имя недоступно';end if;
 if (select count(*) from public.public_goals_by_slug('test-slug-user-one'))<>1 then raise exception 'Утечка приватной или активной цели';end if;
 if (select body from public.public_goals_by_slug('test-slug-user-one')) is not null then raise exception 'Приватное воспоминание раскрыто';end if;
 if exists(select * from public.public_profile_by_slug('missing-slug')) then raise exception 'Несуществующий профиль';end if;
end $$;
reset role;
update public.memories set is_public=true where goal_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role anon;
do $$ begin if (select body from public.public_goals_by_slug('test-slug-user-one'))<>'Приватное воспоминание' then raise exception 'Публичное воспоминание недоступно';end if;end $$;
reset role;
update public.profiles set is_public=false where id='11111111-1111-4111-8111-111111111111';
set local role anon;
do $$ begin
 if exists(select * from public.public_profile_by_slug('test-slug-user-one')) or exists(select * from public.public_goals_by_slug('test-slug-user-one')) then raise exception 'Выключенный профиль раскрывается';end if;
end $$;
reset role;
rollback;
