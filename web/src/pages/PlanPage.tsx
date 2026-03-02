import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useToast } from '../contexts/ToastContext'
import { useShoppingList } from '../contexts/ShoppingListContext'
import { useUserSettings } from '../contexts/UserSettingsContext'
import { useWeeklySchedule } from '../contexts/WeeklyScheduleContext'
import { supabase } from '../lib/supabase'
import { planApi, getPlanSlotPrimary, type PlanResponse, type PlanMealOption } from '../lib/api'
import { getRecipeName } from '../data/recipeNames'
import { getIngredientName } from '../data/ingredientNames'
import SettingsModal from '../components/SettingsModal'
import type { ShoppingListItem } from '../contexts/ShoppingListContext'

/** 当前周的周一 ISO 日期，用于购物清单按周持久化 */
function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - (day === 0 ? 7 : day) + 1
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

const MEALS_FALLBACK = [
  { nameEn: 'Miso-Glazed Salmon', nameZh: '味噌三文鱼', protein: 34, carbs: 12 },
  { nameEn: 'Steamed Tofu', nameZh: '蒸豆腐', protein: 18, carbs: 28 },
]

const STEP_EXPLANATIONS = [
  { labelEn: 'Draft', labelZh: '草拟', descEn: 'List candidate meals from your stock', descZh: '根据库存先列出候选餐单' },
  { labelEn: 'Optimize', labelZh: '优化', descEn: 'Swap items and stay within budget', descZh: '自动替换食材、控制预算' },
  { labelEn: 'Done', labelZh: '完成', descEn: 'Final plan and shopping list', descZh: '得到本周方案和购物清单' },
]

