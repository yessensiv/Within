-- Аккаунты, созданные до установки триггера, тоже должны иметь профиль.
-- Существующие профили и их настройки не изменяются.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', '')
from auth.users
on conflict (id) do nothing;
