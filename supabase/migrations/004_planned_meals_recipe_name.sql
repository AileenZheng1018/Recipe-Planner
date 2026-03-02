-- 计划中的单餐增加菜名，便于首页展示
alter table public.planned_meals
  add column if not exists recipe_name text;
