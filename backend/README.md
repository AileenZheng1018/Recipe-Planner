# Recipe Planner 后端 API

基于 FastAPI，调用 `agent.py` 生成一周餐单与购物清单。

## 安装与运行

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## 接口

- `GET /health` — 健康检查
- `POST /api/plan` — 生成计划  
  - Body: `{ "inventory": { "ingredient_id": { "quantity_g", "priority" } }, "constraints": { "calories_per_day", "protein_min_per_day", "budget_weekly", "max_new_ingredients", "region", "days" } }`  
  - 返回: `{ "daily_meals", "shopping_list", "new_ingredients", "explanations" }`

## 前端对接

在 `web/.env` 中设置 `VITE_API_URL=http://localhost:8000`，计划页点击「生成计划」会请求此 API。
