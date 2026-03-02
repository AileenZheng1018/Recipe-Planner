"""营养与成本计算单元测试。"""
import pytest
from agent import (
    recipe_nutrition_and_cost,
    macro_penalty,
    budget_penalty,
    availability_penalty,
)
from tests.conftest import MINI_INGREDIENTS, MINI_RECIPES


def test_recipe_nutrition_per_100g():
    """配方宏量按 100g 正确聚合。"""
    rec = MINI_RECIPES["chicken_broccoli"]
    nut, cost, avail = recipe_nutrition_and_cost(rec, MINI_INGREDIENTS, "UK")
    # 150g chicken: 165*1.5 cal, 31*1.5 protein; 150g broccoli: 34*1.5, 2.8*1.5
    assert nut["calories"] == pytest.approx(165 * 1.5 + 34 * 1.5, rel=0.01)
    assert nut["protein"] == pytest.approx(31 * 1.5 + 2.8 * 1.5, rel=0.01)
    assert nut["carbs"] == pytest.approx(0 + 7 * 1.5, rel=0.01)


def test_recipe_cost_per_kg():
    """成本按 price_per_kg 正确计算。"""
    rec = MINI_RECIPES["chicken_broccoli"]
    _, cost, _ = recipe_nutrition_and_cost(rec, MINI_INGREDIENTS, "UK")
    # 150g chicken @ 5.99/kg = 0.15*5.99; 150g broccoli @ 2.5/kg = 0.15*2.5
    expected = 0.15 * 5.99 + 0.15 * 2.5
    assert cost == pytest.approx(expected, rel=0.01)


def test_macro_penalty_over_calories():
    """当日剩余热量不足时产生 macro 惩罚。"""
    candidate = {"nutrition": {"calories": 800, "protein": 40}}
    p = macro_penalty(candidate, day_remaining_cal=500, day_remaining_protein=0)
    assert p > 0


def test_macro_penalty_low_protein():
    """当日仍需蛋白且本餐蛋白不足 30% 时产生惩罚。"""
    candidate = {"nutrition": {"calories": 400, "protein": 10}}
    p = macro_penalty(candidate, day_remaining_cal=2000, day_remaining_protein=50)
    assert p > 0


def test_budget_penalty_over_budget():
    """本餐成本超过剩余预算时产生惩罚。"""
    assert budget_penalty(cost=30, total_cost_so_far=25, budget_weekly=50) > 0


def test_budget_penalty_under_budget():
    """未超预算时无惩罚。"""
    assert budget_penalty(cost=10, total_cost_so_far=0, budget_weekly=50) == 0
