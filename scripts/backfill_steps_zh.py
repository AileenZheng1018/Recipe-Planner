#!/usr/bin/env python3
"""
将 recipe_steps.json 中 steps_zh 为「（做法见英文步骤）」的条目，用 steps_en 翻译为中文并写回。
需安装: pip install deep-translator
运行: python scripts/backfill_steps_zh.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STEPS_PATH = BASE / "recipe_steps.json"
PLACEHOLDER = "（做法见英文步骤）"
CHUNK_SIZE = 3500


def _translate_chunk(c: str):
    try:
        from deep_translator import GoogleTranslator
        t = GoogleTranslator(source="en", target="zh-CN").translate(c)
        return t if t and t.strip() else None
    except Exception:
        return None


def translate_long(text: str) -> str | None:
    if not text or not text.strip():
        return None
    text = text.strip()
    if len(text) <= CHUNK_SIZE:
        for _ in range(2):
            t = _translate_chunk(text)
            if t:
                return t
            time.sleep(1.0)
        return None
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text]
    chunks, cur, cur_len = [], [], 0
    for p in paragraphs:
        if cur_len + len(p) + 2 <= CHUNK_SIZE:
            cur.append(p)
            cur_len += len(p) + 2
        else:
            if cur:
                chunks.append("\n\n".join(cur))
            if len(p) > CHUNK_SIZE:
                for i in range(0, len(p), CHUNK_SIZE):
                    chunks.append(p[i : i + CHUNK_SIZE])
                cur, cur_len = [], 0
            else:
                cur, cur_len = [p], len(p) + 2
    if cur:
        chunks.append("\n\n".join(cur))
    out = []
    for i, c in enumerate(chunks):
        for _ in range(2):
            t = _translate_chunk(c)
            if t:
                out.append(t)
                break
        else:
            out.append(c)
        if i < len(chunks) - 1:
            time.sleep(0.4)
    return "\n\n".join(out) if out else None


def main() -> None:
    with open(STEPS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    for rid, rec in list(data.items()):
        if rid == "default":
            continue
        if rec.get("steps_zh") != PLACEHOLDER:
            continue
        en = rec.get("steps_en", "")
        if not en or not en.strip():
            continue
        zh = translate_long(en)
        if zh:
            rec["steps_zh"] = zh
            updated += 1
            print(f"  {rid}: steps_zh 已补全")
        else:
            print(f"  {rid}: 翻译失败，跳过")
    if updated:
        with open(STEPS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"已更新 {STEPS_PATH}，共 {updated} 条做法中文。")
    else:
        print("没有需要补全的条目，或翻译均失败。")


if __name__ == "__main__":
    main()
