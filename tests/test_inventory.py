"""库存归一化与优先逻辑测试。"""
import pytest
from agent import (
    normalize_inventory,
    inventory_usage_score,
    freshness_adjustment,
    new_ingredient_penalty,
)
from tests.conftest import MINI_INGREDIENTS, MINI_RECIPES


def test_normalize_inventory_quantity_g():
    """支持 quantity_g 与 quantity 两种字段。"""
    raw = {"chicken_breast": {"quantity_g": 500}, "broccoli": {"quantity": 300}}
    inv = normalize_inventory(raw)
    assert inv["chicken_breast"]["quantity"] == 500
    assert inv["broccoli"]["quantity"] == 300


def test_normalize_inventory_days_and_storage():
    """支持 days_since_purchase 与 storage_type。"""
    raw = {"chicken_breast": {"quantity_g": 200, "days_since_purchase": 1, "storage_type": "refrigerated"}}
    inv = normalize_inventory(raw)
    assert inv["chicken_breast"]["days_since_purchase"] == 1
    assert inv["chicken_breast"]["storage_type"] == "refrigerated"


def test_inventory_usage_score_high_priority():
    """使用 high priority 库存时得分更高。"""
    candidate = {"ingredients": {"chicken_breast": 150, "broccoli": 100}}
    inv_high = {"chicken_breast": {"quantity": 500, "priority": "high"}, "broccoli": {"quantity": 200, "priority": "normal"}}
    inv_normal = {"chicken_breast": {"quantity": 500, "priority": "normal"}, "broccoli": {"quantity": 200, "priority": "normal"}}
    score_high = inventory_usage_score(candidate, inv_high)
    score_normal = inventory_usage_score(candidate, inv_normal)
    assert score_high > score_normal


def test_freshness_adjustment_urgent():
    """快过期的库存（剩余天数少）得到更高新鲜度加分。"""
    candidate = {"ingredients": {"chicken_breast": 200}}
    # 冷藏 2 天保质，已放 1 天 -> 剩余 1 天
    inv_urgent = {"chicken_breast": {"quantity": 300, "days_since_purchase": 1, "storage_type": "refrigerated"}}
    inv_fresh = {"chicken_breast": {"quantity": 300, "days_since_purchase": 0, "storage_type": "refrigerated"}}
    ing = MINI_INGREDIENTS["chicken_breast"]
    bonus_urgent = freshness_adjustment(candidate, inv_urgent, {"chicken_breast": ing})
    bonus_fresh = freshness_adjustment(candidate, inv_fresh, {"chicken_breast": ing})
    assert bonus_urgent >= bonus_fresh


def test_new_ingredient_penalty_over_quota():
    """已达新食材上限且本餐仍引入新种类时重罚。"""
    candidate = {"ingredients": {"chicken_breast": 100, "new_ing": 50}}
    inv = {"chicken_breast": {"quantity": 200}}
    penalty = new_ingredient_penalty(candidate, inv, {"other_new"}, max_new_ingredients=1)
    assert penalty == 100.0
