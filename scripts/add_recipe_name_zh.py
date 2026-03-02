#!/usr/bin/env python3
"""
为 recipes.json 中仅有英文 name、没有 name_zh 的食谱补全中文名。
运行: pip install deep-translator 后执行
  python scripts/add_recipe_name_zh.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
RECIPES_PATH = BASE / "recipes.json"


def _looks_cjk(s: str) -> bool:
    if not s:
        return False
    for c in str(s):
        if "\u4e00" <= c <= "\u9fff" or "\u3040" <= c <= "\u30ff":
            return True
    return False


def _translate_en_to_zh(text: str) -> str | None:
    if not text or len(text) > 450:
        return None
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="en", target="zh-CN").translate(text)
    except Exception:
        return None


def main() -> None:
    with open(RECIPES_PATH, "r", encoding="utf-8") as f:
        recipes = json.load(f)
    updated = 0
    for rid, rec in recipes.items():
        if rec.get("name_zh"):
            continue
        name = rec.get("name", "")
        if not name or _looks_cjk(name):
            continue
        zh = _translate_en_to_zh(name)
        if zh:
            rec["name_zh"] = zh
            updated += 1
            print(f"  {rid}: {name!r} -> {zh!r}")
        time.sleep(0.25)
    if updated:
        with open(RECIPES_PATH, "w", encoding="utf-8") as f:
            json.dump(recipes, f, ensure_ascii=False, indent=2)
        print(f"Updated {RECIPES_PATH} with {updated} name_zh.")
    else:
        print("No recipes needed name_zh (all have it or already Chinese).")


if __name__ == "__main__":
    main()
