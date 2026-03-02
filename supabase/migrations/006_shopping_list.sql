-- 购物清单按周持久化：生成计划后写入，勾选「已购入」后更新并移入库存
create table if not exists public.shopping_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, week_start)
);

alter table public.shopping_lists enable row level security;

create policy "Users can CRUD own shopping lists"
  on public.shopping_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists shopping_lists_updated on public.shopping_lists;
create trigger shopping_lists_updated
  before update on public.shopping_lists
  for each row execute procedure public.set_updated_at();

comment on table public.shopping_lists is 'Shopping list items per user per week (week_start = Monday). items: array of { ingredient_id, nameEn, nameZh, plannedQty, actualQty, price }.';
