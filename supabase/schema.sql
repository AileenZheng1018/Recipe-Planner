-- 在 Supabase Dashboard -> SQL Editor 中执行此脚本，创建用户信息与物品（库存）表

-- 用户扩展信息（可选，Auth 已有 users）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 启用 RLS
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 新用户注册时自动插入 profile（在 Dashboard -> Database -> Triggers 或用下面函数）
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 物品/库存表（每个用户的食材库存）
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_id text not null,
  quantity_g int not null check (quantity_g >= 0),
  priority text not null default 'normal' check (priority in ('high', 'normal')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, ingredient_id)
);

alter table public.inventory_items enable row level security;

create policy "Users can CRUD own inventory"
  on public.inventory_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 更新 updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists inventory_items_updated on public.inventory_items;
create trigger inventory_items_updated
  before update on public.inventory_items
  for each row execute procedure public.set_updated_at();
