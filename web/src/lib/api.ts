const API_BASE = import.meta.env.VITE_API_URL || ''

export type PlanConstraints = {
  calories_per_day: number
  protein_min_per_day: number
  budget_weekly: number
  max_new_ingredients: number
  region: string
  days: number
}

/** 单餐可能是单选或多选（options + chosen_index）；name 为英文，name_zh 为中文（有则中文界面用） */
export type PlanMealOption = {
  name: string
  name_zh?: string
  recipe_id: string
  nutrition: { calories: number; protein: number }
  cost: number
}
export type PlanMealSlot =
  | PlanMealOption
  | { options: PlanMealOption[]; chosen_index: number }

/** 购物清单项：grams=需补足量；有 purchase_options 时有建议购买量与价格，否则 user_fill 由用户填写 */
export type ShoppingListEntry = {
  ingredient_id: string
  grams: number
  suggested_grams?: number | null
  suggested_price?: number | null
  user_fill?: boolean
}

export type PlanResponse = {
  daily_meals: Array<{
    day: number
    breakfast?: PlanMealSlot
    lunch?: PlanMealSlot
    dinner?: PlanMealSlot
  }>
  shopping_list: ShoppingListEntry[]
  new_ingredients: string[]
  explanations: string[]
}

export function getPlanSlotPrimary(slot: PlanMealSlot | undefined): PlanMealOption | undefined {
  if (!slot) return undefined
  if ('options' in slot && slot.options?.length) {
    const idx = slot.chosen_index ?? 0
    return slot.options[Math.min(idx, slot.options.length - 1)]
  }
  return slot as PlanMealOption
}

/** 根据使用数据算出的偏好加分，传给后端参与打分：做过次数、点赞等 */
export type RecipePreferenceScores = Record<string, number>

export async function planApi(
  inventory: Record<string, { quantity_g: number; priority: string }>,
  constraints: PlanConstraints,
  recipe_preference_scores?: RecipePreferenceScores | null,
  options_per_slot: number = 5
): Promise<PlanResponse> {
  const url = `${API_BASE}/api/plan`
  const body: Record<string, unknown> = {
    inventory: Object.fromEntries(
      Object.entries(inventory).map(([id, v]) => [
        id,
        { quantity_g: v.quantity_g, priority: v.priority },
      ])
    ),
    constraints,
    options_per_slot: Math.max(1, Math.min(10, options_per_slot)),
  }
  if (recipe_preference_scores && Object.keys(recipe_preference_scores).length > 0) {
    body.recipe_preference_scores = recipe_preference_scores
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `HTTP ${res.status}`)
  }
  return res.json()
}
