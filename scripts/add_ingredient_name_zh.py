#!/usr/bin/env python3
"""
为 ingredients.json 中仅有英文 name、没有 name_zh 的食材补全中文名。
运行: pip install deep-translator 后执行
  python scripts/add_ingredient_name_zh.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
INGREDIENTS_PATH = BASE / "ingredients.json"


def _looks_cjk(s: str) -> bool:
    if not s:
        return False
    for c in str(s):
        if "\u4e00" <= c <= "\u9fff" or "\u3040" <= c <= "\u30ff":
            return True
    return False


def _translate_en_to_zh(text: str) -> str | None:
    if not text or len(text) > 200:
        return None
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="en", target="zh-CN").translate(text)
    except Exception:
        return None


def _id_to_title(ing_id: str) -> str:
    """从 id 生成展示用英文名，如 chicken_breast -> Chicken breast."""
    return ing_id.replace("_", " ").title().replace("Mealdb ", "MealDB ")


def main() -> None:
    with open(INGREDIENTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    for ing_id, rec in data.items():
        # 没有 name 时先用 id 生成英文名，便于后续翻译
        if not rec.get("name"):
            rec["name"] = _id_to_title(ing_id)
            updated += 1
            print(f"  {ing_id}: added name {rec['name']!r}")
        if rec.get("name_zh"):
            continue
        name = rec.get("name", "")
        if not name or _looks_cjk(name):
            continue
        zh = _translate_en_to_zh(name)
        if zh:
            rec["name_zh"] = zh
            updated += 1
            print(f"  {ing_id}: {name!r} -> {zh!r}")
        time.sleep(0.25)
    if updated:
        with open(INGREDIENTS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {INGREDIENTS_PATH} with {updated} changes.")
    else:
        print("No ingredients needed name_zh (all have it or already Chinese).")


if __name__ == "__main__":
    main()
