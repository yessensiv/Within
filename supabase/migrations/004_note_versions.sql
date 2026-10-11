-- Private cross-device note history. Apply once after 001–003.
begin;
alter table public.notes add constraint notes_id_user_unique unique (id,user_id);
create table public.note_versions (
 id uuid primary key default gen_random_uuid(),
 note_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, body text not null,
 saved_at timestamptz not null default now(),
 foreign key (note_id,user_id) references public.notes(id,user_id) on delete cascade
);
create index note_versions_owner_note_date on public.note_versions(user_id,note_id,saved_at desc);
alter table public.note_versions enable row level security;
revoke all on public.note_versions from public,anon,authenticated;
grant select,insert on public.note_versions to authenticated;
create policy versions_read on public.note_versions for select to authenticated using(user_id=auth.uid());
create policy versions_import on public.note_versions for insert to authenticated with check(user_id=auth.uid());
create function public.capture_note_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.title is distinct from new.title or old.body is distinct from new.body then
  insert into public.note_versions(note_id,user_id,title,body,saved_at)
  values(old.id,old.user_id,coalesce(old.title,''),coalesce(old.body,''),old.updated_at);
  delete from public.note_versions where note_id=old.id and user_id=old.user_id
  and id in (select id from public.note_versions where note_id=old.id and user_id=old.user_id
             order by saved_at desc,id desc offset 100);
 end if;
 return new;
end $$;
revoke all on function public.capture_note_version() from public,anon,authenticated;
create trigger capture_note_version before update of title,body on public.notes
for each row execute function public.capture_note_version();
commit;
