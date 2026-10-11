begin;
alter table public.notes add column tags text[] not null default '{}';
alter table public.notes add constraint note_tags_limit check(cardinality(tags) <= 12);
commit;
