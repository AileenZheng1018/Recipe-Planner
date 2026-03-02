# Inventory-Aware Nutrition Planning Agent

Hackathon 级「库存感知」一周营养规划 Agent：在满足健康目标与预算下，**优先消耗已有食材**，**最小化新增采购种类**。

---

## 现在应该做什么（当前设备）

若项目已在本地、Supabase 已配好，按顺序做：

1. **启动后端**：在终端执行 `cd 项目路径/backend` → `source .venv/bin/activate`（或新建 venv）→ `pip install -r requirements.txt` → `uvicorn main:app --reload --port 8000`，保持运行。
2. **启动前端**：另开终端，`cd 项目路径/web` → `npm run dev`，浏览器打开提示的地址（如 http://localhost:5173）。
3. **登录 / 使用**：注册或登录后，在**计划页**点「生成计划」即可出餐单与购物清单；左侧设置里可选地区（英国/中国）。
4. **（可选）扩充食谱与做法**：`pip install -r scripts/requirements.txt` 后执行 `python scripts/crawl_recipes.py --max 20 --merge`，会更新 `recipes.json` 与 `recipe_steps.json`。

详细步骤与在新设备上从零运行，见下方 **[在新设备上从零运行](#在新设备上从零运行)**。

---

## 在新设备上从零运行

以下步骤适用于**新电脑 / 新环境**，从拿到代码到本地跑通全栈。  
**「项目根路径」**：指包含 `web/`、`backend/`、`supabase/` 的文件夹（例如 `~/Desktop/Recipe Planner`）。

### 第一步：环境准备

- **Node.js**：建议 18+（前端用）。[nodejs.org](https://nodejs.org) 下载或 `nvm install 18`。
- **Python**：建议 3.10+（后端与爬虫用）。`python3 --version` 确认。
- **Supabase 账号**：用于用户登录与数据库。[supabase.com](https://supabase.com) 注册。

### 第二步：拿到项目代码

- 若用 Git：`git clone <仓库地址>`，然后 `cd Recipe-Planner`（或你的项目目录名）。
- 若是压缩包：解压后进入项目根目录。

### 第三步：创建 Supabase 项目并拿密钥

1. 登录 [Supabase](https://app.supabase.com) → **New project**，选区、设数据库密码，创建。
2. 进入项目后，左侧 **Settings** → **API**：
   - 记下 **Project URL**（如 `https://xxx.supabase.co`）。
   - 记下 **anon public** key（一长串，用于前端）。
3. 左侧 **Authentication** → **Providers**：确认 **Email** 已开启（默认开），如需可开「Confirm email」等。

### 第四步：执行数据库脚本（建表）

1. 在 Supabase 左侧打开 **SQL Editor**。
2. 按顺序执行项目里的 SQL（在项目根目录的 `supabase/` 下）：
   - 先执行 **`supabase/schema.sql`**（建 profiles、inventory_items 等基础表）。
   - 再按顺序执行 **`supabase/migrations/`** 里的文件：`002_...`、`003_...`、`004_...`、`005_...`（每个文件点 New query，粘贴内容，Run）。
3. 执行完无报错即可。

### 第五步：配置前端环境变量

1. 进入前端目录：  
   `cd web`（从项目根目录）。
2. 复制环境变量示例并编辑：  
   `cp .env.example .env`（若无 `.env.example` 则新建 `.env`）。
3. 编辑 **`.env`**，至少填入：
   - `VITE_SUPABASE_URL` = 第三步的 Project URL
   - `VITE_SUPABASE_ANON_KEY` = 第三步的 anon public key
   - `VITE_API_URL=http://localhost:8000`（本地后端地址，不要改除非你改了端口）
4. 保存。

### 第六步：安装前端依赖并启动

在 **`web`** 目录下：

```bash
npm install
npm run dev
```

终端会输出本地地址（如 `http://localhost:5173`）。用浏览器打开即可看到登录页；此时先不点「生成计划」（后端还没开）。

### 第七步：安装后端依赖并启动

1. **新开一个终端**，进入项目根目录再进 backend：  
   `cd 项目根路径/backend`  
   （例如：`cd ~/Desktop/Recipe\ Planner/backend`）
2. 建议使用虚拟环境（避免与系统 Python 冲突）：
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate    # Windows: .venv\Scripts\activate
   ```
3. 安装依赖并启动：
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
4. 看到 `Uvicorn running on http://127.0.0.1:8000` 即表示后端已就绪。**保持此终端运行**。

### 第八步：在浏览器里使用

1. 回到浏览器中已打开的前端页面（第六步的地址）。
2. 注册一个账号（邮箱 + 密码），按提示完成验证（若开启了邮件确认）。
3. 登录后：
   - **首页**：今日餐单（若已「加入计划」会显示）。
   - **库存**：可手动添加食材（支持输入匹配、中英）。
   - **计划与购物**：点「生成计划」生成一周餐单与购物清单；可点某天修改当餐再「确认保存」；左侧设置里可选**地区**（英国/中国）。
4. 右上角可切换 **EN / 中** 语言。

### 第九步：（可选）扩充食谱与做法

若需要更多食谱和完整做法（含中文翻译）：

```bash
cd 项目根路径
pip install -r scripts/requirements.txt
python scripts/crawl_recipes.py --max 20 --merge
```

会从 **TheMealDB**（正规开放食谱数据库）拉取并更新 `recipes.json`、`recipe_steps.json`。数据源单一、结构统一，便于保证「用到」完整：
- **食材**：`scripts/ingredient_mapping.json` 中已映射的用本项目 ID，未映射的用 `mealdb_{slug}` 保留，不再丢弃；合并时自动为缺失食材在 `ingredients.json` 中补 stub（含 `name` 与翻译后的 `name_zh`），首页「用到」由 API 按 stub 返回完整中英文列表。
- 安装 `deep-translator` 后：食谱名、做法、**食材名**均会译成中文（`name_zh`）；做法长文本分块翻译。

若已有英文名食谱缺少中文名（例如早期合并的 mealdb 食谱），可运行一次补全脚本（需先安装 `deep-translator`）：

```bash
pip install deep-translator   # 或使用项目 venv: .venv/bin/pip install deep-translator
python scripts/add_recipe_name_zh.py
```

后端在生成计划时若发现某食谱无 `name_zh` 且名为英文，会尝试用 `deep-translator` 当场翻译并缓存，因此即使未跑上述脚本，安装依赖后中文模式也会显示翻译后的食谱名。

**做法补全**（若 `recipe_steps.json` 中某条为「（做法见英文步骤）」）：
```bash
python scripts/backfill_steps_zh.py   # 需 deep-translator，将英文做法译成中文并写回
```
**内置食谱做法**（若某内置食谱没有对应做法条目）：
```bash
python scripts/add_builtin_steps.py   # 为缺失做法的内置食谱添加 steps_zh/steps_en
```
**已合并的 mealdb 食谱「用到」不完整时**（从 TheMealDB 重新拉取并补全 ingredients）：
```bash
python scripts/backfill_mealdb_ingredients.py   # 需 requests，会更新 recipes.json 与 ingredients.json
```
**食材中文名补全**（若 `ingredients.json` 中仅有英文 `name`、没有 `name_zh`）：
```bash
pip install deep-translator
python scripts/add_ingredient_name_zh.py   # 为所有缺 name_zh 的食材翻译并写入
```

---

## 数据

- **ingredients.json**：50+ 种具体食材（含部位/品类），每项含 `nutrition_per_100g`、`price_per_kg`、`availability.UK/CN`、`storage`。可选 `name` / `name_zh` 用于首页与详情「用到」的中英文展示（爬虫合并或补全脚本会写入）。可选 `purchase_options`：`[{ "weight_g": 400, "price": 2.99 }, ...]` 表示市面常见规格与价格，用于购物清单「建议购买」与最优方案；无此字段或散称时由用户在手勾选清单时自行填写购入量与价格，并写回库存。
- **recipes.json**：多道餐品模板，每道关联食材与克数（`ingredients: { ingredient_id: grams }`），用于计算每餐宏量与成本，并供首页/详情「用到」展示。
- **recipe_steps.json**：每道食谱的 `steps_zh`、`steps_en`，供首页/详情展示做法；缺条目的食谱会使用 `default` 占位。
- **购物清单**：生成计划后按「食谱需求 − 当前库存」得出需补足量；有 `purchase_options` 的食材会给出建议购买量与约价，无则「实际(g)」「价格」留空由用户填写；勾选「已购入」时将实际购入量与价格写入库存并更新清单；清单按周持久化在 `shopping_lists` 表。

## 运行

```bash
# 默认 Demo：库存 鸡胸 1kg、豆腐 500g、西兰花 600g；目标 2000 kcal/天、蛋白 130g、最多 6 种新食材
python agent.py
```

## 自定义运行（在代码中改）

在 `agent.py` 的 `run_demo()` 里修改：

- **inventory**：`{"ingredient_id": {"quantity": 克数, "priority": "high"|"normal"}}`
- **constraints**：`build_constraints(calories_per_day=..., protein_min_per_day=..., budget_weekly=..., max_new_ingredients=..., region="UK"|"CN", days=7)`

命令行示例（不要在同一行写 `# 注释`，否则会被当成参数报错）：

```bash
python run.py --region CN --max-new 5 --days 3
```

或直接在代码里调用：

```python
from agent import load_ingredients, load_recipes, build_constraints, normalize_inventory, plan_week, format_plan

inventory = normalize_inventory({"chicken_breast": {"quantity": 1000, "priority": "high"}, "tofu_firm": {"quantity": 500, "priority": "high"}})
constraints = build_constraints(calories_per_day=2000, protein_min_per_day=130, budget_weekly=50, max_new_ingredients=6, region="UK")
daily_meals, shopping_list, new_ingredients, explanations = plan_week(constraints, inventory, load_ingredients(), load_recipes())
print(format_plan(daily_meals, shopping_list, new_ingredients, explanations, load_ingredients()))
```

## 输出

- **一周餐单**：每日早/午/晚 + 每餐热量、蛋白、成本。
- **需新购食材（购物清单）**：按克数，只列需要补的。
- **新增食材种类数**：本周新引入的食材种类（≤ max_new_ingredients）。
- **说明**：标出哪些餐优先消耗了高优先级库存。

## 设计要点

1. **约束**：每日热量、每日最低蛋白、周预算、新食材种类上限、地区（UK/CN）。
2. **库存**：带数量与优先级（high = 快过期/已开封，优先消耗）。
3. **评分**：库存使用奖励 − 新食材惩罚 − 地区可用性惩罚 − 宏量/预算惩罚 − 重复配方惩罚；在满足「新食材种类 ≤ 上限」下贪心选餐。
4. **新食材硬上限**：单周新引入种类不超过 `max_new_ingredients`，超出的候选直接跳过；fallback 时也只选不超剩余配额的候选。
5. **评分组件**：`macro_penalty`、`budget_penalty`、`availability_penalty`、`inventory_usage_score`、`freshness_adjustment` 等独立函数，便于单测与调参；超预算时会做多轮 refinement 尝试替换高价餐以满足约束。

## 数据模型与 API 规范

- **数据模型**：`docs/DATA_SCHEMA.md` 定义了食材（`nutrition_per_100g`、`price_per_kg`、`storage`）、食谱、库存的字段规范，保证 scoring 与宏量计算一致。
- **库存时间维度**：库存支持 `days_since_purchase`、`storage_type`（room_temp/refrigerated/frozen），用于 urgency/新鲜度加分；数据库见 `supabase/migrations/007_inventory_storage_and_freshness.sql`。
- **API Schema**：后端 FastAPI 使用 Pydantic 定义请求/响应类型，`POST /api/plan` 返回 `PlanResponse`（daily_meals、shopping_list、new_ingredients、explanations）；OpenAPI 文档见运行后 `http://localhost:8000/docs` 或 `/openapi.json`。

## 测试

在**项目根目录**（包含 `tests/`、`agent.py`、`web/` 的目录）运行：

```bash
pip install pytest
cd "/path/to/Recipe Planner"   # 或从 web 目录执行 cd ..
python -m pytest tests/ -v
```

- **tests/test_nutrition.py**：营养与成本计算、macro/budget/availability 惩罚。
- **tests/test_inventory.py**：库存归一化、优先消耗、新鲜度 urgency、新食材惩罚。
- **tests/test_plan.py**：计划生成（七天、餐位、购物清单）与候选结构。

## 依赖

- **Agent**：Python 3 标准库为主；可选 `deep-translator`（食谱名运行时翻译）。
- **测试**：`pytest>=7.0`（见 `requirements.txt`）。

---

## 前端（React + TypeScript + Vite + Supabase + Vercel）

- **目录**：`web/`
- **用户与物品**：Supabase 存储（用户登录、`inventory_items` 库存）；需在 Supabase SQL Editor 执行 `supabase/schema.sql` 建表。
- **部署**：Vercel 部署 `web` 目录，在 Vercel 环境变量中配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- 详见 `web/README.md`。

### Web 本地全栈运行（含「生成计划」）

「生成计划」依赖**后端 API**。前端会请求 `http://localhost:8000/api/plan`，所以本地需同时跑后端 + 前端。

**1. 启动后端（计划 API，端口 8000）**

在终端里先进入项目的 backend 目录（路径按你本机改，例如在桌面时）：

```bash
cd ~/Desktop/Recipe\ Planner/backend
# 或：cd "/Users/apple/Desktop/Recipe Planner/backend"

# 若系统限制全局 pip（如 macOS Homebrew Python），建议用虚拟环境：
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

看到 `Uvicorn running on http://127.0.0.1:8000` 即表示后端已就绪。**若你修改过 `agent.py` 或后端代码**：`--reload` 只会在改 `backend/` 下文件时自动重载，改项目根目录的 `agent.py` 不会自动生效，需**手动重启后端**（终端里 Ctrl+C 停掉再重新运行 `uvicorn main:app --reload --port 8000`），否则「生成计划」仍会跑旧逻辑（例如每餐只有 1 个选项）。

**2. 启动前端**

另开一个终端：

```bash
cd ~/Desktop/Recipe\ Planner/web
# 或：cd "/Users/apple/Desktop/Recipe Planner/web"
npm run dev
```

确保 `web/.env` 中有 `VITE_API_URL=http://localhost:8000`（默认已配置）。浏览器打开前端地址后，在**计划页**点击「生成计划」即可。

### 爬虫（食谱 + 做法 + 中英）

```bash
cd ~/Desktop/Recipe\ Planner
pip install -r scripts/requirements.txt   # requests + deep-translator（可选，用于做法英→中翻译）
python scripts/crawl_recipes.py --max 20 --merge
```

- 拉取 TheMealDB 食谱与**完整英文做法**，规范为步骤格式后写入 `recipe_steps.json`。
- 安装 `deep-translator` 后会自动将做法翻译为中文；未安装则 `steps_zh` 为「（做法见英文步骤）」。


启动后端（一个终端，保持运行）
   cd ~/Desktop/Recipe\ Planner/backend   source .venv/bin/activate   uvicorn main:app --reload --port 8000
启动前端（再开一个终端）
   cd ~/Desktop/Recipe\ Planner/web   npm run dev
在浏览器打开终端里给的地址（如 http://localhost:5173），登录后到计划页点「生成计划」即可使用。
（可选） 想扩充食谱和做法时：

python scripts/add_recipe_name_zh.py
python scripts/crawl_recipes.py --max N --merge