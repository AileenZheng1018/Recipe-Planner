#!/usr/bin/env python3
"""
为 recipe_steps.json 中 steps_zh 为「（做法见英文步骤）」的条目，用英文 steps_en 分块翻译后写回 steps_zh。
运行前: pip install deep-translator
  python scripts/fill_recipe_steps_zh.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STEPS_PATH = BASE / "recipe_steps.json"
CHUNK_SIZE = 4000
PLACEHOLDER = "（做法见英文步骤）"


def _translate_chunk(text: str) -> str | None:
    if not text or len(text) > CHUNK_SIZE:
        return None
    try:
        from deep_translator import GoogleTranslator
        t = GoogleTranslator(source="en", target="zh-CN").translate(text)
        return t if t and t.strip() else None
    except Exception:
        return None


def _translate_long_en_to_zh(long_text: str) -> str | None:
    if not long_text or not long_text.strip():
        return None
    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        return None
    paragraphs = [p.strip() for p in long_text.split("\n\n") if p.strip()]
    chunks, current, current_len = [], [], 0
    for p in paragraphs:
        if current_len + len(p) + 2 <= CHUNK_SIZE:
            current.append(p)
            current_len += len(p) + 2
        else:
            if current:
                chunks.append("\n\n".join(current))
            if len(p) > CHUNK_SIZE:
                for i in range(0, len(p), CHUNK_SIZE):
                    chunks.append(p[i : i + CHUNK_SIZE])
                current, current_len = [], 0
            else:
                current, current_len = [p], len(p) + 2
    if current:
        chunks.append("\n\n".join(current))
    out = []
    for i, c in enumerate(chunks):
        try:
            t = GoogleTranslator(source="en", target="zh-CN").translate(c)
            if t and t.strip():
                out.append(t.strip())
        except Exception:
            out.append(c)
        if i < len(chunks) - 1:
            time.sleep(0.3)
    return "\n\n".join(out) if out else None


def main() -> None:
    with open(STEPS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    for rid, rec in list(data.items()):
        if rid == "default":
            continue
        steps_zh = rec.get("steps_zh") or ""
        steps_en = rec.get("steps_en") or ""
        if steps_zh.strip() != PLACEHOLDER or not steps_en.strip():
            continue
        zh = _translate_long_en_to_zh(steps_en) if len(steps_en) > CHUNK_SIZE else _translate_chunk(steps_en)
        if zh:
            rec["steps_zh"] = zh
            updated += 1
            print(f"  {rid}: steps_zh 已补译（{len(zh)} 字）")
        time.sleep(0.25)
    if updated:
        with open(STEPS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"已更新 {STEPS_PATH}，共 {updated} 条做法译成中文。")
    else:
        print("没有需要补译的条目（steps_zh 已非「做法见英文步骤」或缺少 steps_en）。")


if __name__ == "__main__":
    main()
