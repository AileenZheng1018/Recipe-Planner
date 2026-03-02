"""
Recipe Planner API：接收库存与约束，返回一周餐单与购物清单。
运行: uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import sys
from pathlib import Path

# 保证 backend 目录在 path 最前；并显式从同目录加载 agent（兼容 Railway 等部署环境）
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import importlib.util
_agent_path = ROOT / "agent.py"
_spec = importlib.util.spec_from_file_location("agent", _agent_path)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"agent.py not found at {_agent_path}")
_agent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_agent)
load_ingredients = _agent.load_ingredients
load_recipes = _agent.load_recipes
build_constraints = _agent.build_constraints
normalize_inventory = _agent.normalize_inventory
plan_week = _agent.plan_week

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Recipe Planner API",
    description="根据库存与营养约束生成一周餐单与购物清单。OpenAPI schema 见 /openapi.json。",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InventoryItem(BaseModel):
    quantity_g: int
    priority: str = "normal"
    days_since_purchase: int | None = Field(None, description="购买后天数，用于 urgency/新鲜度")
    storage_type: str | None = Field(None, description="room_temp | refrigerated | frozen")


class ConstraintsBody(BaseModel):
    calories_per_day: float = 2000
    protein_min_per_day: float = 130
    budget_weekly: float = 50
    max_new_ingredients: int = 5
    region: str = "UK"
    days: int = 7


class PlanRequest(BaseModel):
    inventory: dict[str, InventoryItem]
    constraints: ConstraintsBody | None = None
    recipe_preference_scores: dict[str, float] | None = None
    options_per_slot: int = Field(5, description="每餐返回的候选数量，>1 时前端可多选一并记录偏好")


# ---------- API 响应 Schema（OpenAPI 文档与前端契约） ----------


class NutritionOut(BaseModel):
    """每餐营养（每份）：统一按 100g 聚合后的 per-serving。"""
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float


class MealOptionOut(BaseModel):
    """单餐一个候选：名称、食谱 ID、营养、成本。"""
    name: str
    name_zh: str | None = None
    recipe_id: str
    nutrition: dict[str, float]  # 兼容 NutritionOut 的 dict
    cost: float


class SlotMealOut(BaseModel):
    """某餐位：多候选 + 当前选中下标。"""
    options: list[MealOptionOut]
    chosen_index: int = 0


class DayMealsOut(BaseModel):
    """单日餐单：breakfast/lunch/dinner 可为 null 或 SlotMealOut。"""
    day: int
    breakfast: SlotMealOut | None = None
    lunch: SlotMealOut | None = None
    dinner: SlotMealOut | None = None


class ShoppingListItemOut(BaseModel):
    """购物清单一项；name_en/name_zh 来自 ingredients.json，便于前端显示中文。"""
    ingredient_id: str
    grams: float
    suggested_grams: float | None = None
    suggested_price: float | None = None
    user_fill: bool = True
    name_en: str | None = None
    name_zh: str | None = None


class PlanResponse(BaseModel):
    """POST /api/plan 返回结构。"""
    daily_meals: list[dict[str, Any]] = Field(..., description="每日餐单，每项含 day, breakfast, lunch, dinner")
    shopping_list: list[ShoppingListItemOut] = Field(..., description="需补购食材列表")
    new_ingredients: list[str] = Field(..., description="本周计划中新引入的食材 ID")
    explanations: list[str] = Field(default_factory=list, description="规划说明（如优先消耗库存）")


def _load_recipe_steps() -> dict:
    p = ROOT / "recipe_steps.json"
    if not p.exists():
        return {}
    import json
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/health")
def health():
    """轻量健康检查，不加载数据，避免触发大文件读取。"""
    return {"status": "ok"}


@app.on_event("startup")
def _startup_check():
    """启动时检查数据文件是否存在，便于在 Railway 日志中发现问题。"""
    import os
    for name in ("agent.py", "ingredients.json", "recipes.json", "recipe_steps.json"):
        p = ROOT / name
        exists = p.exists()
        print(f"[startup] {name}: {'ok' if exists else 'MISSING'}", flush=True)
    print(f"[startup] PORT={os.environ.get('PORT', 'not set')}", flush=True)


def _ingredient_display_name(ing_id: str, ingredients_db: dict, lang: str) -> str:
    """从 ingredients_db 取食材展示名，无则用 id 转成可读形式。"""
    ing = ingredients_db.get(ing_id, {})
    if lang == "zh" and ing.get("name_zh"):
        return ing["name_zh"]
    if ing.get("name"):
        return ing["name"]
    return ing_id.replace("_", " ").replace("mealdb ", "").title()


@app.get("/api/recipes")
def api_recipes():
    """返回所有食谱的 name、name_zh、ingredients、ingredient_names（用于完整「用到」展示）、steps。"""
    try:
        recipes_db = load_recipes()
        steps_db = _load_recipe_steps()
        ingredients_db = load_ingredients()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    default_steps = steps_db.get("default", {"steps_zh": "1. 按食谱准备食材。2. 按常规方式烹制。3. 装盘食用。", "steps_en": "1. Prepare ingredients. 2. Cook as usual. 3. Plate and serve."})
    out = {}
    for rid, rec in recipes_db.items():
        st = steps_db.get(rid, default_steps)
        ings = rec.get("ingredients", {})
        names_en = {iid: _ingredient_display_name(iid, ingredients_db, "en") for iid in ings}
        names_zh = {iid: _ingredient_display_name(iid, ingredients_db, "zh") for iid in ings}
        out[rid] = {
            "name": rec.get("name", rid),
            "name_zh": rec.get("name_zh"),
            "ingredients": ings,
            "ingredient_names": {"en": names_en, "zh": names_zh},
            "steps_zh": st.get("steps_zh", default_steps["steps_zh"]),
            "steps_en": st.get("steps_en", default_steps["steps_en"]),
        }
    return out


def _best_purchase_option(need_grams: float, options: list[dict]) -> tuple[float | None, float | None]:
    """
    从 purchase_options（每项含 weight_g, price）中选出满足 need_grams 且总价最低、剩余最少的方案。
    返回 (suggested_grams, suggested_price)，若无合适选项则 (None, None)。
    """
    if not options or need_grams <= 0:
        return None, None
    best_price = None
    best_grams = None
    for opt in options:
        w = opt.get("weight_g") or 0
        p = opt.get("price")
        if w <= 0 or p is None:
            continue
        n = max(1, int(need_grams // w) + (1 if need_grams % w > 0 else 0))
        total_g = n * w
        total_p = n * float(p)
        if best_price is None or total_p < best_price or (total_p == best_price and total_g < (best_grams or 0)):
            best_price = total_p
            best_grams = total_g
    return (best_grams, best_price) if best_grams is not None else (None, None)


@app.post("/api/plan", response_model=PlanResponse)
def api_plan(body: PlanRequest) -> PlanResponse:
    """根据库存与约束生成一周餐单与购物清单。返回结构见 PlanResponse（OpenAPI schema）。"""
    try:
        ingredients_db = load_ingredients()
        recipes_db = load_recipes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load data: {e}")

    inv_raw = {}
    for ing_id, v in body.inventory.items():
        q = v.quantity_g if hasattr(v, "quantity_g") else (v.get("quantity_g", 0) if isinstance(v, dict) else 0)
        p = v.priority if hasattr(v, "priority") else (v.get("priority", "normal") if isinstance(v, dict) else "normal")
        inv_raw[ing_id] = {"quantity": q, "priority": p}
        if hasattr(v, "days_since_purchase") and getattr(v, "days_since_purchase") is not None:
            inv_raw[ing_id]["days_since_purchase"] = v.days_since_purchase
        if getattr(v, "storage_type", None) in ("room_temp", "refrigerated", "frozen"):
            inv_raw[ing_id]["storage_type"] = v.storage_type
    inventory = normalize_inventory(inv_raw)

    c = body.constraints or ConstraintsBody()
    constraints = build_constraints(
        calories_per_day=c.calories_per_day,
        protein_min_per_day=c.protein_min_per_day,
        budget_weekly=c.budget_weekly,
        max_new_ingredients=c.max_new_ingredients,
        region=c.region,
        days=c.days,
    )

    options_per_slot = getattr(body, "options_per_slot", 5) or 5
    daily_meals, shopping_list, new_ingredients, explanations = plan_week(
        constraints, inventory, ingredients_db, recipes_db,
        user_recipe_scores=body.recipe_preference_scores,
        options_per_slot=max(2, min(10, int(options_per_slot))),
    )

    # 购物清单：每项含 grams、name_en/name_zh（从 ingredients.json 取；无 name_zh 时前端用 getIngredientName 回退）
    shopping_list_arr = []
    for ing_id, need_g in shopping_list.items():
        need_g = round(need_g, 0)
        ing = ingredients_db.get(ing_id, {})
        opts = ing.get("purchase_options")
        name_en = _ingredient_display_name(ing_id, ingredients_db, "en")
        name_zh = ing.get("name_zh") or _ingredient_display_name(ing_id, ingredients_db, "zh")
        if name_zh == name_en and not ing.get("name_zh"):
            name_zh = None  # 避免把英文 slug 当中文返回，让前端用 getIngredientName 回退
        base = {
            "ingredient_id": ing_id,
            "grams": need_g,
            "name_en": name_en,
            "name_zh": name_zh,
        }
        if opts and isinstance(opts, list):
            sug_g, sug_p = _best_purchase_option(need_g, opts)
            shopping_list_arr.append({**base, "suggested_grams": sug_g, "suggested_price": round(sug_p, 2) if sug_p is not None else None, "user_fill": False})
        else:
            shopping_list_arr.append({**base, "suggested_grams": None, "suggested_price": None, "user_fill": True})

    return PlanResponse(
        daily_meals=daily_meals,
        shopping_list=[ShoppingListItemOut(**x) for x in shopping_list_arr],
        new_ingredients=list(new_ingredients),
        explanations=explanations,
    )
