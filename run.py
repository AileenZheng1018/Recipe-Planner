#!/usr/bin/env python3
"""
CLI 入口：可传参覆盖 demo 默认值（简单版，hackathon 级）
用法: python run.py [--region UK|CN] [--max-new 6] [--days 7]
"""
import argparse
from agent import (
    load_ingredients,
    load_recipes,
    build_constraints,
    normalize_inventory,
    plan_week,
    format_plan,
    run_demo,
)


def main():
    p = argparse.ArgumentParser(description="Inventory-Aware Nutrition Planning Agent")
    p.add_argument("--demo", action="store_true", help="跑默认 demo（鸡胸+豆腐+西兰花）")
    p.add_argument("--region", default="UK", choices=["UK", "CN"], help="地区")
    p.add_argument("--max-new", type=int, default=6, help="每周最多新增食材种类数")
    p.add_argument("--days", type=int, default=7, help="规划天数")
    p.add_argument("--calories", type=float, default=2000, help="每日目标热量")
    p.add_argument("--protein", type=float, default=130, help="每日最低蛋白(g)")
    p.add_argument("--budget", type=float, default=50, help="周预算(£)")
    # 忽略以 # 开头的参数（避免把命令行注释当参数传入报错）
    args, _ = p.parse_known_args()

    if args.demo:
        run_demo()
        return

    ingredients_db = load_ingredients()
    recipes_db = load_recipes()
    inventory = normalize_inventory({
        "chicken_breast": {"quantity": 1000, "priority": "high"},
        "tofu_firm": {"quantity": 500, "priority": "high"},
        "broccoli": {"quantity": 600, "priority": "normal"},
    })
    constraints = build_constraints(
        calories_per_day=args.calories,
        protein_min_per_day=args.protein,
        budget_weekly=args.budget,
        max_new_ingredients=args.max_new,
        region=args.region,
        days=args.days,
    )
    daily_meals, shopping_list, new_ingredients, explanations = plan_week(
        constraints, inventory, ingredients_db, recipes_db
    )
    print(format_plan(daily_meals, shopping_list, new_ingredients, explanations, ingredients_db))


if __name__ == "__main__":
    main()
