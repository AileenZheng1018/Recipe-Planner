"""
Inventory-Aware Nutrition Planning Agent (Hackathon)
基于 ingredients.json + recipes.json 的多目标餐单规划
"""
from __future__ import annotations

import json
import copy
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# 1. 数据加载
# ---------------------------------------------------------------------------

BASE = Path(__file__).resolve().parent


def load_ingredients() -> dict[str, Any]:
    with open(BASE / "ingredients.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_recipes() -> dict[str, Any]:
    with open(BASE / "recipes.json", "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 2. 约束与库存表示
# ---------------------------------------------------------------------------

@dataclass
class Constraints:
    calories_per_day: float
    protein_min_per_day: float
    budget_weekly: float
    max_new_ingredients: int
    region: str  # "UK" | "CN"
    days: int = 7


def build_constraints(
    calories_per_day: float = 2000,
    protein_min_per_day: float = 130,
    budget_weekly: float = 50,
    max_new_ingredients: int = 5,
    region: str = "UK",
    days: int = 7,
) -> Constraints:
    return Constraints(
        calories_per_day=calories_per_day,
        protein_min_per_day=protein_min_per_day,
        budget_weekly=budget_weekly,
        max_new_ingredients=max_new_ingredients,
        region=region,
        days=days,
    )


# 库存: ingredient_id -> { quantity, priority, days_since_purchase?, storage_type? }
def normalize_inventory(raw: dict[str, Any]) -> dict[str, dict]:
    out = {}
    for k, v in raw.items():
        if isinstance(v, dict):
            q = int(v.get("quantity", v.get("quantity_g", 0)))
            out[k] = {
                "quantity": q,
                "priority": v.get("priority", "normal"),
            }
            if "days_since_purchase" in v and v["days_since_purchase"] is not None:
                out[k]["days_since_purchase"] = int(v["days_since_purchase"])
            if v.get("storage_type") in ("room_temp", "refrigerated", "frozen"):
                out[k]["storage_type"] = v["storage_type"]
        else:
            out[k] = {"quantity": int(v), "priority": "normal"}
    return out


# ---------------------------------------------------------------------------
# 3. 配方宏量、成本、可用性
# ---------------------------------------------------------------------------

def recipe_nutrition_and_cost(
    recipe: dict,
    ingredients_db: dict[str, Any],
    region: str,
) -> tuple[dict, float, float]:
    """返回 (nutrition_per_serving, cost_per_serving, availability_penalty)."""
    nut = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    cost = 0.0
    penalty = 0.0
    ings = recipe.get("ingredients", {})
    for ing_id, grams in ings.items():
        if ing_id not in ingredients_db:
            continue
        ing = ingredients_db[ing_id]
        n = ing.get("nutrition_per_100g", {})
        for key in nut:
            nut[key] += (grams / 100.0) * n.get(key, 0)
        cost += (grams / 1000.0) * ing.get("price_per_kg", 0)
        # availability（来自 ingredients.json 的 availability.UK/CN）：数值越高越难买，计入 penalty；
        # 规划时 constraints.region 决定用哪一档，score_recipe 中 availability_penalty 会压低难购食材的配方得分
        av = ing.get("availability", {}).get(region, 0.5)
        penalty += av * (grams / 100.0)
    # 归一化 penalty 到每餐量级
    total_g = sum(ings.values()) or 1
    penalty = penalty / (total_g / 100.0) * 0.01
    return nut, cost, penalty


def _name_looks_cjk(s: str) -> bool:
    """名字是否含中日韩字符，用于区分中/英"""
    if not s:
        return False
    for c in str(s):
        if "\u4e00" <= c <= "\u9fff" or "\u3040" <= c <= "\u30ff":
            return True
    return False


# 英文名→中文名缓存，避免重复请求翻译
_name_en_to_zh_cache: dict[str, str] = {}


def _translate_name_en_to_zh(en: str) -> str | None:
    """英文食谱名译为中文，需 pip install deep-translator。失败或未安装返回 None。"""
    if not en or len(en) > 450 or _name_looks_cjk(en):
        return None
    if en in _name_en_to_zh_cache:
        return _name_en_to_zh_cache[en]
    try:
        from deep_translator import GoogleTranslator
        zh = GoogleTranslator(source="en", target="zh-CN").translate(en)
        if zh and zh.strip():
            _name_en_to_zh_cache[en] = zh
            return zh
    except Exception:
        pass
    return None


def build_meal_candidates(
    recipes_db: dict,
    ingredients_db: dict,
    region: str,
) -> list[dict]:
    """生成带宏量、成本、可用性惩罚的餐品候选列表。"""
    candidates = []
    for rid, rec in recipes_db.items():
        nut, cost, penalty = recipe_nutrition_and_cost(rec, ingredients_db, region)
        name_raw = rec.get("name", rid)
        name_zh = rec.get("name_zh") or name_raw
        name_en = rec.get("name_en") or name_raw
        if _name_looks_cjk(name_raw) and not rec.get("name_en"):
            name_en = rid.replace("_", " ").title()
        if not _name_looks_cjk(name_raw) and not rec.get("name_zh"):
            # 新食谱（如 mealdb）可能只有英文 name，尝试运行时翻译
            name_zh = _translate_name_en_to_zh(name_raw) or name_raw
        for meal_type in rec.get("meal_type", ["lunch", "dinner"]):
            candidates.append({
                "recipe_id": rid,
                "name": name_en,
                "name_zh": name_zh,
                "meal_type": meal_type,
                "ingredients": dict(rec.get("ingredients", {})),
                "nutrition": nut,
                "cost": cost,
                "availability_penalty": penalty,
            })
    return candidates


# ---------------------------------------------------------------------------
# 4. 评分组件（可单独测试与调参）
# ---------------------------------------------------------------------------

def macro_penalty(
    candidate: dict,
    day_remaining_cal: float,
    day_remaining_protein: float,
) -> float:
    """宏量惩罚：当日热量超标或蛋白不足时加分（惩罚）。"""
    nut = candidate["nutrition"]
    p = 0.0
    if day_remaining_cal < nut["calories"]:
        p += 20.0
    if day_remaining_protein > 0 and nut["protein"] < day_remaining_protein * 0.3:
        p += 5.0
    return p


def budget_penalty(cost: float, total_cost_so_far: float, budget_weekly: float) -> float:
    """预算惩罚：本餐成本超过剩余预算时加分。"""
    if cost > max(0, budget_weekly - total_cost_so_far):
        return 15.0
    return 0.0


def availability_penalty(candidate: dict) -> float:
    """可用性惩罚：难购食材已在 recipe_nutrition_and_cost 中算好。"""
    return candidate["availability_penalty"] * 2.0


def inventory_usage_score(candidate: dict, inventory: dict[str, dict]) -> float:
    """库存使用奖励：有库存则加分，high priority 更高。"""
    reward = 0.0
    for ing_id, grams in candidate["ingredients"].items():
        inv = inventory.get(ing_id, {})
        if inv.get("quantity", 0) > 0:
            reward += (grams / 100.0) * (2.0 if inv.get("priority") == "high" else 1.0)
    return reward * 0.01


def freshness_adjustment(
    candidate: dict,
    inventory: dict[str, dict],
    ingredients_db: dict[str, Any],
) -> float:
    """
    新鲜度/urgency 加分：优先消耗快过期的库存。
    若库存有 days_since_purchase，且食材有 storage.*_days，则剩余天数越少加分越多。
    """
    bonus = 0.0
    for ing_id, grams in candidate["ingredients"].items():
        inv = inventory.get(ing_id, {})
        q = inv.get("quantity", 0)
        if q <= 0:
            continue
        days = inv.get("days_since_purchase")
        if days is None:
            continue
        ing = ingredients_db.get(ing_id, {})
        storage = ing.get("storage") or {}
        st = inv.get("storage_type") or "refrigerated"
        shelf_days = storage.get("refrigerated_days") or storage.get("room_temp_days") or storage.get("frozen_days")
        if st == "frozen":
            shelf_days = storage.get("frozen_days") or shelf_days
        elif st == "room_temp":
            shelf_days = storage.get("room_temp_days") or shelf_days
        if shelf_days is None or shelf_days <= 0:
            continue
        remaining = shelf_days - days
        if remaining <= 3:
            bonus += (grams / 100.0) * 0.05
        elif remaining <= 7:
            bonus += (grams / 100.0) * 0.02
    return bonus


def new_ingredient_penalty(
    candidate: dict,
    inventory: dict[str, dict],
    new_ingredients_so_far: set[str],
    max_new_ingredients: int,
) -> float:
    """新食材种类惩罚。"""
    new_from_this = set(candidate["ingredients"].keys()) - set(inventory.keys())
    if len(new_ingredients_so_far) >= max_new_ingredients and new_from_this:
        return 100.0
    return len(new_from_this) * 18.0


def diversity_penalty(recipe_id: str, recipe_counts: dict[str, int]) -> float:
    """多样性惩罚：本周已选次数越多分越低。"""
    return 10.0 * recipe_counts.get(recipe_id, 0)


def score_recipe(
    candidate: dict,
    inventory: dict[str, dict],
    used_ingredients: set[str],
    constraints: Constraints,
    day_remaining_cal: float,
    day_remaining_protein: float,
    total_cost_so_far: float,
    new_ingredients_so_far: set[str],
    recipe_counts: dict[str, int] | None = None,
    user_recipe_scores: dict[str, float] | None = None,
    ingredients_db: dict[str, Any] | None = None,
) -> float:
    """
    score = inventory_usage_score + freshness_adjustment
            - macro_penalty - budget_penalty - availability_penalty
            - new_ingredient_penalty - diversity_penalty
            + user_preference_bonus
    越高越好。
    """
    ings = candidate["ingredients"]
    nut = candidate["nutrition"]
    cost = candidate["cost"]
    recipe_counts = recipe_counts or {}
    ingredients_db = ingredients_db or {}

    usage = inventory_usage_score(candidate, inventory)
    freshness = freshness_adjustment(candidate, inventory, ingredients_db)
    macro = macro_penalty(candidate, day_remaining_cal, day_remaining_protein)
    budget = budget_penalty(cost, total_cost_so_far, constraints.budget_weekly)
    avail = availability_penalty(candidate)
    new_ing = new_ingredient_penalty(
        candidate, inventory, new_ingredients_so_far, constraints.max_new_ingredients
    )
    div = diversity_penalty(candidate["recipe_id"], recipe_counts)
    pref = (user_recipe_scores or {}).get(candidate["recipe_id"], 0.0)

    return usage + freshness - macro - budget - avail - new_ing - div + pref


def _get_primary_meal(m: dict) -> dict | None:
    """从单餐结构取出「当前选中的」那一项（兼容多候选与单选）。"""
    if not m:
        return None
    if "options" in m and m["options"]:
        idx = m.get("chosen_index", 0)
        return m["options"][min(idx, len(m["options"]) - 1)]
    return m


def plan_week(
    constraints: Constraints,
    inventory: dict[str, dict],
    ingredients_db: dict,
    recipes_db: dict,
    user_recipe_scores: dict[str, float] | None = None,
    options_per_slot: int = 1,
) -> tuple[list[dict], dict[str, float], set[str], list[str]]:
    """
    返回: (daily_meals, shopping_list, new_ingredients_set, explanations)
    daily_meals: [ { "day": 1, "breakfast": {...}, "lunch": {...}, "dinner": {...} }, ... ]
    当 options_per_slot > 1 时，每餐为 { "options": [ {...}, ... ], "chosen_index": 0 }，便于前端多选一并记录偏好。
    shopping_list 按每餐首选（options[0] 或 chosen_index）计算。
    """
    inv = copy.deepcopy(inventory)
    # 候选餐品按 constraints.region 计算 availability_penalty（ingredients 的 availability.UK/CN）
    candidates = build_meal_candidates(recipes_db, ingredients_db, constraints.region)
    daily_meals = []
    total_cost = 0.0
    new_ingredients_used: set[str] = set()
    recipe_counts: dict[str, int] = {}
    explanations: list[str] = []
    top_k = max(1, min(10, int(options_per_slot)))
    max_repeats_per_week = 3  # 允许同一道菜一周最多 3 次，便于多天都有多选项

    for day in range(1, constraints.days + 1):
        day_cal = constraints.calories_per_day
        day_protein = constraints.protein_min_per_day
        day_meals = {"day": day, "breakfast": None, "lunch": None, "dinner": None}

        for meal_type in ["breakfast", "lunch", "dinner"]:
            scored: list[tuple[float, dict]] = []
            for c in candidates:
                if c["meal_type"] != meal_type:
                    continue
                if recipe_counts.get(c["recipe_id"], 0) >= max_repeats_per_week:
                    continue
                ings = c["ingredients"]
                new_from_this = set(ings.keys()) - set(inv.keys())
                if len(new_ingredients_used) + len(new_from_this) > constraints.max_new_ingredients:
                    continue
                sc = score_recipe(
                    c, inv, new_ingredients_used, constraints,
                    day_cal, day_protein, total_cost, new_ingredients_used,
                    recipe_counts,
                    user_recipe_scores,
                    ingredients_db=ingredients_db,
                )
                scored.append((sc, c))

            if not scored:
                quota = constraints.max_new_ingredients - len(new_ingredients_used)
                for c in candidates:
                    if c["meal_type"] != meal_type:
                        continue
                    nnew = len(set(c["ingredients"].keys()) - set(inv.keys()))
                    if nnew <= quota:
                        scored = [(0.0, c)]
                        break
            # 若通过严格筛选的不足 top_k，补足选项：先放宽重复/新食材限制打低分，再不足则任意同餐段配方凑满
            already_ids = {c["recipe_id"] for _, c in scored}
            if len(scored) < top_k:
                for c in candidates:
                    if c["meal_type"] != meal_type or c["recipe_id"] in already_ids:
                        continue
                    if recipe_counts.get(c["recipe_id"], 0) >= max_repeats_per_week:
                        sc = -80.0
                    else:
                        ings = c["ingredients"]
                        new_from_this = set(ings.keys()) - set(inv.keys())
                        if len(new_ingredients_used) + len(new_from_this) > constraints.max_new_ingredients:
                            sc = -60.0
                        else:
                            continue
                    scored.append((sc, c))
                    already_ids.add(c["recipe_id"])
                    if len(scored) >= top_k:
                        break
            if len(scored) < top_k:
                for c in candidates:
                    if c["meal_type"] != meal_type or c["recipe_id"] in already_ids:
                        continue
                    scored.append((-100.0, c))
                    already_ids.add(c["recipe_id"])
                    if len(scored) >= top_k:
                        break
            if not scored:
                continue

            scored.sort(key=lambda x: -x[0])
            top = [c for _, c in scored[:top_k]]
            best = top[0]
            # 统一返回 options 格式，便于前端每天每餐都能显示可选项（至少 1 个）
            day_meals[meal_type] = {
                "options": [
                    {
                        "name": c["name"],
                        "name_zh": c.get("name_zh") or c["name"],
                        "recipe_id": c["recipe_id"],
                        "nutrition": c["nutrition"],
                        "cost": c["cost"],
                    }
                    for c in top
                ],
                "chosen_index": 0,
            }

            recipe_counts[best["recipe_id"]] = recipe_counts.get(best["recipe_id"], 0) + 1
            total_cost += best["cost"]
            day_cal -= best["nutrition"]["calories"]
            day_protein -= best["nutrition"]["protein"]
            for ing_id, grams in best["ingredients"].items():
                if ing_id not in inv:
                    inv[ing_id] = {"quantity": 0, "priority": "normal"}
                    new_ingredients_used.add(ing_id)
                inv[ing_id]["quantity"] = inv[ing_id].get("quantity", 0) - grams
                if inv[ing_id]["quantity"] < 0:
                    inv[ing_id]["quantity"] = 0
            if prio_used := [i for i in best["ingredients"] if inv.get(i, {}).get("priority") == "high" or (i in inventory and inventory[i].get("priority") == "high")]:
                explanations.append(f"Day {day} {meal_type}: {best['name']} — 优先消耗库存: {', '.join(prio_used)}")

        daily_meals.append(day_meals)

    # 约束修复：若超预算或蛋白严重不足，尝试替换一餐以改善（多轮 refinement，最多 2 轮）
    for _refine_round in range(2):
        total_cost_after = sum(
            _get_primary_meal(d.get(mt))["cost"]
            for d in daily_meals
            for mt in ["breakfast", "lunch", "dinner"]
            if _get_primary_meal(d.get(mt))
        )
        over_budget = total_cost_after > constraints.budget_weekly
        # 找一周中成本最高的一餐尝试替换为更便宜且同 meal_type 的候选
        if over_budget:
            worst_day, worst_mt, worst_cost = None, None, -1.0
            for d in daily_meals:
                for mt in ["breakfast", "lunch", "dinner"]:
                    m = _get_primary_meal(d.get(mt))
                    if m and m["cost"] > worst_cost:
                        worst_cost = m["cost"]
                        worst_day, worst_mt = d, mt
            if worst_day is not None and worst_cost > 0:
                current_rid = _get_primary_meal(worst_day[worst_mt])["recipe_id"]
                cheaper = [
                    c for c in candidates
                    if c["meal_type"] == worst_mt
                    and c["recipe_id"] != current_rid
                    and c["cost"] < worst_cost
                ]
                if cheaper:
                    cheaper.sort(key=lambda x: x["cost"])
                    new_choice = cheaper[0]
                    worst_day[worst_mt] = {
                        "options": [{
                            "name": new_choice["name"],
                            "name_zh": new_choice.get("name_zh") or new_choice["name"],
                            "recipe_id": new_choice["recipe_id"],
                            "nutrition": new_choice["nutrition"],
                            "cost": new_choice["cost"],
                        }],
                        "chosen_index": 0,
                    }
                    continue
        break

    total_needed: dict[str, float] = {}
    for day_meals in daily_meals:
        for meal_type in ["breakfast", "lunch", "dinner"]:
            m = day_meals.get(meal_type)
            primary = _get_primary_meal(m)
            if not primary:
                continue
            rec = recipes_db.get(primary["recipe_id"], {})
            for ing_id, grams in rec.get("ingredients", {}).items():
                total_needed[ing_id] = total_needed.get(ing_id, 0) + grams
    shopping = {}
    for ing_id, need in total_needed.items():
        have = inventory.get(ing_id, {}).get("quantity", 0)
        buy = max(0, need - have)
        if buy > 0:
            shopping[ing_id] = buy

    return daily_meals, shopping, new_ingredients_used, explanations


# ---------------------------------------------------------------------------
# 5. 输出格式化
# ---------------------------------------------------------------------------

def format_plan(
    daily_meals: list[dict],
    shopping_list: dict[str, float],
    new_ingredients: set[str],
    explanations: list[str],
    ingredients_db: dict,
) -> str:
    lines = [
        "========== 一周餐单 ==========",
        "",
    ]
    for day in daily_meals:
        d = day["day"]
        lines.append(f"--- Day {d} ---")
        for mt in ["breakfast", "lunch", "dinner"]:
            m = _get_primary_meal(day.get(mt))
            if m:
                n = m["nutrition"]
                lines.append(f"  {mt}: {m['name']}  |  {n['calories']:.0f} kcal, 蛋白 {n['protein']:.0f}g  |  £{m['cost']:.2f}")
        lines.append("")

    lines.append("========== 需新购食材（购物清单）==========")
    for ing_id, grams in sorted(shopping_list.items()):
        name = ing_id.replace("_", " ").title()
        lines.append(f"  {name}: {grams:.0f} g")
    lines.append("")
    lines.append(f"新增食材种类数: {len(new_ingredients)}")
    lines.append("")
    lines.append("========== 说明 ==========")
    for e in explanations[:15]:
        lines.append(f"  {e}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 6. 主入口
# ---------------------------------------------------------------------------

def run_demo():
    """Demo: 鸡胸 1kg、豆腐 500g、西兰花 2 颗，减脂高蛋白，最多 4 种新食材。"""
    ingredients_db = load_ingredients()
    recipes_db = load_recipes()

    # 库存（克）。西兰花 2 颗约 600g
    inventory = {
        "chicken_breast": {"quantity": 1000, "unit": "g", "priority": "high"},
        "tofu_firm": {"quantity": 500, "unit": "g", "priority": "high"},
        "broccoli": {"quantity": 600, "unit": "g", "priority": "normal"},
    }
    inventory = normalize_inventory(inventory)

    constraints = build_constraints(
        calories_per_day=2000,
        protein_min_per_day=130,
        budget_weekly=50,
        max_new_ingredients=6,
        region="UK",
        days=7,
    )

    daily_meals, shopping_list, new_ingredients, explanations = plan_week(
        constraints, inventory, ingredients_db, recipes_db,
    )

    print(format_plan(daily_meals, shopping_list, new_ingredients, explanations, ingredients_db))


if __name__ == "__main__":
    run_demo()
