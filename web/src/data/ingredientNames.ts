/**
 * 食材展示名（中/英）与同义词，用于库存手动添加的输入匹配与翻译。
 * 同义词可匹配到同一 ingredient_id（如 猪五花、五花肉 -> pork_belly）。
 */
export type IngredientDisplay = { en: string; zh: string }

export const INGREDIENT_NAMES: Record<string, IngredientDisplay> = {
  chicken_breast: { en: 'Chicken breast', zh: '鸡胸肉' },
  chicken_thigh: { en: 'Chicken thigh', zh: '鸡腿' },
  chicken_wing: { en: 'Chicken wing', zh: '鸡翅' },
  beef_sirloin: { en: 'Beef sirloin', zh: '牛里脊' },
  beef_brisket: { en: 'Beef brisket', zh: '牛腩' },
  beef_ribeye: { en: 'Beef ribeye', zh: '牛眼肉' },
  beef_shank: { en: 'Beef shank', zh: '牛腱' },
  beef_mince: { en: 'Beef mince', zh: '牛肉末' },
  pork_belly: { en: 'Pork belly', zh: '五花肉' },
  pork_loin: { en: 'Pork loin', zh: '猪里脊' },
  pork_shoulder: { en: 'Pork shoulder', zh: '猪肩肉' },
  salmon_atlantic: { en: 'Atlantic salmon', zh: '大西洋三文鱼' },
  cod_fillet: { en: 'Cod fillet', zh: '鳕鱼' },
  shrimp: { en: 'Shrimp', zh: '虾仁' },
  squid: { en: 'Squid', zh: '鱿鱼' },
  tuna_fresh: { en: 'Fresh tuna', zh: '鲜金枪鱼' },
  tofu_firm: { en: 'Firm tofu', zh: '老豆腐' },
  white_rice: { en: 'White rice', zh: '大米' },
  soy_sauce: { en: 'Soy sauce', zh: '酱油' },
  oyster_sauce: { en: 'Oyster sauce', zh: '蚝油' },
  fish_sauce: { en: 'Fish sauce', zh: '鱼露' },
  miso_paste: { en: 'Miso paste', zh: '味噌' },
  chili_garlic_paste: { en: 'Chili garlic paste', zh: '蒜蓉辣酱' },
  tomato_paste: { en: 'Tomato paste', zh: '番茄膏' },
  olive_oil: { en: 'Olive oil', zh: '橄榄油' },
  sesame_oil: { en: 'Sesame oil', zh: '芝麻油' },
  rice_vinegar: { en: 'Rice vinegar', zh: '米醋' },
  balsamic_vinegar: { en: 'Balsamic vinegar', zh: '黑醋' },
  curry_paste_thai: { en: 'Thai curry paste', zh: '泰式咖喱酱' },
  coconut_milk: { en: 'Coconut milk', zh: '椰浆' },
  curry_powder: { en: 'Curry powder', zh: '咖喱粉' },
  pasta_spaghetti: { en: 'Spaghetti', zh: '意面' },
  black_beans_canned: { en: 'Canned black beans', zh: '黑豆罐头' },
  lime: { en: 'Lime', zh: '青柠' },
  broccoli: { en: 'Broccoli', zh: '西兰花' },
  spinach: { en: 'Spinach', zh: '菠菜' },
  carrots: { en: 'Carrots', zh: '胡萝卜' },
  potatoes: { en: 'Potatoes', zh: '土豆' },
  tomato: { en: 'Tomato', zh: '番茄' },
  onion_yellow: { en: 'Yellow onion', zh: '黄洋葱' },
  garlic: { en: 'Garlic', zh: '蒜' },
  bell_pepper_red: { en: 'Red bell pepper', zh: '红甜椒' },
  napa_cabbage: { en: 'Napa cabbage', zh: '大白菜' },
  bok_choy: { en: 'Bok choy', zh: '青菜/小白菜' },
  shiitake_mushroom: { en: 'Shiitake mushroom', zh: '香菇' },
  green_bean: { en: 'Green beans', zh: '四季豆' },
  eggplant: { en: 'Eggplant', zh: '茄子' },
  cucumber: { en: 'Cucumber', zh: '黄瓜' },
  ginger: { en: 'Ginger', zh: '姜' },
  romaine_lettuce: { en: 'Romaine lettuce', zh: '罗马生菜' },
  apples: { en: 'Apples', zh: '苹果' },
  bananas: { en: 'Bananas', zh: '香蕉' },
  grapes: { en: 'Grapes', zh: '葡萄' },
  oranges: { en: 'Oranges', zh: '橙子' },
  lemon: { en: 'Lemon', zh: '柠檬' },
  avocado: { en: 'Avocado', zh: '牛油果' },
  strawberry: { en: 'Strawberry', zh: '草莓' },
  mango: { en: 'Mango', zh: '芒果' },
  pear: { en: 'Pear', zh: '梨' },
  jiaozi_pork: { en: 'Pork dumplings', zh: '猪肉饺子' },
  jiaozi_vegetable: { en: 'Vegetable dumplings', zh: '素饺子' },
  wonton_pork: { en: 'Pork wonton', zh: '猪肉馄饨' },
  instant_noodles_chinese: { en: 'Chinese instant noodles', zh: '中式方便面' },
  instant_noodles_japanese_ramen: { en: 'Japanese ramen', zh: '日式拉面' },
  instant_noodles_korean: { en: 'Korean instant noodles', zh: '韩式方便面' },
  instant_noodles_indomie: { en: 'Indomie noodles', zh: '印尼方便面' },
  instant_noodles_udon: { en: 'Udon noodles', zh: '乌冬面' },
}

