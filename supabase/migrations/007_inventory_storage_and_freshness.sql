-- 库存时间维度：存放类型 + 保质/过期相关，用于 urgency / 优先消耗
alter table public.inventory_items
  add column if not exists storage_type text check (storage_type is null or storage_type in ('room_temp', 'refrigerated', 'frozen')),
  add column if not exists best_before date;

comment on column public.inventory_items.storage_type is 'room_temp | refrigerated | frozen，与 ingredients.json storage 对应';
comment on column public.inventory_items.best_before is '可选：最佳食用日期，用于 urgency 计算';
comment on column public.inventory_items.purchased_at is '购买日期，可推算 days_since_purchase';
