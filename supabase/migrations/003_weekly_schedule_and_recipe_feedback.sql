-- 每周用餐时间表（用于系统推荐与提醒）
create table if not exists public.user_weekly_schedule (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  breakfast_time time default '08:00',
  lunch_time time default '13:00',
  dinner_time time default '19:30',
  primary key (user_id, day_of_week)
);

alter table public.user_weekly_schedule enable row level security;

create policy "Users can CRUD own weekly schedule"
  on public.user_weekly_schedule for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 计划中的单餐（对接后端生成结果 + 用户实际用时学习）
create table if not exists public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  recipe_id text not null,
  meal_time time,
  cook_duration_mins int,
  actual_started_at timestamptz,
  actual_duration_mins int,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, plan_date, meal_type)
);

alter table public.planned_meals enable row level security;

create policy "Users can CRUD own planned meals"
  on public.planned_meals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists planned_meals_updated on public.planned_meals;
create trigger planned_meals_updated
  before update on public.planned_meals
  for each row execute procedure public.set_updated_at();

-- 用户对某道菜的实际用时（用于学习个性化做饭时长）
create table if not exists public.recipe_cook_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  actual_duration_mins int not null,
  recorded_at timestamptz default now()
);

alter table public.recipe_cook_feedback enable row level security;

create policy "Users can CRUD own recipe cook feedback"
  on public.recipe_cook_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 用户食谱偏好（后续可接入爬虫 + 学习）
create table if not exists public.user_recipe_preference (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  liked boolean,
  last_cooked_at timestamptz,
  primary key (user_id, recipe_id)
);

alter table public.user_recipe_preference enable row level security;

create policy "Users can CRUD own recipe preference"
  on public.user_recipe_preference for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