/** 同义词/别称 -> ingredient_id，用于输入匹配（小写匹配）。如 猪五花、五花肉 -> pork_belly */
export const INGREDIENT_SYNONYMS: Record<string, string> = {
  '猪五花': 'pork_belly',
  '五花肉': 'pork_belly',
  'pork belly': 'pork_belly',
  '鸡胸': 'chicken_breast',
  '鸡胸肉': 'chicken_breast',
  'chicken breast': 'chicken_breast',
  '鸡腿': 'chicken_thigh',
  'chicken thigh': 'chicken_thigh',
  '鸡翅': 'chicken_wing',
  '牛腩': 'beef_brisket',
  '牛肉末': 'beef_mince',
  '豆腐': 'tofu_firm',
  '老豆腐': 'tofu_firm',
  'tofu': 'tofu_firm',
  '大米': 'white_rice',
  '米饭': 'white_rice',
  'rice': 'white_rice',
  '酱油': 'soy_sauce',
  '西兰花': 'broccoli',
  '菠菜': 'spinach',
  '胡萝卜': 'carrots',
  '土豆': 'potatoes',
  '番茄': 'tomato',
  '西红柿': 'tomato',
  '洋葱': 'onion_yellow',
  '蒜': 'garlic',
  '大蒜': 'garlic',
  '姜': 'ginger',
  '青椒': 'bell_pepper_red',
  '红椒': 'bell_pepper_red',
  '白菜': 'napa_cabbage',
  '大白菜': 'napa_cabbage',
  '青菜': 'bok_choy',
  '小白菜': 'bok_choy',
  '香菇': 'shiitake_mushroom',
  '三文鱼': 'salmon_atlantic',
  'salmon': 'salmon_atlantic',
  '虾': 'shrimp',
  '虾仁': 'shrimp',
  '茄子': 'eggplant',
  '黄瓜': 'cucumber',
  '柠檬': 'lemon',
  '青柠': 'lime',
  '蚝油': 'oyster_sauce',
  '鱼露': 'fish_sauce',
  '味噌': 'miso_paste',
  '意面': 'pasta_spaghetti',
  '意大利面': 'pasta_spaghetti',
  '黑豆': 'black_beans_canned',
  '椰浆': 'coconut_milk',
  '咖喱粉': 'curry_powder',
  '橄榄油': 'olive_oil',
  '芝麻油': 'sesame_oil',
  '米醋': 'rice_vinegar',
}

/** 根据 id 取展示名 */
export function getIngredientName(id: string, lang: 'zh' | 'en'): string {
  const d = INGREDIENT_NAMES[id as keyof typeof INGREDIENT_NAMES]
  if (d) return lang === 'zh' ? d.zh : d.en
  return id.replace(/_/g, ' ')
}

/** 用户输入匹配到 ingredient_id：先查同义词，再按名称模糊匹配 */
export function matchIngredientInput(
  input: string,
  ids: readonly string[]
): string | null {
  const raw = input.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const syn = INGREDIENT_SYNONYMS[raw] ?? INGREDIENT_SYNONYMS[lower]
  if (syn && ids.includes(syn)) return syn
  for (const id of ids) {
    const d = INGREDIENT_NAMES[id as keyof typeof INGREDIENT_NAMES]
    if (!d) continue
    if (d.zh === raw || d.zh.includes(raw) || raw.includes(d.zh)) return id
    if (d.en.toLowerCase() === lower || d.en.toLowerCase().includes(lower) || lower.includes(d.en.toLowerCase())) return id
    const idSlug = id.replace(/_/g, ' ')
    if (idSlug.toLowerCase() === lower || idSlug.toLowerCase().includes(lower)) return id
  }
  return null
}
