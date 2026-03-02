/**
 * 食谱展示名（中/英），计划页与首页按语言显示。
 */
export type RecipeDisplay = { en: string; zh: string }

export const RECIPE_NAMES: Record<string, RecipeDisplay> = {
  chicken_broccoli_only: { en: 'Chicken & Broccoli', zh: '鸡胸西兰花' },
  chicken_stir_fry: { en: 'Chicken Stir-Fry', zh: '鸡胸炒时蔬' },
  chicken_rice_bowl: { en: 'Chicken Rice Bowl', zh: '鸡胸杂粮饭' },
  tofu_stir_fry: { en: 'Garlic Tofu & Greens', zh: '蒜香豆腐炒青菜' },
  tofu_broccoli: { en: 'Tofu & Broccoli', zh: '西兰花烧豆腐' },
  tofu_broccoli_only: { en: 'Tofu Broccoli', zh: '豆腐西兰花' },
  beef_brisket_noodle: { en: 'Beef Brisket Noodles', zh: '牛腩汤面' },
  beef_mince_rice: { en: 'Beef Mince Fried Rice', zh: '牛肉末炒饭' },
  salmon_baked: { en: 'Baked Salmon with Lemon', zh: '烤三文鱼配柠檬' },
  salmon_rice: { en: 'Salmon Rice Bowl', zh: '三文鱼盖饭' },
  jiaozi_meal: { en: 'Pork Dumplings', zh: '猪肉饺子餐' },
  wonton_soup: { en: 'Wonton Soup', zh: '馄饨汤' },
  ramen_bowl: { en: 'Japanese Ramen', zh: '日式拉面' },
  korean_noodle_stir_fry: { en: 'Korean Spicy Noodles', zh: '韩式辣炒面' },
  indomie_egg: { en: 'Indomie Noodles with Egg', zh: '印尼炒面加蛋式' },
  pork_belly_rice: { en: 'Pork Belly Rice Bowl', zh: '五花肉盖饭' },
  shrimp_stir_fry: { en: 'Garlic Shrimp & Veg', zh: '蒜香虾仁时蔬' },
  spinach_eggplant: { en: 'Spinach Eggplant & Garlic', zh: '菠菜茄子和蒜' },
  potato_carrot_chicken: { en: 'Chicken Stew with Potato & Carrot', zh: '土豆胡萝卜炖鸡腿' },
  napa_cabbage_tofu_soup: { en: 'Napa Tofu Soup', zh: '白菜豆腐汤' },
  breakfast_oat_style: { en: 'Banana Apple Breakfast', zh: '香蕉苹果早餐' },
  avocado_toast_style: { en: 'Avocado & Tomato', zh: '牛油果配番茄' },
  fruit_salad: { en: 'Fruit Salad', zh: '水果沙拉' },
  pasta_aglio_olio: { en: 'Spaghetti Aglio e Olio', zh: '意式蒜香橄榄油意面' },
  pasta_tomato_basil: { en: 'Tomato Basil Pasta', zh: '番茄罗勒意面' },
  thai_stir_fry_shrimp: { en: 'Thai Shrimp Stir-Fry', zh: '泰式虾仁炒' },
  thai_green_curry_tofu: { en: 'Thai Green Curry Tofu', zh: '泰式青咖喱豆腐' },
  miso_soup_tofu: { en: 'Miso Tofu Soup', zh: '日式味噌豆腐汤' },
  teriyaki_salmon: { en: 'Teriyaki Salmon', zh: '照烧三文鱼' },
  black_bean_avocado_bowl: { en: 'Black Bean Avocado Bowl', zh: '墨西哥黑豆牛油果碗' },
  indian_curry_chickpea_style: { en: 'Indian-Style Veg Curry', zh: '印度风味咖喱时蔬' },
  chinese_oyster_sauce_greens: { en: 'Oyster Sauce Greens', zh: '蚝油时蔬' },
  kung_pao_chicken: { en: 'Kung Pao Chicken', zh: '宫保鸡丁' },
  balsamic_glaze_chicken: { en: 'Balsamic Chicken', zh: '意式香醋鸡胸' },
  korean_style_tofu: { en: 'Korean-Style Tofu', zh: '韩式辣酱烧豆腐' },
  vietnamese_style_noodle: { en: 'Vietnamese Noodle Salad', zh: '越式鱼露拌面' },
}

/** 根据 recipe_id 和语言返回展示名；apiName 为接口返回的英文名，apiNameZh 为接口返回的中文名（有则中文界面优先用） */
export function getRecipeName(recipe_id: string, lang: 'zh' | 'en', apiName?: string, apiNameZh?: string): string {
  const d = RECIPE_NAMES[recipe_id]
  if (d) return lang === 'zh' ? d.zh : d.en
  if (lang === 'zh' && apiNameZh) return apiNameZh
  if (lang === 'zh' && apiName) return apiName
  return apiName || recipe_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
