#!/usr/bin/env python3
"""为 recipe_steps.json 中缺失做法的内置食谱添加 steps_zh / steps_en。"""
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STEPS_PATH = BASE / "recipe_steps.json"
RECIPES_PATH = BASE / "recipes.json"

# 内置食谱做法（仅包含当前在 recipe_steps 中缺失的）
BUILTIN_STEPS = {
    "chicken_rice_bowl": {
        "steps_zh": "1. 鸡胸切丁，杂粮米煮熟。2. 鸡丁炒熟，可加少许酱油。3. 碗中盛饭，铺鸡丁与蔬菜，可配溏心蛋。",
        "steps_en": "1. Dice chicken, cook grains. 2. Stir-fry chicken until done, optional soy sauce. 3. Bowl rice, top with chicken and veg, optional egg.",
    },
    "tofu_broccoli": {
        "steps_zh": "1. 豆腐切块，西兰花掰小朵。2. 豆腐煎至两面微黄，盛出。3. 西兰花炒或焯熟，与豆腐同烧，勾芡调味。",
        "steps_en": "1. Cut tofu, break broccoli. 2. Pan-fry tofu until golden, set aside. 3. Cook broccoli, combine with tofu, thicken and season.",
    },
    "tofu_broccoli_only": {
        "steps_zh": "1. 豆腐切块，西兰花掰小朵。2. 蒜末爆香，下豆腐与西兰花同炒。3. 加少许水或高汤烧片刻，调味即可。",
        "steps_en": "1. Cut tofu and broccoli. 2. Fry garlic, add tofu and broccoli. 3. Add a little water or stock, simmer and season.",
    },
    "beef_mince_rice": {
        "steps_zh": "1. 牛肉末用料酒、酱油腌一下。2. 热锅炒散牛肉末，加洋葱、青豆等炒匀。3. 倒入隔夜饭炒散，淋酱油调味即可。",
        "steps_en": "1. Marinate beef mince with wine and soy. 2. Stir-fry mince, add onion and peas. 3. Add cooked rice, break up and season with soy.",
    },
    "salmon_rice": {
        "steps_zh": "1. 三文鱼煎或烤熟，可淋照烧汁。2. 米饭煮好，可拌少许寿司醋。3. 碗中盛饭，铺三文鱼，可配海苔、芝麻。",
        "steps_en": "1. Pan-fry or bake salmon, optional teriyaki. 2. Cook rice, optional sushi vinegar. 3. Bowl rice, top with salmon, nori, sesame.",
    },
    "jiaozi_meal": {
        "steps_zh": "1. 调馅：猪肉末加姜末、酱油、盐搅匀。2. 饺子皮包馅，捏紧。3. 沸水煮至浮起再煮 2～3 分钟，或煎成锅贴。",
        "steps_en": "1. Mix filling: pork, ginger, soy, salt. 2. Wrap in wrappers, seal. 3. Boil until floating plus 2–3 min, or pan-fry as potstickers.",
    },
    "wonton_soup": {
        "steps_zh": "1. 馄饨馅调好，用馄饨皮包成元宝形。2. 高汤或清水烧开，下馄饨煮至浮起熟透。3. 碗中加紫菜、葱花，盛入馄饨与汤即可。",
        "steps_en": "1. Fill wonton wrappers, seal. 2. Boil broth or water, add wontons until cooked. 3. Bowl with nori and scallion, add wontons and soup.",
    },
    "ramen_bowl": {
        "steps_zh": "1. 煮好拉面，过凉水或直接盛碗。2. 高汤加热调味（味噌或酱油底）。3. 面上铺溏心蛋、叉烧、海苔、玉米等即可。",
        "steps_en": "1. Cook ramen noodles, drain or bowl. 2. Heat and season broth (miso or soy). 3. Top with egg, chashu, nori, corn, etc.",
    },
    "korean_noodle_stir_fry": {
        "steps_zh": "1. 韩式年糕或拉面煮熟。2. 蒜、韩式辣酱炒香，下蔬菜与肉片炒匀。3. 加入煮好的面/年糕翻炒，调味即可。",
        "steps_en": "1. Cook Korean noodles or rice cakes. 2. Fry garlic and gochujang, add veg and meat. 3. Toss with noodles, season.",
    },
    "indomie_egg": {
        "steps_zh": "1. 印尼面煮熟，沥水。2. 按包装调好料包拌匀。3. 煎一个蛋铺在面上，可加葱花、炸葱。",
        "steps_en": "1. Cook Indomie noodles, drain. 2. Mix with seasoning from packet. 3. Top with fried egg, scallion, fried shallot.",
    },
    "pork_belly_rice": {
        "steps_zh": "1. 五花肉切片，用酱油、糖、料酒腌一下。2. 煎或烤至微焦出油。3. 碗中盛饭，铺五花肉、溏心蛋、腌菜即可。",
        "steps_en": "1. Slice pork belly, marinate with soy, sugar, wine. 2. Pan-fry or grill until slightly crisp. 3. Bowl rice, top with pork, egg, pickles.",
    },
    "shrimp_stir_fry": {
        "steps_zh": "1. 虾仁去线，蒜切末。2. 蒜末爆香，下虾仁炒至变色。3. 加入时蔬与少许酱油或鱼露快炒即可。",
        "steps_en": "1. Devein shrimp, mince garlic. 2. Fry garlic, add shrimp until pink. 3. Add vegetables and soy or fish sauce, quick stir-fry.",
    },
    "spinach_eggplant": {
        "steps_zh": "1. 茄子切条，菠菜洗净。2. 茄子煎或蒸软，蒜末爆香。3. 下菠菜与茄子同炒，调味即可。",
        "steps_en": "1. Slice eggplant, wash spinach. 2. Cook eggplant until soft, fry garlic. 3. Add spinach and eggplant, stir-fry and season.",
    },
    "potato_carrot_chicken": {
        "steps_zh": "1. 鸡腿切块，土豆、胡萝卜切块。2. 鸡块炒香，加水与土豆、胡萝卜同炖。3. 炖至软烂，调味收汁即可。",
        "steps_en": "1. Cut chicken, potato, carrot into chunks. 2. Brown chicken, add water and veg, simmer. 3. Cook until tender, season and reduce.",
    },
    "napa_cabbage_tofu_soup": {
        "steps_zh": "1. 白菜切段，豆腐切块。2. 锅中加水或高汤烧开，下豆腐与白菜。3. 煮至白菜软烂，加盐、白胡椒调味即可。",
        "steps_en": "1. Cut napa and tofu. 2. Boil water or stock, add tofu and cabbage. 3. Simmer until cabbage is soft, season with salt and pepper.",
    },
    "breakfast_oat_style": {
        "steps_zh": "1. 香蕉、苹果、梨切小块。2. 可与燕麦、酸奶或牛奶混合，或直接拌成水果碗。3. 即食或冷藏后食用。",
        "steps_en": "1. Chop banana, apple, pear. 2. Mix with oats, yogurt or milk, or serve as fruit bowl. 3. Eat fresh or chilled.",
    },
    "avocado_toast_style": {
        "steps_zh": "1. 牛油果捣成泥，加柠檬汁、盐调味。2. 番茄切片。3. 面包烤脆，抹牛油果泥，铺番茄即可。",
        "steps_en": "1. Mash avocado with lemon and salt. 2. Slice tomato. 3. Toast bread, spread avocado, top with tomato.",
    },
    "fruit_salad": {
        "steps_zh": "1. 橙子、葡萄、草莓、苹果洗净切块。2. 混合放入碗中。3. 可淋少许蜂蜜或酸奶，即食。",
        "steps_en": "1. Wash and cut oranges, grapes, strawberries, apple. 2. Combine in a bowl. 3. Optional honey or yogurt, serve.",
    },
    "pasta_aglio_olio": {
        "steps_zh": "1. 意面按包装煮熟，留少许面汤。2. 橄榄油炒香蒜片与辣椒，下面条翻炒。3. 加柠檬汁、盐、黑胡椒调味，可撒欧芹。",
        "steps_en": "1. Cook pasta, reserve some water. 2. Fry garlic and chilli in olive oil, toss with pasta. 3. Lemon, salt, pepper, optional parsley.",
    },
    "pasta_tomato_basil": {
        "steps_zh": "1. 意面煮熟。2. 番茄、蒜、洋葱炒软成酱，加罗勒。3. 与面条拌匀，加盐与橄榄油调味。",
        "steps_en": "1. Cook pasta. 2. Cook tomato, garlic, onion into sauce, add basil. 3. Toss with pasta, salt and olive oil.",
    },
    "thai_stir_fry_shrimp": {
        "steps_zh": "1. 虾仁腌一下，彩椒、豆角切好。2. 热锅爆香蒜与鱼露，下虾仁与蔬菜快炒。3. 淋青柠汁，调味即可。",
        "steps_en": "1. Marinate shrimp, slice pepper and beans. 2. Fry garlic and fish sauce, add shrimp and veg. 3. Lime juice, season.",
    },
    "thai_green_curry_tofu": {
        "steps_zh": "1. 豆腐切块，备好青咖喱酱与椰浆。2. 锅中炒香咖喱酱，加椰浆与蔬菜、豆腐煮开。3. 煮至入味，配米饭。",
        "steps_en": "1. Cut tofu, have green curry paste and coconut milk. 2. Fry paste, add coconut milk, veg and tofu, simmer. 3. Serve with rice.",
    },
    "miso_soup_tofu": {
        "steps_zh": "1. 水烧开，放入海带或柴鱼高汤。2. 豆腐切小块、味噌化开入锅，煮至微沸。3. 可加裙带菜、葱花，即食。",
        "steps_en": "1. Boil water with dashi or kelp. 2. Add tofu and dissolved miso, do not boil hard. 3. Optional wakame and scallion, serve.",
    },
    "teriyaki_salmon": {
        "steps_zh": "1. 三文鱼用照烧汁（酱油、糖、料酒）腌片刻。2. 煎或烤至表面焦香、内里嫩熟。3. 可淋剩余酱汁，配米饭与蔬菜。",
        "steps_en": "1. Marinate salmon in teriyaki (soy, sugar, sake). 2. Pan-fry or bake until glazed and cooked. 3. Drizzle sauce, serve with rice.",
    },
    "black_bean_avocado_bowl": {
        "steps_zh": "1. 黑豆煮熟或使用罐装，牛油果切块。2. 碗中铺米饭或生菜，放黑豆、牛油果、玉米、番茄等。3. 淋青柠汁与少许盐即可。",
        "steps_en": "1. Cook or use canned black beans, slice avocado. 2. Bowl with rice or lettuce, beans, avocado, corn, tomato. 3. Lime and salt.",
    },
    "indian_curry_chickpea_style": {
        "steps_zh": "1. 洋葱、番茄、咖喱粉炒香。2. 加入鹰嘴豆与椰浆或番茄酱炖煮。3. 炖至入味，配米饭或饼。",
        "steps_en": "1. Fry onion, tomato, curry powder. 2. Add chickpeas and coconut or tomato, simmer. 3. Serve with rice or flatbread.",
    },
    "chinese_oyster_sauce_greens": {
        "steps_zh": "1. 青菜洗净，蒜末备好。2. 沸水焯青菜或直接炒。3. 蒜末爆香，下青菜快炒，淋蚝油与少许糖调味即可。",
        "steps_en": "1. Wash greens, mince garlic. 2. Blanch or stir-fry greens. 3. Fry garlic, add greens, oyster sauce and a little sugar.",
    },
    "kung_pao_chicken": {
        "steps_zh": "1. 鸡丁用淀粉、料酒腌一下，过油滑熟。2. 爆香干辣椒、花椒，下葱姜与鸡丁。3. 淋宫保汁（酱油、醋、糖、淀粉）快炒，加花生即可。",
        "steps_en": "1. Marinate chicken, stir-fry until done. 2. Fry dried chilli and Sichuan pepper, add chicken. 3. Add kung pao sauce, peanuts.",
    },
    "balsamic_glaze_chicken": {
        "steps_zh": "1. 鸡胸煎至两面金黄。2. 用香醋、蜂蜜或糖调成酱汁，淋入收浓。3. 切块装盘，可配蔬菜。",
        "steps_en": "1. Pan-fry chicken breast until golden. 2. Glaze with balsamic and honey or sugar, reduce. 3. Slice and serve with veg.",
    },
    "korean_style_tofu": {
        "steps_zh": "1. 豆腐切厚片，煎至两面微黄。2. 韩式辣酱、蒜、酱油、糖调成酱。3. 酱汁与豆腐同烧至入味即可。",
        "steps_en": "1. Slice tofu, pan-fry until golden. 2. Mix gochujang, garlic, soy, sugar. 3. Simmer tofu in sauce until coated.",
    },
    "vietnamese_style_noodle": {
        "steps_zh": "1. 米粉煮熟过凉。2. 调鱼露汁：鱼露、青柠、糖、蒜、辣椒。3. 面上铺蔬菜、香草，淋汁拌匀即可。",
        "steps_en": "1. Cook rice noodles, rinse. 2. Mix fish sauce, lime, sugar, garlic, chilli. 3. Top with veg and herbs, toss with dressing.",
    },
}


def main() -> None:
    with open(RECIPES_PATH, "r", encoding="utf-8") as f:
        recipe_ids = set(json.load(f).keys())
    with open(STEPS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    added = 0
    for rid, steps in BUILTIN_STEPS.items():
        if rid not in recipe_ids:
            continue
        if rid in data and data[rid].get("steps_zh") and data[rid]["steps_zh"] != "（做法见英文步骤）":
            continue
        data[rid] = steps
        added += 1
        print(f"  + {rid}")
    if added:
        with open(STEPS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"已为 {added} 个内置食谱添加做法。")
    else:
        print("无需添加或已存在。")


if __name__ == "__main__":
    main()
