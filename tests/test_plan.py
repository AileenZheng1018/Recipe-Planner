"""计划生成与结果验证。"""
import pytest
from agent import (
    plan_week,
    build_meal_candidates,
    _get_primary_meal,
)
from tests.conftest import MINI_INGREDIENTS, MINI_RECIPES, mini_constraints, mini_inventory


def test_plan_week_returns_seven_days():
    """plan_week 返回 7 天的餐单。"""
    constraints = mini_constraints()
    inventory = mini_inventory()
    daily_meals, shopping, new_ings, explanations = plan_week(
        constraints, inventory, MINI_INGREDIENTS, MINI_RECIPES, options_per_slot=1
    )
    assert len(daily_meals) == 7
    for d in daily_meals:
        assert "day" in d
        assert d["day"] in range(1, 8)


def test_plan_week_meal_slots():
    """每天包含 breakfast/lunch/dinner 槽位（可为 None）。"""
    constraints = mini_constraints()
    inventory = mini_inventory()
    daily_meals, _, _, _ = plan_week(
        constraints, inventory, MINI_INGREDIENTS, MINI_RECIPES, options_per_slot=1
    )
    for d in daily_meals:
        for slot in ["breakfast", "lunch", "dinner"]:
            assert slot in d


def test_plan_week_primary_meal_has_recipe_id_and_nutrition():
    """每餐首选包含 recipe_id 与 nutrition。"""
    constraints = mini_constraints()
    inventory = mini_inventory()
    daily_meals, _, _, _ = plan_week(
        constraints, inventory, MINI_INGREDIENTS, MINI_RECIPES, options_per_slot=1
    )
    for d in daily_meals:
        for slot in ["lunch", "dinner"]:
            m = d.get(slot)
            primary = _get_primary_meal(m)
            if primary:
                assert "recipe_id" in primary
                assert "nutrition" in primary
                assert primary["recipe_id"] in MINI_RECIPES


def test_plan_week_shopping_list_positive():
    """购物清单中克数为正。"""
    constraints = mini_constraints()
    inventory = mini_inventory()
    _, shopping, _, _ = plan_week(
        constraints, inventory, MINI_INGREDIENTS, MINI_RECIPES, options_per_slot=1
    )
    for ing_id, grams in shopping.items():
        assert grams > 0
        assert ing_id in MINI_INGREDIENTS


def test_build_meal_candidates_has_nutrition_and_cost():
    """候选餐品包含 nutrition、cost、availability_penalty。"""
    candidates = build_meal_candidates(MINI_RECIPES, MINI_INGREDIENTS, "UK")
    assert len(candidates) >= 1
    for c in candidates:
        assert "nutrition" in c
        assert "cost" in c
        assert "availability_penalty" in c
        assert "recipe_id" in c
        assert c["recipe_id"] in MINI_RECIPES
