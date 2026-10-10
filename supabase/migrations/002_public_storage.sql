-- Этап 3. Публичный доступ только к явно разрешённой проекции.
create function public.public_profile_by_slug(slug text)
returns table(display_name text) language sql stable security definer set search_path = '' as $$
 select p.display_name from public.profiles p where p.public_slug=slug and p.is_public=true;
$$;
create function public.public_goals_by_slug(slug text)
returns table(title text,category text,completed_on date,body text) language sql stable security definer set search_path = '' as $$
 select g.title,g.category,g.completed_on,case when m.is_public then m.body else null end
 from public.profiles p join public.goals g on g.user_id=p.id
 left join public.memories m on m.goal_id=g.id and m.user_id=g.user_id
 where p.public_slug=slug and p.is_public=true and g.is_public=true and g.completed_on is not null and g.deleted_at is null
 order by g.completed_on desc;
$$;
revoke all on function public.public_profile_by_slug(text),public.public_goals_by_slug(text) from public;
grant execute on function public.public_profile_by_slug(text),public.public_goals_by_slug(text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('covers','covers',false,5242880,array['image/jpeg','image/png','image/webp']),('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy world_images_read on storage.objects for select to authenticated using(bucket_id in ('covers','avatars') and (storage.foldername(name))[1]=auth.uid()::text);
create policy world_images_insert on storage.objects for insert to authenticated with check(bucket_id in ('covers','avatars') and (storage.foldername(name))[1]=auth.uid()::text);
create policy world_images_update on storage.objects for update to authenticated using(bucket_id in ('covers','avatars') and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id in ('covers','avatars') and (storage.foldername(name))[1]=auth.uid()::text);
create policy world_images_delete on storage.objects for delete to authenticated using(bucket_id in ('covers','avatars') and (storage.foldername(name))[1]=auth.uid()::text);
-- Если pg_cron уже доступен, ежедневная очистка выполняется ролью владельца миграции.
-- RPC purge_my_trash остаётся security invoker и очищает только данные текущего пользователя.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
 perform cron.schedule('my-world-purge-trash','15 3 * * *',$job$
 delete from public.notes where deleted_at<now()-interval '30 days';
 delete from public.goals where deleted_at<now()-interval '30 days';
 $job$);
 end if;
end $$;
