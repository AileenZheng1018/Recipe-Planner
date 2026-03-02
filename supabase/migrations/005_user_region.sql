-- 用户设置：地区，用于推荐与购物清单中按地区可用食材
alter table public.user_settings
  add column if not exists region text default 'UK';

comment on column public.user_settings.region is 'Region code: UK, CN, etc. Used for availability in plan/shopping.';
