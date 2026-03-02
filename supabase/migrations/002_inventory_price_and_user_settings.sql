-- 库存表：记录购入价格和日期（用于统计支出）
alter table public.inventory_items
  add column if not exists price_paid numeric,
  add column if not exists purchased_at date;

-- 用户设置：预算与目标（限制与目标可在此调整）
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  budget_weekly numeric default 50,
  max_new_ingredients int default 5,
  goal_protein_per_day numeric default 130,
  goal_calories_per_day numeric default 2000,
  currency text default 'GBP',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "Users can CRUD own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_settings_updated on public.user_settings;
create trigger user_settings_updated
  before update on public.user_settings
  for each row execute procedure public.set_updated_at();
