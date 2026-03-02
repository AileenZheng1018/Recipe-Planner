# Recipe Planner — 前端

React + TypeScript + Vite，Supabase 存用户与库存，Vercel 部署。

## 环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 Supabase 的 URL 与 anon key
```

在 [Supabase](https://supabase.com) 项目 **Settings → API** 中复制：
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` → `VITE_SUPABASE_ANON_KEY`

## 数据库

在 Supabase **SQL Editor** 中执行项目根目录下 `supabase/schema.sql`，创建：

- `profiles`：用户扩展信息（可选）
- `inventory_items`：每用户的食材库存（ingredient_id, quantity_g, priority）

并会创建新用户时自动插入 profile 的 trigger。

## 本地运行

```bash
npm install
npm run dev
```

## Vercel 部署

1. 将仓库推送到 GitHub，在 [Vercel](https://vercel.com) 导入该仓库。
2. **Root Directory** 设为 `web`（若前端在子目录）。
3. 在 Vercel 项目 **Settings → Environment Variables** 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 部署即可（Vite 会自动检测，或使用根目录 `web/vercel.json`）。

若仓库根目录就是 `web`，则 Root Directory 留空，环境变量同上。
