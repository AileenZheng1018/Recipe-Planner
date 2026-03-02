# 数据模型规范

为保证 Agent 评分、宏量计算与库存逻辑一致，所有 JSON 与 API 遵循以下规范。

## 1. 食材 `ingredients.json`

- **key**: 食材 ID（如 `chicken_breast`）。
- **结构**（与 scoring 一致）：

```json
{
  "id": "chicken_breast",
  "nutrition_per_100g": {
    "calories": 165,
    "protein": 31,
    "carbs": 0,
    "fat": 3.6,
    "fiber": 0
  },
  "price_per_kg": 5.99,
  "availability": { "UK": 0.2, "CN": 0.45 },
  "storage": {
    "room_temp_days": null,
    "refrigerated_days": 2,
    "frozen_days": 90
  }
}
```

- **营养**：统一按 **100g**。
- **价格**：统一 **price_per_kg**（元/公斤）。
- **availability**：按地区 0–1，数值越高表示越难买，用于 `availability_penalty`。
- **storage**：保质期天数，用于库存 urgency / 优先消耗计算。

## 2. 食谱 `recipes.json`

- **key**: 食谱 ID。
- **结构**：

```json
{
  "name": "鸡胸西兰花",
  "name_zh": "鸡胸西兰花",
  "name_en": "Chicken Broccoli",
  "ingredients": { "chicken_breast": 150, "broccoli": 150 },
  "servings": 1,
  "meal_type": ["lunch", "dinner"]
}
```

- **ingredients**：`ingredient_id -> 克数`，与 `ingredients.json` 的 ID 一致，用于宏量、成本、可用性计算。

## 3. 库存（API / 数据库）

- **单条库存**：
  - `ingredient_id`: 对应 ingredients 的 ID。
  - `quantity_g`: 克数。
  - `priority`: `"high"` | `"normal"`，优先消耗 high。
  - `purchased_at`: 购买日期（可选），用于计算 `days_since_purchase`。
  - `storage_type`: `"room_temp"` | `"refrigerated"` | `"frozen"`（可选），用于 urgency。

Scoring 使用：
- `inventory_usage_score`：有库存则加分，high 优先更高。
- `freshness_adjustment`：结合 `days_since_purchase` 与食材 `storage.*_days` 做 urgency 加分（快过期的优先用）。

## 4. 评分组成（Agent）

```
score = inventory_usage_score + freshness_adjustment
        - macro_penalty - budget_penalty - availability_penalty
        - new_ingredient_penalty - diversity_penalty
        + user_preference_bonus
```

各 component 为独立函数，便于单测与调参。
