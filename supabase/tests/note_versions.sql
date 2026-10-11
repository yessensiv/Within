-- Run after 004 as postgres in a test project. All fixtures roll back.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('55555555-5555-4555-8555-555555555555','{"display_name":"History test"}'),
 ('66666666-6666-4666-8666-666666666666','{"display_name":"Other test"}');
insert into public.notes(id,user_id,title,body) values
 ('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','Original','Original text');
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
update public.notes set body='New text' where id='77777777-7777-4777-8777-777777777777';
do $$ begin
 if (select count(*) from public.note_versions where body='Original text') <> 1 then raise exception 'Previous text missing'; end if;
end $$;
update public.notes set pinned=true where id='77777777-7777-4777-8777-777777777777';
do $$ begin
 if (select count(*) from public.note_versions) <> 1 then raise exception 'Metadata generated version'; end if;
end $$;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',true);
do $$ begin
 if exists(select 1 from public.note_versions) then raise exception 'Other user sees versions'; end if;
 begin
  insert into public.note_versions(note_id,user_id,title,body) values
  ('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','Invalid','Invalid');
  raise exception 'Foreign note accepted';
 exception when foreign_key_violation then null;
 end;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.note_versions','SELECT') then raise exception 'Anon can read history'; end if;
end $$;
rollback;
