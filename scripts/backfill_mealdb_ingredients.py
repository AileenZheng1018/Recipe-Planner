#!/usr/bin/env python3
"""
为 recipes.json 中已有的 mealdb_* 食谱从 TheMealDB 重新拉取并补全 ingredients（含未映射食材）。
运行前请确保 scripts/ingredient_mapping.json 存在；运行后建议执行一次 --merge 逻辑中的「补全 ingredients.json stub」或本脚本会自动补全。
用法: python scripts/backfill_mealdb_ingredients.py
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RECIPES_PATH = BASE / "recipes.json"
INGREDIENTS_PATH = BASE / "ingredients.json"
MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"

try:
    import requests
except ImportError:
    print("请先安装: pip install requests")
    raise


def _translate_en_to_zh(text: str) -> str | None:
    """英文食材名译中文，需 pip install deep-translator。"""
    if not text or not text.strip() or len(text) > 200:
        return None
    try:
        from deep_translator import GoogleTranslator
        t = GoogleTranslator(source="en", target="zh-CN").translate(text.strip())
        return t if t and t.strip() else None
    except Exception:
        return None


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower().strip()).strip("_") or "unknown"


def load_mapping() -> dict[str, str]:
    p = BASE / "scripts" / "ingredient_mapping.json"
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {k.lower().strip(): v for k, v in data.items() if not str(k).startswith("comment")}


# 与 crawl_recipes 相同的单位换算（简化版，仅用默认）
MEASURE_TO_GRAMS = {"cup": 240, "cups": 240, "tbsp": 15, "tsp": 5, "g": 1, "grams": 1, "kg": 1000, "oz": 28, "lb": 454}
DEFAULT_GRAMS = {"chicken": 150, "breast": 150, "egg": 50, "tofu": 150, "rice": 80}


def parse_measure_to_grams(measure: str, ingredient_name: str) -> int:
    if not measure or not str(measure).strip():
        name_lower = (ingredient_name or "").lower()
        for key, g in DEFAULT_GRAMS.items():
            if key in name_lower:
                return g
        return 50
    s = str(measure).strip().lower()
    for unit, grams_per in MEASURE_TO_GRAMS.items():
        if unit not in s:
            continue
        try:
            before = s.split(unit)[0].strip()
            num_part = float(re.sub(r"[^\d.]", "", before) or 1)
            return max(5, int(num_part * grams_per))
        except ValueError:
            pass
    try:
        return max(5, int(float(re.sub(r"[^\d.]", "", s) or 50)))
    except ValueError:
        return 50


def fetch_meal_detail(meal_id: str) -> dict | None:
    url = f"{MEALDB_BASE}/lookup.php?i={meal_id}"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    data = r.json()
    meals = data.get("meals")
    if meals:
        return meals[0]
    return None


def meal_to_ingredients(meal: dict, mapping: dict[str, str]) -> dict[str, int]:
    ingredients: dict[str, int] = {}
    for i in range(1, 21):
        ing = (meal.get(f"strIngredient{i}") or "").strip()
        measure = (meal.get(f"strMeasure{i}") or "").strip()
        if not ing:
            continue
        ing_lower = ing.lower()
        our_id = mapping.get(ing_lower) or f"mealdb_{slug(ing)}"
        grams = parse_measure_to_grams(measure, ing)
        ingredients[our_id] = ingredients.get(our_id, 0) + grams
    return ingredients


def main() -> None:
    mapping = load_mapping()
    with open(RECIPES_PATH, "r", encoding="utf-8") as f:
        recipes = json.load(f)
    mealdb_ids = [rid for rid in recipes if rid.startswith("mealdb_") and rid[7:].isdigit()]
    if not mealdb_ids:
        print("未发现 mealdb_* 食谱，无需补全。")
        return
    with open(INGREDIENTS_PATH, "r", encoding="utf-8") as f:
        ingredients_db = json.load(f)
    stub = {
        "category": "pantry",
        "nutrition_per_100g": {"calories": 100, "protein": 5, "carbs": 10, "fat": 2, "fiber": 1},
        "price_per_kg": 5.0,
        "availability": {"UK": 0.5, "CN": 0.5},
        "storage": {"room_temp_days": None, "refrigerated_days": 7, "frozen_days": 90},
    }
    updated_recipes = 0
    added_stubs = 0
    for rid in mealdb_ids:
        mid = rid.replace("mealdb_", "", 1)
        time.sleep(0.25)
        try:
            full = fetch_meal_detail(mid)
        except Exception as e:
            print(f"  Skip {rid}: {e}")
            continue
        if not full:
            continue
        ings = meal_to_ingredients(full, mapping)
        if not ings:
            continue
        old_ings = recipes[rid].get("ingredients", {})
        if ings != old_ings:
            recipes[rid]["ingredients"] = ings
            updated_recipes += 1
            print(f"  Updated {rid}: {len(old_ings)} -> {len(ings)} ingredients")
        for ing_id in ings:
            if ing_id not in ingredients_db:
                display_name = ing_id.replace("mealdb_", "", 1).replace("_", " ").title() if ing_id.startswith("mealdb_") else ing_id.replace("_", " ").title()
                name_zh = _translate_en_to_zh(display_name)
                if name_zh:
                    time.sleep(0.2)
                ingredients_db[ing_id] = {**stub, "name": display_name, "name_zh": name_zh}
                added_stubs += 1
    if updated_recipes or added_stubs:
        with open(RECIPES_PATH, "w", encoding="utf-8") as f:
            json.dump(recipes, f, ensure_ascii=False, indent=2)
        with open(INGREDIENTS_PATH, "w", encoding="utf-8") as f:
            json.dump(ingredients_db, f, ensure_ascii=False, indent=2)
        print(f"已补全 {updated_recipes} 个食谱的 ingredients，新增 {added_stubs} 个食材 stub。")
    else:
        print("所有 mealdb 食谱的 ingredients 已是最新，无需更新。")


if __name__ == "__main__":
    main()
