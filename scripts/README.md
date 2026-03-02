# 脚本说明

## 爬虫：crawl_recipes.py

从 **TheMealDB** 免费 API 拉取**食谱**与**食材**，转换为本项目 `recipes.json` / `ingredients.json` 格式并**存到本地**。

### 依赖

```bash
pip install requests
```

### 用法

**食谱**

```bash
# 按地区拉取最多 50 道 -> scripts/crawled_recipes.json
python scripts/crawl_recipes.py

# 最多拉取 30 道
python scripts/crawl_recipes.py --max 30

# 按类别拉取（如 Chicken, Beef）
python scripts/crawl_recipes.py --by-category

# 拉取后合并进 recipes.json（不覆盖已有 recipe_id）
python scripts/crawl_recipes.py --merge
```

**食材**

```bash
# 拉取食材列表 -> scripts/crawled_ingredients.json
python scripts/crawl_recipes.py --ingredients

# 拉取食材并合并进 ingredients.json（不覆盖已有 id）
python scripts/crawl_recipes.py --ingredients --merge-ingredients

# 只拉食材、不拉食谱
python scripts/crawl_recipes.py --ingredients --max 0
```

### 食材映射与输出

- **食谱**：`ingredient_mapping.json` 将 API 食材名映射到本项目 `ingredient_id`；未映射的食材会跳过。爬取 ID 形如 `mealdb_52772`。
- **食材**：API 的 `strIngredient` / `strType` 转为本地结构（category、nutrition_per_100g、price_per_kg、availability、storage），ID 形如 `mealdb_chicken_breast`。营养/价格为占位，可后续手工或其它 API 补全。
