"""
Recipe Planner API：接收库存与约束，返回一周餐单与购物清单。
运行: uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import sys
from pathlib import Path

# 项目根目录加入 path，以便 import agent
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import (
    load_ingredients,
    load_recipes,
    build_constraints,
    normalize_inventory,
    plan_week,
)

app = FastAPI(title="Recipe Planner API")
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
    """每餐返回的候选数量，>1 时前端可多选一并记录偏好，默认 5"""
    options_per_slot: int = 5


def _load_recipe_steps() -> dict:
    p = ROOT / "recipe_steps.json"
    if not p.exists():
        return {}
    import json
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/health")
def health():
    return {"status": "ok"}


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


@app.post("/api/plan")
def api_plan(body: PlanRequest):
    """根据库存与约束生成一周餐单与购物清单。"""
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

    # 购物清单：每项含 grams（需补足量）；若有 purchase_options 则算最优购买 suggested_grams/suggested_price，否则 user_fill=True 由用户填写
    shopping_list_arr = []
    for ing_id, need_g in shopping_list.items():
        need_g = round(need_g, 0)
        ing = ingredients_db.get(ing_id, {})
        opts = ing.get("purchase_options")
        if opts and isinstance(opts, list):
            sug_g, sug_p = _best_purchase_option(need_g, opts)
            shopping_list_arr.append({
                "ingredient_id": ing_id,
                "grams": need_g,
                "suggested_grams": sug_g,
                "suggested_price": round(sug_p, 2) if sug_p is not None else None,
                "user_fill": False,
            })
        else:
            shopping_list_arr.append({
                "ingredient_id": ing_id,
                "grams": need_g,
                "suggested_grams": None,
                "suggested_price": None,
                "user_fill": True,
            })

    return {
        "daily_meals": daily_meals,
        "shopping_list": shopping_list_arr,
        "new_ingredients": list(new_ingredients),
        "explanations": explanations,
    }
