#!/usr/bin/env python3
"""
从公开 API 拉取食谱与食材，转换为本项目 recipes.json / ingredients.json 格式。
使用 TheMealDB 免费 API（无需 key）：https://www.themealdb.com/api.php

用法:
  食谱:
    python scripts/crawl_recipes.py                    # 按地区拉取食谱 -> crawled_recipes.json + crawled_recipe_steps.json（含完整做法）
    python scripts/crawl_recipes.py --merge            # 拉取后合并进 recipes.json，并合并做法进 recipe_steps.json
    python scripts/crawl_recipes.py --max 30           # 最多拉取 30 道
  食材:
    python scripts/crawl_recipes.py --ingredients     # 拉取食材 -> crawled_ingredients.json
    python scripts/crawl_recipes.py --ingredients --merge-ingredients  # 合并进 ingredients.json
  同时:
    python scripts/crawl_recipes.py --ingredients --max 20  # 先拉食材再拉食谱

  做法翻译为中文（可选）:
    pip install deep-translator   # 安装后爬取时自动将英文做法译为中文
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("请先安装: pip install requests")
    raise

# 单次翻译长度上限（Google 等接口限制），分块时每块不超过此长度
_TRANSLATE_CHUNK_SIZE = 3500


def _translate_en_to_zh(text: str) -> str | None:
    """英文做法翻译为中文，需 pip install deep-translator。失败返回 None。短文本单次翻译，长文本分块。"""
    if not text or not text.strip():
        return None
    text = text.strip()
    if len(text) <= _TRANSLATE_CHUNK_SIZE:
        for attempt in range(2):
            try:
                from deep_translator import GoogleTranslator
                t = GoogleTranslator(source="en", target="zh-CN").translate(text)
                if t and t.strip():
                    return t
            except Exception:
                if attempt == 0:
                    time.sleep(1.0)
                pass
        return None
    # 长文本分块翻译后拼接
    return _translate_en_to_zh_chunked(text)


def _translate_en_to_zh_chunked(long_text: str) -> str | None:
    """将长英文按段落或长度分块，逐块翻译后拼接，确保做法完整。"""
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        return None
    # 先按双换行分段落，再按长度拆块，避免在句中被切断
    paragraphs = [p.strip() for p in long_text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = []
    current_len = 0
    for p in paragraphs:
        if current_len + len(p) + 2 <= _TRANSLATE_CHUNK_SIZE:
            current.append(p)
            current_len += len(p) + 2
        else:
            if current:
                chunks.append("\n\n".join(current))
            if len(p) > _TRANSLATE_CHUNK_SIZE:
                # 单段超长则按字符切
                for i in range(0, len(p), _TRANSLATE_CHUNK_SIZE):
                    chunks.append(p[i : i + _TRANSLATE_CHUNK_SIZE])
                current, current_len = [], 0
            else:
                current, current_len = [p], len(p) + 2
    if current:
        chunks.append("\n\n".join(current))
    out = []
    for i, c in enumerate(chunks):
        for attempt in range(2):
            try:
                t = GoogleTranslator(source="en", target="zh-CN").translate(c)
                if t and t.strip():
                    out.append(t.strip())
                    break
            except Exception:
                if attempt == 0:
                    time.sleep(1.0)
        else:
            out.append(c)
        if i < len(chunks) - 1:
            time.sleep(0.4)
    return "\n\n".join(out) if out else None

BASE = Path(__file__).resolve().parent.parent
MEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"

# 粗略换算：单位 -> 克（液体/酱料约 1 cup=240g, 1 tbsp=15g, 1 tsp=5g）
MEASURE_TO_GRAMS = {
    "cup": 240,
    "cups": 240,
    "tbsp": 15,
    "tablespoon": 15,
    "tablespoons": 15,
    "tb": 15,
    "tsp": 5,
    "teaspoon": 5,
    "teaspoons": 5,
    "ts": 5,
    "oz": 28,
    "ounce": 28,
    "lb": 454,
    "pound": 454,
    "g": 1,
    "gram": 1,
    "grams": 1,
    "kg": 1000,
    "ml": 1,
    "slice": 30,
    "slices": 30,
    "clove": 5,
    "cloves": 5,
    "stalk": 20,
    "piece": 50,
    "pieces": 50,
    "can": 400,
    "bunch": 50,
    "handful": 30,
    "pinch": 1,
    "": 40,
}
# 常见整数量词（无单位时按“份”估）
DEFAULT_GRAMS = {"chicken": 150, "breast": 150, "thigh": 80, "salmon": 150, "egg": 50, "tofu": 150, "rice": 80}

# TheMealDB strType -> 本项目 category（与 ingredients.json 一致）
INGREDIENT_TYPE_MAP = {
    "meat": "meat_red",
    "chicken": "meat_poultry",
    "poultry": "meat_poultry",
    "seafood": "fish",
    "fish": "fish",
    "vegetable": "vegetable",
    "vegetables": "vegetable",
    "fruit": "fruit",
    "fruits": "fruit",
    "dairy": "pantry",
    "condiment": "pantry",
    "pasta": "grain",
    "grain": "grain",
    "nuts": "pantry",
    "herbs": "pantry",
    "spices": "pantry",
    "oil": "pantry",
    "drinks": "pantry",
}


def slug(s: str) -> str:
    """Chicken Breast -> chicken_breast"""
    return re.sub(r"[^a-z0-9]+", "_", s.lower().strip()).strip("_") or "unknown"


def load_mapping() -> dict[str, str]:
    p = BASE / "scripts" / "ingredient_mapping.json"
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {k.lower().strip(): v for k, v in data.items() if not k.startswith("comment")}


def parse_measure_to_grams(measure: str, ingredient_name: str) -> int:
    if not measure or not str(measure).strip():
        name_lower = (ingredient_name or "").lower()
        for key, g in DEFAULT_GRAMS.items():
            if key in name_lower:
                return g
        return 50
    s = str(measure).strip().lower()
    # 数字 + 单位，如 "1 cup", "2 tbsp", "1/2 teaspoon"
    num_part = 1.0
    for unit, grams_per in MEASURE_TO_GRAMS.items():
        if unit not in s:
            continue
        try:
            before = s.split(unit)[0].strip()
            if not before:
                return int(grams_per)
            if "/" in before:
                a, b = before.split("/", 1)
                num_part = float(a.strip()) / float(b.strip())
            else:
                num_part = float(re.sub(r"[^\d.]", "", before) or 1)
            return max(5, int(num_part * grams_per))
        except (ValueError, ZeroDivisionError):
            pass
    # 纯数字当作克
    try:
        return max(5, int(float(re.sub(r"[^\d.]", "", s) or 50)))
    except ValueError:
        return 50


def normalize_instructions(raw: str | None) -> str:
    """将 API 返回的 strInstructions（多段/多行）规范为「1. ... 2. ...」格式。"""
    if not raw or not str(raw).strip():
        return ""
    text = str(raw).strip().replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if not lines:
        return text[:500]
    if len(lines) == 1:
        return lines[0][:800]
    out = []
    for i, ln in enumerate(lines, 1):
        ln = re.sub(r"^\d+[.)]\s*", "", ln)
        out.append(f"{i}. {ln}")
    return "\n".join(out)


def meal_to_recipe(meal: dict, mapping: dict[str, str]) -> dict | None:
    """TheMealDB 单条 meal -> 本项目 recipe 格式。已映射的用本项目 ID，未映射的用 mealdb_{slug} 保留完整用料。"""
    name = (meal.get("strMeal") or "").strip()
    if not name:
        return None
    rid = meal.get("idMeal") or ""
    recipe_id = f"mealdb_{rid}" if rid else f"crawled_{hash(name) % 10**8}"

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

    if not ingredients:
        return None

    area = (meal.get("strArea") or "").strip()
    category = (meal.get("strCategory") or "").strip()
    if category and category.lower() in ("breakfast", "starter"):
        meal_type = ["breakfast", "lunch", "dinner"]
    else:
        meal_type = ["lunch", "dinner"]

    return {
        "name": name,
        "ingredients": ingredients,
        "servings": 1,
        "meal_type": meal_type,
        "source": "themealdb",
        "source_id": rid,
        "area": area or None,
        "category": category or None,
    }


def fetch_meals_by_filter(kind: str, value: str) -> list[dict]:
    url = f"{MEALDB_BASE}/filter.php?{kind}={value}"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    data = r.json()
    meals = data.get("meals") or []
    return meals


def fetch_meal_detail(meal_id: str) -> dict | None:
    url = f"{MEALDB_BASE}/lookup.php?i={meal_id}"
    r = requests.get(url, timeout=10)
    r.raise_for_status()
    data = r.json()
    meals = data.get("meals")
    if meals:
        return meals[0]
    return None


def fetch_categories() -> list[str]:
    r = requests.get(f"{MEALDB_BASE}/categories.php", timeout=10)
    r.raise_for_status()
    data = r.json()
    return [c.get("strCategory", "") for c in (data.get("categories") or []) if c.get("strCategory")]


def fetch_areas() -> list[str]:
    r = requests.get(f"{MEALDB_BASE}/list.php?a=list", timeout=10)
    r.raise_for_status()
    data = r.json()
    return [a.get("strArea", "") for a in (data.get("meals") or []) if a.get("strArea")]


def fetch_ingredients_list() -> list[dict]:
    """TheMealDB: list.php?i=list 返回所有食材（strIngredient, strDescription, strType）。"""
    r = requests.get(f"{MEALDB_BASE}/list.php?i=list", timeout=15)
    r.raise_for_status()
    data = r.json()
    return data.get("meals") or []


def ingredient_to_our_format(item: dict) -> tuple[str, dict]:
    """单条 API 食材 -> (ingredient_id, 本项目格式)。id 形如 mealdb_chicken_breast。"""
    name = (item.get("strIngredient") or "").strip()
    if not name:
        return "", {}
    raw_type = (item.get("strType") or "").strip().lower()
    our_category = INGREDIENT_TYPE_MAP.get(raw_type) or "pantry"
    ing_id = f"mealdb_{slug(name)}"
    # 与 ingredients.json 结构一致；营养/价格为占位，后续可接其它 API 或手工补
    block = {
        "category": our_category,
        "nutrition_per_100g": {
            "calories": 100,
            "protein": 5,
            "carbs": 10,
            "fat": 2,
            "fiber": 1,
        },
        "price_per_kg": 5.0,
        "availability": {"UK": 0.3, "CN": 0.3},
        "storage": {"room_temp_days": None, "refrigerated_days": 7, "frozen_days": 90},
        "source": "themealdb",
        "source_name": name,
    }
    return ing_id, block


def crawl_ingredients(merge_into_main: bool) -> None:
    """拉取食材列表并写入 scripts/crawled_ingredients.json，可选合并进 ingredients.json。"""
    print("Fetching ingredients list...")
    items = fetch_ingredients_list()
    results: dict[str, dict] = {}
    for it in items:
        ing_id, block = ingredient_to_our_format(it)
        if not ing_id:
            continue
        results[ing_id] = block
    out_path = BASE / "scripts" / "crawled_ingredients.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(results)} ingredients to {out_path}")
    if merge_into_main and results:
        ing_path = BASE / "ingredients.json"
        with open(ing_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        for iid, blk in results.items():
            if iid not in existing:
                existing[iid] = {k: v for k, v in blk.items() if k not in ("source", "source_name")}
                print(f"  Merged ingredient {iid}")
        with open(ing_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print(f"Updated {ing_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Crawl recipes and/or ingredients from TheMealDB")
    ap.add_argument("--max", type=int, default=50, help="Max number of full recipes to fetch")
    ap.add_argument("--out", default=None, help="Output JSON path for recipes (default: scripts/crawled_recipes.json)")
    ap.add_argument("--merge", action="store_true", help="Merge recipes into recipes.json")
    ap.add_argument("--by-category", action="store_true", help="Fetch recipes by categories (default: by area)")
    ap.add_argument("--ingredients", action="store_true", help="Fetch ingredients list and save to crawled_ingredients.json")
    ap.add_argument("--merge-ingredients", action="store_true", help="Merge crawled ingredients into ingredients.json (use with --ingredients)")
    args = ap.parse_args()

    if args.merge_ingredients and not args.ingredients:
        args.ingredients = True

    if args.ingredients:
        crawl_ingredients(merge_into_main=args.merge_ingredients)
        if args.max <= 0 and not args.merge:
            return

    mapping = load_mapping()
    seen_ids: set[str] = set()
    results: dict[str, dict] = {}
    results_steps: dict[str, dict] = {}

    if args.by_category:
        filters = fetch_categories()
        kind = "c"
    else:
        filters = fetch_areas()
        kind = "a"

    for f in filters:
        if len(results) >= args.max:
            break
        try:
            list_meals = fetch_meals_by_filter(kind, f)
        except Exception as e:
            print(f"Skip {kind}={f}: {e}")
            continue
        for m in list_meals:
            mid = m.get("idMeal")
            if not mid or mid in seen_ids:
                continue
            if len(results) >= args.max:
                break
            seen_ids.add(mid)
            time.sleep(0.2)
            try:
                full = fetch_meal_detail(mid)
            except Exception as e:
                print(f"Skip detail {mid}: {e}")
                continue
            if not full:
                continue
            rec = meal_to_recipe(full, mapping)
            if rec:
                recipe_id = f"mealdb_{mid}"
                rec.pop("source", None)
                rec.pop("source_id", None)
                rec.pop("area", None)
                rec.pop("category", None)
                name_zh = _translate_en_to_zh(rec["name"])
                if name_zh:
                    time.sleep(0.2)
                results[recipe_id] = {
                    "name": rec["name"],
                    "name_zh": name_zh if name_zh else rec["name"],
                    "ingredients": rec["ingredients"],
                    "servings": rec["servings"],
                    "meal_type": rec["meal_type"],
                }
                instructions = normalize_instructions(full.get("strInstructions"))
                if instructions:
                    steps_zh = _translate_en_to_zh(instructions)
                    if (not steps_zh or steps_zh.strip() == "（做法见英文步骤）") and len(instructions) > 300:
                        steps_zh = _translate_en_to_zh_chunked(instructions)
                    if not steps_zh or not steps_zh.strip():
                        steps_zh = "（做法见英文步骤）"
                    results_steps[recipe_id] = {
                        "steps_en": instructions,
                        "steps_zh": steps_zh.strip(),
                    }
                    time.sleep(0.4)
                print(f"  + {recipe_id}: {rec['name']}" + (" (with steps)" if instructions else ""))

    out_path = Path(args.out) if args.out else BASE / "scripts" / "crawled_recipes.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(results)} recipes to {out_path}")
    if results_steps:
        steps_out = out_path.parent / "crawled_recipe_steps.json"
        with open(steps_out, "w", encoding="utf-8") as f:
            json.dump(results_steps, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(results_steps)} recipe steps to {steps_out}")

    if args.merge and results:
        recipes_path = BASE / "recipes.json"
        ingredients_path = BASE / "ingredients.json"
        with open(recipes_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        all_ing_ids = set()
        for rec in results.values():
            all_ing_ids.update(rec.get("ingredients", {}).keys())
        # 为食谱中出现的、但 ingredients.json 中不存在的食材补全 stub（含 name 便于「用到」展示）
        if all_ing_ids and ingredients_path.exists():
            with open(ingredients_path, "r", encoding="utf-8") as f:
                ing_existing = json.load(f)
            stub = {
                "category": "pantry",
                "nutrition_per_100g": {"calories": 100, "protein": 5, "carbs": 10, "fat": 2, "fiber": 1},
                "price_per_kg": 5.0,
                "availability": {"UK": 0.5, "CN": 0.5},
                "storage": {"room_temp_days": None, "refrigerated_days": 7, "frozen_days": 90},
            }
            added = 0
            for ing_id in all_ing_ids:
                if ing_id in ing_existing:
                    continue
                display_name = ing_id.replace("mealdb_", "", 1).replace("_", " ").title() if ing_id.startswith("mealdb_") else ing_id.replace("_", " ").title()
                name_zh = _translate_en_to_zh(display_name) if display_name else None
                if name_zh:
                    time.sleep(0.2)
                ing_existing[ing_id] = {**stub, "name": display_name, "name_zh": name_zh}
                added += 1
            if added:
                with open(ingredients_path, "w", encoding="utf-8") as f:
                    json.dump(ing_existing, f, ensure_ascii=False, indent=2)
                print(f"  Added {added} ingredient stub(s) to ingredients.json")
        for rid, rec in results.items():
            if rid not in existing:
                existing[rid] = rec
                print(f"  Merged {rid}")
        with open(recipes_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print(f"Updated {recipes_path}")

        if results_steps:
            steps_path = BASE / "recipe_steps.json"
            steps_default = {"steps_zh": "1. 按食谱准备食材。2. 按常规方式烹制。3. 装盘食用。", "steps_en": "1. Prepare ingredients per recipe. 2. Cook as usual. 3. Plate and serve."}
            if steps_path.exists():
                with open(steps_path, "r", encoding="utf-8") as f:
                    steps_existing = json.load(f)
            else:
                steps_existing = {"default": steps_default}
            if "default" not in steps_existing:
                steps_existing["default"] = steps_default
            for rid, st in results_steps.items():
                steps_existing[rid] = st
                print(f"  Steps merged for {rid}")
            with open(steps_path, "w", encoding="utf-8") as f:
                json.dump(steps_existing, f, ensure_ascii=False, indent=2)
            print(f"Updated {steps_path} with {len(results_steps)} recipe(s) steps")


if __name__ == "__main__":
    main()