export default function PlanPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const toast = useToast()
  const { items: shoppingItems, updateItem, removePurchased, setItems: setShoppingItems } = useShoppingList()
  const { settings, loading: settingsLoading } = useUserSettings()
  const { schedule } = useWeeklySchedule()
  const [showSettings, setShowSettings] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [planResult, setPlanResult] = useState<PlanResponse | null>(null)
  /** 每餐用户选中的候选下标，key: `${dayIndex}_${mealType}` */
  const [selections, setSelections] = useState<Record<string, number>>({})
  /** 当前在编辑哪一天（0–6），null 表示未在编辑 */
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)

  const confirmPurchased = async (ingredient_id: string, actualQty: number, price: number) => {
    if (!user) return
    const { error } = await supabase.from('inventory_items').insert({
      user_id: user.id,
      ingredient_id,
      quantity_g: actualQty,
      priority: 'normal',
      price_paid: price > 0 ? price : null,
      purchased_at: new Date().toISOString().slice(0, 10),
    })
    if (error) {
      const { data: existing } = await supabase.from('inventory_items').select('quantity_g').eq('user_id', user.id).eq('ingredient_id', ingredient_id).single()
      const qty = (existing as { quantity_g?: number } | null)?.quantity_g
      if (typeof qty === 'number') {
        await supabase.from('inventory_items').update({
          quantity_g: qty + actualQty,
          price_paid: price > 0 ? price : null,
          purchased_at: new Date().toISOString().slice(0, 10),
        }).eq('user_id', user.id).eq('ingredient_id', ingredient_id)
      } else {
        toast.show(lang === 'zh' ? '操作失败' : 'Failed', 'error')
        return
      }
    }
    removePurchased(ingredient_id)
    persistShoppingList(shoppingItems.filter((i) => i.ingredient_id !== ingredient_id))
    toast.show(lang === 'zh' ? '已从清单移除并加入库存' : 'Added to inventory', 'success')
  }

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
  }, [user, navigate])

  /** 加载本周已保存的购物清单 */
  useEffect(() => {
    if (!user) return
    const weekStart = getWeekStart()
    supabase
      .from('shopping_lists')
      .select('items')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.items && Array.isArray(data.items)) {
          setShoppingItems((data.items.length > 0 ? data.items : []) as ShoppingListItem[])
        } else {
          setShoppingItems([])
        }
      })
  }, [user])

  const persistShoppingList = useCallback(
    (items: ShoppingListItem[]) => {
      if (!user) return
      const weekStart = getWeekStart()
      supabase
        .from('shopping_lists')
        .upsert({ user_id: user.id, week_start: weekStart, items }, { onConflict: 'user_id,week_start' })
        .then(() => {})
    },
    [user]
  )

  const handleExecute = async () => {
    if (!user) return
    setOptimizing(true)
    try {
      const { data: invData } = await supabase.from('inventory_items').select('ingredient_id, quantity_g, priority')
      const inventory: Record<string, { quantity_g: number; priority: string }> = {}
      ;(invData ?? []).forEach((row: { ingredient_id: string; quantity_g: number; priority: string }) => {
        inventory[row.ingredient_id] = { quantity_g: row.quantity_g, priority: row.priority || 'normal' }
      })
      const constraints = {
        calories_per_day: Number(settings.goal_calories_per_day) || 2000,
        protein_min_per_day: Number(settings.goal_protein_per_day) || 130,
        budget_weekly: Number(settings.budget_weekly) || 50,
        max_new_ingredients: settings.max_new_ingredients ?? 5,
        region: settings.region || 'UK',
        days: 7,
      }
      const recipe_preference_scores: Record<string, number> = {}
      const { data: feedbackData } = await supabase.from('recipe_cook_feedback').select('recipe_id').eq('user_id', user.id)
      ;(feedbackData ?? []).forEach((row: { recipe_id: string }) => {
        recipe_preference_scores[row.recipe_id] = (recipe_preference_scores[row.recipe_id] ?? 0) + 1
      })
      const { data: prefData } = await supabase.from('user_recipe_preference').select('recipe_id').eq('user_id', user.id).eq('liked', true)
      ;(prefData ?? []).forEach((row: { recipe_id: string }) => {
        recipe_preference_scores[row.recipe_id] = (recipe_preference_scores[row.recipe_id] ?? 0) + 3
      })
      Object.keys(recipe_preference_scores).forEach((rid) => {
        recipe_preference_scores[rid] = Math.min(10, recipe_preference_scores[rid] ?? 0)
      })
      const res = await planApi(inventory, constraints, recipe_preference_scores)
      setPlanResult(res)
      const list: ShoppingListItem[] = res.shopping_list.map((entry) => {
        const grams = entry.grams
        const userFill = entry.user_fill === true
        const suggestedG = entry.suggested_grams ?? 0
        const suggestedP = entry.suggested_price ?? 0
        return {
          ingredient_id: entry.ingredient_id,
          nameEn: getIngredientName(entry.ingredient_id, 'en'),
          nameZh: getIngredientName(entry.ingredient_id, 'zh'),
          plannedQty: grams,
          actualQty: userFill ? 0 : (suggestedG || grams),
          price: userFill ? 0 : suggestedP,
          suggested_grams: suggestedG || undefined,
          suggested_price: suggestedP || undefined,
        }
      })
      setShoppingItems(list)
      persistShoppingList(list)
      toast.show(lang === 'zh' ? '计划已生成' : 'Plan generated', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.show(lang === 'zh' ? `生成失败：${msg}` : `Failed: ${msg}`, 'error')
    } finally {
      setOptimizing(false)
    }
  }

  /** 取某餐当前选中的那道（多候选时用 selections，否则用首选） */
  const getChosenOption = (dayIndex: number, mealType: string, slot: PlanResponse['daily_meals'][0]['breakfast']): PlanMealOption | undefined => {
    if (!slot) return undefined
    if ('options' in slot && slot.options?.length) {
      const key = `${dayIndex}_${mealType}`
      const idx = selections[key] ?? 0
      return slot.options[Math.min(idx, slot.options.length - 1)]
    }
    return getPlanSlotPrimary(slot)
  }

  /** 用户点击某道候选：更新选中并记录偏好（选过 = 偏好信号） */
  const handleSelectOption = async (dayIndex: number, mealType: string, optionIndex: number) => {
    setSelections((prev) => ({ ...prev, [`${dayIndex}_${mealType}`]: optionIndex }))
    if (!user || !planResult?.daily_meals?.[dayIndex]) return
    const slot = planResult.daily_meals[dayIndex][mealType as 'breakfast' | 'lunch' | 'dinner']
    if (!slot || !('options' in slot) || !slot.options?.[optionIndex]) return
    const recipe_id = slot.options[optionIndex].recipe_id
    await supabase.from('user_recipe_preference').upsert(
      { user_id: user.id, recipe_id, last_cooked_at: new Date().toISOString() },
      { onConflict: 'user_id,recipe_id' }
    )
  }

  /** 将当前生成的一周餐单（含用户选择）写入计划 */
  const handleApplyPlan = async () => {
    if (!user || !planResult?.daily_meals?.length) {
      toast.show(lang === 'zh' ? '请先生成计划' : 'Generate a plan first', 'error')
      return
    }
    setApplying(true)
    try {
      const today = new Date()
      const defaultTimes = { breakfast_time: '08:00', lunch_time: '13:00', dinner_time: '19:30' }
      for (let di = 0; di < planResult.daily_meals.length; di++) {
        const dayPlan = planResult.daily_meals[di]
        const planDate = new Date(today)
        planDate.setDate(today.getDate() + (dayPlan.day - 1))
        const planDateStr = planDate.toISOString().slice(0, 10)
        const jsDow = planDate.getDay()
        const scheduleKey = jsDow === 0 ? 6 : jsDow - 1
        const dayTimes = schedule[scheduleKey] ?? defaultTimes
        const mealTypes = ['breakfast', 'lunch', 'dinner'] as const
        for (const mealType of mealTypes) {
          const slot = dayPlan[mealType]
          const m = getChosenOption(di, mealType, slot)
          if (!m) continue
          const mealTime = dayTimes[mealType === 'breakfast' ? 'breakfast_time' : mealType === 'lunch' ? 'lunch_time' : 'dinner_time']
          await supabase.from('planned_meals').upsert(
            {
              user_id: user.id,
              plan_date: planDateStr,
              meal_type: mealType,
              recipe_id: m.recipe_id,
              recipe_name: (lang === 'zh' && m.name_zh ? m.name_zh : m.name),
              meal_time: mealTime + ':00',
              cook_duration_mins: 25,
            },
            { onConflict: 'user_id,plan_date,meal_type' }
          )
        }
      }
      toast.show(lang === 'zh' ? '已加入计划，首页将显示今日起的一周餐单' : 'Added to plan. Dashboard shows this week.', 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.show(lang === 'zh' ? `保存失败：${msg}` : `Failed: ${msg}`, 'error')
    } finally {
      setApplying(false)
    }
  }

  const totalListPrice = shoppingItems.reduce((sum, it) => sum + (it.price || 0), 0)
  const currencySymbol = settings.currency === 'GBP' ? '£' : settings.currency === 'CNY' ? '¥' : (settings.currency || '£')

  if (authLoading) return <div className="flex items-center justify-center py-20 text-stone-500">{lang === 'zh' ? '加载中…' : 'Loading…'}</div>

  return (
    <div className="flex flex-col lg:flex-row gap-16 pb-12 overflow-hidden max-w-[1400px] mx-auto">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <aside className="w-full lg:w-64 flex flex-col pt-4 shrink-0">
        <div className="mb-12">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-2">{lang === 'zh' ? '计划步骤' : 'Steps'}</h2>
          <p className="text-[10px] text-stone-500 mb-10">{lang === 'zh' ? '系统会先列候选、再优化、最后给出清单' : 'Draft → optimize → get list'}</p>
          <div className="relative ml-2">
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gradient-to-b from-stone-300 to-[#8BA888] opacity-60" />
            <div className="space-y-14 relative">
              {STEP_EXPLANATIONS.map((s, i) => (
                <div key={i} className="flex items-start gap-6">
                  <div className={`relative z-10 w-[15px] h-[15px] rounded-full border-2 border-white mt-1 shrink-0 ${i === 2 ? 'bg-[#8BA888] ring-2 ring-[#8BA888]/30' : 'bg-stone-300'}`} />
                  <div className="flex flex-col gap-1">
                    <span className={`text-[11px] font-medium ${i === 2 ? 'text-[#2D2D2D] font-bold' : 'text-stone-500'}`}>{lang === 'zh' ? s.labelZh : s.labelEn}</span>
                    <span className="text-[10px] text-stone-500">{lang === 'zh' ? s.descZh : s.descEn}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-stone-200 pt-8">
          <label className="text-[10px] uppercase tracking-widest text-stone-400">{lang === 'zh' ? '限制与目标' : 'Limits & goals'}</label>
          {!settingsLoading && (
            <>
              <div className="text-[11px] flex flex-col gap-2 mt-2">
                <div className="flex justify-between"><span className="text-stone-500">{lang === 'zh' ? '每周预算' : 'Budget/week'}</span><span className="font-medium">{currencySymbol}{settings.budget_weekly}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">{lang === 'zh' ? '每周最多新食材' : 'Max new items'}</span><span className="font-medium">{settings.max_new_ingredients}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">{lang === 'zh' ? '每日蛋白目标' : 'Protein/day'}</span><span className="font-medium">{settings.goal_protein_per_day}g</span></div>
                <div className="flex justify-between"><span className="text-stone-500">{lang === 'zh' ? '每日热量目标' : 'Calories/day'}</span><span className="font-medium">{settings.goal_calories_per_day}</span></div>
              </div>
              <button type="button" onClick={() => setShowSettings(true)} className="mt-4 text-[10px] uppercase tracking-widest text-[#8BA888] border border-[#8BA888]/20 py-2 px-4 hover:bg-[#8BA888]/5 transition-colors">
                {lang === 'zh' ? '调整' : 'Adjust'}
              </button>
            </>
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col gap-10 overflow-y-auto thin-scrollbar px-4">
        <div className="flex flex-col items-center justify-center pt-6">
          <span className="text-[10px] uppercase tracking-[0.5em] text-stone-400 mb-2">{lang === 'zh' ? '匹配度' : 'Match'}</span>
          <h1 className="text-[120px] lg:text-[140px] font-thin leading-none tracking-tighter text-[#2D2D2D] flex items-start">
            92<span className="text-4xl mt-6 lg:mt-8 ml-2 font-light text-[#8BA888]">%</span>
          </h1>
          <p className="text-[11px] text-stone-500 mt-4 max-w-sm text-center">
            {lang === 'zh' ? '根据你的库存和目标推荐以下餐品；点击「生成计划」可更新本周方案与购物清单。' : 'Recommended meals from your stock and goals. Generate plan to refresh list.'}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {planResult?.daily_meals?.[0]
            ? (['breakfast', 'lunch', 'dinner'] as const).map((mealType, i) => {
                const chosen = getChosenOption(0, mealType, planResult.daily_meals[0][mealType])
                if (!chosen) return null
                return (
                  <div key={i} className="flex flex-col gap-5">
                    <div className="aspect-[4/5] bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                      <span className="material-symbols-outlined text-6xl text-stone-300">lunch_dining</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-[#2D2D2D]">{lang === 'zh' && chosen.name_zh ? chosen.name_zh : getRecipeName(chosen.recipe_id, lang, chosen.name, chosen.name_zh)}</h3>
                      <p className="text-[10px] text-stone-500 uppercase tracking-[0.15em]">{Math.round(chosen.nutrition.protein)}g {lang === 'zh' ? '蛋白' : 'Protein'} · {currencySymbol}{chosen.cost.toFixed(2)}</p>
                    </div>
                  </div>
                )
              })
            : MEALS_FALLBACK.map((m, i) => (
                <div key={i} className="flex flex-col gap-5">
                  <div className="aspect-[4/5] bg-stone-100 rounded-lg overflow-hidden flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-stone-300">lunch_dining</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-[#2D2D2D]">{lang === 'zh' ? m.nameZh : m.nameEn}</h3>
                    <p className="text-[10px] text-stone-500 uppercase tracking-[0.15em]">{m.protein}g {lang === 'zh' ? '蛋白' : 'Protein'} · {m.carbs}g {lang === 'zh' ? '碳水' : 'Carbs'}</p>
                  </div>
                </div>
              ))}
        </div>
        {planResult && planResult.daily_meals.length > 0 && (
          <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-6">
            <h4 className="text-[10px] uppercase tracking-widest text-stone-400 mb-4">{lang === 'zh' ? '一周餐单' : '7-day plan'}</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {planResult.daily_meals.map((day, di) => (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => setEditingDayIndex(editingDayIndex === di ? null : di)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${editingDayIndex === di ? 'bg-[#8BA888] text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-[#8BA888]'}`}
                >
                  {lang === 'zh' ? `第 ${day.day} 天` : `Day ${day.day}`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {planResult.daily_meals.map((day, di) => (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => setEditingDayIndex(editingDayIndex === di ? null : di)}
                  className={`text-left text-[11px] text-stone-600 space-y-1 rounded-lg p-3 transition-colors ${editingDayIndex === di ? 'ring-2 ring-[#8BA888] bg-[#8BA888]/5' : 'hover:bg-stone-100/80'}`}
                >
                  <span className="font-semibold text-stone-700">{lang === 'zh' ? `第 ${day.day} 天` : `Day ${day.day}`}</span>
                  <ul className="space-y-0.5 mt-1">
                    {(['breakfast', 'lunch', 'dinner'] as const).map((mt) => {
                      const m = getChosenOption(di, mt, day[mt])
                      return m ? <li key={mt}>{lang === 'zh' ? (mt === 'breakfast' ? '早' : mt === 'lunch' ? '午' : '晚') : mt[0].toUpperCase()}: {getRecipeName(m.recipe_id, lang, m.name, m.name_zh)}</li> : null
                    })}
                  </ul>
                </button>
              ))}
            </div>
            {editingDayIndex !== null && planResult.daily_meals[editingDayIndex] && (
              <div className="border-t border-stone-200 pt-6">
                <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-4">
                  {lang === 'zh' ? `修改第 ${planResult.daily_meals[editingDayIndex].day} 天 · 点选后点「确认保存」` : `Edit Day ${planResult.daily_meals[editingDayIndex].day} · Click then Confirm`}
                </p>
                <div className="space-y-4">
                  {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
                    const dayPlan = planResult.daily_meals[editingDayIndex]
                    const slot = dayPlan[mealType]
                    const chosen = getChosenOption(editingDayIndex, mealType, slot)
                    if (!chosen) return null
                    const hasOptions = slot && 'options' in slot && (slot as { options: unknown[] }).options?.length
                    const key = `${editingDayIndex}_${mealType}`
                    const selectedIdx = selections[key] ?? 0
                    const label = mealType === 'breakfast' ? (lang === 'zh' ? '早' : 'B') : mealType === 'lunch' ? (lang === 'zh' ? '午' : 'L') : (lang === 'zh' ? '晚' : 'D')
                    return (
                      <div key={mealType}>
                        <span className="text-[10px] font-bold text-stone-500 uppercase mr-3">{label}</span>
                        {hasOptions ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {slot.options.map((opt: PlanMealOption, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectOption(editingDayIndex, mealType, idx)}
                                className={`px-4 py-2 rounded-lg text-left text-[11px] transition-all ${selectedIdx === idx ? 'bg-[#8BA888] text-white ring-2 ring-[#8BA888]/50' : 'bg-white border border-stone-200 text-stone-600 hover:border-[#8BA888]'}`}
                              >
                                {lang === 'zh' && opt.name_zh ? opt.name_zh : getRecipeName(opt.recipe_id, lang, opt.name, opt.name_zh)} · {currencySymbol}{opt.cost.toFixed(2)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-stone-600">{lang === 'zh' && chosen.name_zh ? chosen.name_zh : getRecipeName(chosen.recipe_id, lang, chosen.name, chosen.name_zh)} · {currencySymbol}{chosen.cost.toFixed(2)}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingDayIndex(null); toast.show(lang === 'zh' ? '已保存修改' : 'Changes saved', 'success') }}
                  className="mt-4 px-6 py-2.5 bg-[#8BA888] text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#7a9a77]"
                >
                  {lang === 'zh' ? '确认保存' : 'Confirm & save'}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="pt-8 pb-12 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
          <button type="button" disabled={optimizing} onClick={handleExecute} className="bg-[#2D2D2D] text-white px-12 py-4 rounded-lg text-[11px] uppercase tracking-widest font-bold flex items-center gap-6 hover:bg-[#C66B49] transition-all disabled:opacity-70">
            <span>{lang === 'zh' ? '生成计划' : 'Generate plan'}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
          {planResult?.daily_meals?.length ? (
            <button type="button" disabled={applying} onClick={handleApplyPlan} className="bg-[#8BA888] text-white px-10 py-4 rounded-lg text-[11px] uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-[#7a9a77] transition-all disabled:opacity-70">
              <span className="material-symbols-outlined text-sm">calendar_add_on</span>
              <span>{lang === 'zh' ? '加入计划' : 'Add to plan'}</span>
            </button>
          ) : null}
        </div>
      </section>

      <aside className="w-full lg:w-80 flex flex-col pt-4 shrink-0">
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mb-8">{lang === 'zh' ? '购物清单' : 'Shopping list'}</h2>
        <p className="text-[10px] text-stone-500 mb-4">{lang === 'zh' ? '填实际购入量与价格，点「已购入」从清单移除并加入库存' : 'Set actual qty & price, then mark purchased'}</p>
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto thin-scrollbar">
          <div className="bg-amber-50/80 p-6 rounded-lg mb-6 border border-amber-100">
            <h3 className="text-[10px] font-bold text-[#2D2D2D] uppercase tracking-widest mb-6 border-b border-amber-200/50 pb-2">
              {lang === 'zh' ? '待购' : 'To buy'}
            </h3>
            <ul className="space-y-6">
              {shoppingItems.length === 0 ? (
                <li className="text-[11px] text-stone-400">{lang === 'zh' ? '清单为空（已购项会移入库存）' : 'List empty'}</li>
              ) : (
                shoppingItems.map((item) => (
                  <li key={item.ingredient_id} className="flex flex-col gap-2 border-b border-amber-100/50 pb-4 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-[#2D2D2D]">{lang === 'zh' ? item.nameZh : item.nameEn}</span>
                    </div>
                    {(item.suggested_grams != null || item.suggested_price != null) && (
                      <p className="text-[10px] text-amber-700/80 mb-1">
                        {lang === 'zh' ? `建议购买 ${item.suggested_grams ?? '—'}g${item.suggested_price != null ? `，约 ${currencySymbol}${item.suggested_price.toFixed(2)}` : ''}` : `Suggested ${item.suggested_grams ?? '—'}g${item.suggested_price != null ? `, ~${currencySymbol}${item.suggested_price.toFixed(2)}` : ''}`}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="text-stone-400">{lang === 'zh' ? '需补足(g)' : 'Need(g)'}</span>
                        <input type="number" min={0} value={item.plannedQty} readOnly className="w-full mt-0.5 border border-stone-100 rounded px-2 py-1 bg-stone-50 text-stone-600" />
                      </div>
                      <div>
                        <span className="text-stone-400">{lang === 'zh' ? '实际(g)' : 'Actual(g)'}</span>
                        <input type="number" min={0} value={item.actualQty || ''} onChange={(e) => updateItem(item.ingredient_id, { actualQty: Number(e.target.value) || 0 })} className="w-full mt-0.5 border border-stone-200 rounded px-2 py-1 text-sm" placeholder={lang === 'zh' ? '填写购入量' : 'Qty bought'} />
                      </div>
                      <div>
                        <span className="text-stone-400">{lang === 'zh' ? '价格' : 'Price'}</span>
                        <input type="number" min={0} step={0.01} value={item.price || ''} onChange={(e) => updateItem(item.ingredient_id, { price: Number(e.target.value) || 0 })} className="w-full mt-0.5 border border-stone-200 rounded px-2 py-1 text-sm" placeholder="0" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmPurchased(item.ingredient_id, item.actualQty, item.price || 0)}
                      className="self-start text-[10px] font-bold text-[#8BA888] hover:text-[#C66B49] uppercase tracking-wider flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      {lang === 'zh' ? '已购入（移入库存）' : 'Mark purchased'}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <div className="mt-auto border-t border-stone-200 pt-8">
          <div className="flex items-baseline justify-between mb-8 px-2">
            <span className="text-[11px] text-stone-400 uppercase tracking-widest font-medium">{lang === 'zh' ? '清单合计' : 'List total'}</span>
            <span className="text-xl font-light text-[#2D2D2D]">{currencySymbol}{totalListPrice.toFixed(2)}</span>
          </div>
          <button type="button" onClick={() => {}} className="w-full bg-[#2D2D2D] text-white text-[11px] uppercase tracking-widest font-bold py-4 hover:bg-[#C66B49] transition-all shadow-sm rounded-lg">
            {lang === 'zh' ? '去下单' : 'Order'}
          </button>
        </div>
      </aside>
    </div>
  )
}
