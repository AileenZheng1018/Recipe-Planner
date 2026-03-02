"""Pytest fixtures: 最小 ingredients/recipes 与 constraints/inventory。"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent import (
    build_constraints,
    normalize_inventory,
    Constraints,
)

# 最小食材：营养按 100g，价格 price_per_kg
MINI_INGREDIENTS = {
    "chicken_breast": {
        "category": "meat",
        "nutrition_per_100g": {"calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0},
        "price_per_kg": 5.99,
        "availability": {"UK": 0.2, "CN": 0.45},
        "storage": {"room_temp_days": None, "refrigerated_days": 2, "frozen_days": 90},
    },
    "broccoli": {
        "category": "vegetable",
        "nutrition_per_100g": {"calories": 34, "protein": 2.8, "carbs": 7, "fat": 0.4, "fiber": 2.6},
        "price_per_kg": 2.5,
        "availability": {"UK": 0.1, "CN": 0.2},
        "storage": {"room_temp_days": 3, "refrigerated_days": 5, "frozen_days": 180},
    },
    "rice": {
        "category": "grain",
        "nutrition_per_100g": {"calories": 130, "protein": 2.7, "carbs": 28, "fat": 0.3, "fiber": 0.4},
        "price_per_kg": 1.2,
        "availability": {"UK": 0.1, "CN": 0.05},
        "storage": {"room_temp_days": 365, "refrigerated_days": None, "frozen_days": None},
    },
}

MINI_RECIPES = {
    "chicken_broccoli": {
        "name": "Chicken Broccoli",
        "ingredients": {"chicken_breast": 150, "broccoli": 150},
        "servings": 1,
        "meal_type": ["lunch", "dinner"],
    },
    "chicken_rice": {
        "name": "Chicken Rice",
        "ingredients": {"chicken_breast": 100, "rice": 80},
        "servings": 1,
        "meal_type": ["lunch", "dinner"],
    },
}


def mini_constraints() -> Constraints:
    return build_constraints(
        calories_per_day=2000,
        protein_min_per_day=130,
        budget_weekly=50,
        max_new_ingredients=5,
        region="UK",
        days=7,
    )


def mini_inventory():
    return normalize_inventory({
        "chicken_breast": {"quantity_g": 500, "priority": "high"},
        "broccoli": {"quantity": 300, "priority": "normal"},
    })
