import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import RecipeDetailModal from '../components/RecipeDetailModal'
import WeeklyScheduleModal from '../components/WeeklyScheduleModal'
import { useWeeklySchedule } from '../contexts/WeeklyScheduleContext'
import { getRecipeName } from '../data/recipeNames'
import { getIngredientName } from '../data/ingredientNames'
import type { InventoryItem } from '../types/database'
import type { MealItem } from '../types/meal'

const MACRO = { cal: { current: 1750, target: 2500 }, protein: { current: 120, target: 140 }, carbs: { current: 185, target: 300 }, fats: { current: 54, target: 80 } }

const DAILY_MEALS_INIT: MealItem[] = [
  {
    mealTime: '08:00',
    nameEn: 'Overnight Protein Oats',
    nameZh: '隔夜蛋白燕麦',
    descEn: 'Creamy with honey & almonds',
    descZh: '蜂蜜与杏仁，隔夜浸泡更入味',
    usingEn: 'Greek Yogurt, Oats',
    usingZh: '希腊酸奶、燕麦',
    urgent: false,
    stepsEn: '1. Mix oats with milk and yogurt. 2. Add honey and almonds. 3. Refrigerate overnight.',
    stepsZh: '1. 燕麦与牛奶、酸奶混合。2. 加蜂蜜和杏仁。3. 冷藏隔夜。',
    cookDurationMins: 5,
  },
  {
    mealTime: '13:00',
    nameEn: 'Lemon Herb Chicken',
    nameZh: '柠檬香草鸡胸',
    descEn: 'Zesty pan-seared with steamed greens',
    descZh: '柠檬香草煎鸡胸，配蒸时蔬',
    usingEn: 'Chicken, Broccoli',
    usingZh: '鸡胸、西兰花',
    urgent: true,
    stepsEn: '1. Season chicken with lemon and herbs. 2. Pan-sear until golden. 3. Steam broccoli and serve.',
    stepsZh: '1. 鸡胸用柠檬和香草腌制。2. 煎至两面金黄。3. 西兰花蒸熟搭配。',
    cookDurationMins: 25,
  },
  {
    mealTime: '19:30',
    nameEn: 'Roasted Salmon & Roots',
    nameZh: '烤三文鱼与根茎',
    descEn: 'Miso-glazed salmon with sweet potato',
    descZh: '味噌三文鱼配红薯与根茎',
    usingEn: 'Salmon, Carrots',
    usingZh: '三文鱼、胡萝卜',
    urgent: false,
    stepsEn: '1. Glaze salmon with miso. 2. Roast with chopped carrots and sweet potato. 3. Serve with greens.',
    stepsZh: '1. 三文鱼涂味噌。2. 与胡萝卜、红薯一起烤制。3. 配蔬菜上桌。',
    cookDurationMins: 40,
  },
]

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const [priorityItems, setPriorityItems] = useState<InventoryItem[]>([])
  const [meals, setMeals] = useState<MealItem[]>(DAILY_MEALS_INIT)
  const [recipeModal, setRecipeModal] = useState<MealItem | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const { getTodayDefaults, loading: scheduleLoading } = useWeeklySchedule()

  /** 从计划表读取今日餐单，并拉取食谱做法填充步骤（做法不删） */
  useEffect(() => {
    if (!user || scheduleLoading) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const t = getTodayDefaults()
    const apiBase = import.meta.env.VITE_API_URL || ''
    const run = async () => {
      const { data: planned } = await supabase
        .from('planned_meals')
        .select('meal_type, recipe_id, recipe_name, meal_time, cook_duration_mins')
        .eq('plan_date', todayStr)
        .order('meal_type')
      const byType: Record<string, { recipe_id: string; recipe_name: string; meal_time: string; cook_duration_mins: number }> = {}
      ;(planned ?? []).forEach((row: { meal_type: string; recipe_id: string; recipe_name: string; meal_time: string; cook_duration_mins: number }) => {
        byType[row.meal_type] = {
          recipe_id: row.recipe_id,
          recipe_name: row.recipe_name || row.recipe_id,
          meal_time: row.meal_time ? String(row.meal_time).slice(0, 5) : t.breakfast_time,
          cook_duration_mins: row.cook_duration_mins ?? 25,
        }
      })
      let recipeDetails: Record<string, { name?: string; name_zh?: string; ingredients?: Record<string, number>; ingredient_names?: { en: Record<string, string>; zh: Record<string, string> }; steps_zh: string; steps_en: string }> = {}
      if (Object.keys(byType).length > 0) {
        try {
          const res = await fetch(`${apiBase}/api/recipes`)
          if (res.ok) {
            const data = await res.json()
            recipeDetails = data
          }
        } catch (_) {}
      }
      const order: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner']
      const times = [t.breakfast_time, t.lunch_time, t.dinner_time]
      const defaultSteps = { steps_zh: '做法见计划页或食谱库。', steps_en: 'See plan page or recipe library for steps.' }
      setMeals((prev) =>
        order.map((mealType, i) => {
          const p = byType[mealType]
          if (p) {
            const details = recipeDetails[p.recipe_id]
            const steps = details ? { steps_zh: details.steps_zh, steps_en: details.steps_en } : defaultSteps
            const nameEn = details?.name
            const nameZh = details?.name_zh ?? p.recipe_name
            const ings = details?.ingredients ?? {}
            const namesEn = details?.ingredient_names?.en ?? {}
            const namesZh = details?.ingredient_names?.zh ?? {}
            const usingPartsEn = Object.entries(ings).map(([id, g]) => `${namesEn[id] ?? getIngredientName(id, 'en')} ${g}g`).join(', ')
            const usingPartsZh = Object.entries(ings).map(([id, g]) => `${namesZh[id] ?? getIngredientName(id, 'zh')} ${g}g`).join('，')
            return {
              mealTime: p.meal_time,
              nameEn: getRecipeName(p.recipe_id, 'en', nameEn),
              nameZh: getRecipeName(p.recipe_id, 'zh', nameEn, nameZh),
              descEn: 'From your plan.',
              descZh: '来自你的计划。',
              usingEn: usingPartsEn || '—',
              usingZh: usingPartsZh || '—',
              urgent: false,
              stepsEn: steps.steps_en,
              stepsZh: steps.steps_zh,
              cookDurationMins: p.cook_duration_mins,
              recipeId: p.recipe_id,
            } as MealItem
          }
          return { ...prev[i], mealTime: times[i] }
        })
      )
    }
    run()
  }, [user, scheduleLoading, getTodayDefaults])

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    const fetch = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('priority', 'high')
        .order('updated_at', { ascending: false })
      setPriorityItems(data ?? [])
    }
    fetch()
  }, [user, navigate])

  const saveCookFeedback = async (recipeId: string | undefined, actualDurationMins: number) => {
    if (!user || !recipeId) return
    await supabase.from('recipe_cook_feedback').insert({
      user_id: user.id,
      recipe_id: recipeId,
      actual_duration_mins: actualDurationMins,
    })
  }

  const handleMealTimeChange = (index: number, mealTime: string) => {
    setMeals((prev) => prev.map((m, i) => (i === index ? { ...m, mealTime } : m)))
  }

  const handleOptimize = () => navigate('/plan')
  const handleViewPantry = () => navigate('/inventory')

  if (authLoading) return <div className="flex items-center justify-center py-20 text-stone-500">{lang === 'zh' ? '加载中…' : 'Loading…'}</div>

  return (
    <div className="max-w-7xl mx-auto space-y-16">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-12">
        {[
          { key: 'cal', labelEn: 'Calories', labelZh: '热量', unit: '', cur: MACRO.cal.current, tgt: MACRO.cal.target },
          { key: 'protein', labelEn: 'Protein', labelZh: '蛋白质', unit: 'g', cur: MACRO.protein.current, tgt: MACRO.protein.target },
          { key: 'carbs', labelEn: 'Carbs', labelZh: '碳水', unit: 'g', cur: MACRO.carbs.current, tgt: MACRO.carbs.target },
          { key: 'fats', labelEn: 'Fats', labelZh: '脂肪', unit: 'g', cur: MACRO.fats.current, tgt: MACRO.fats.target },
        ].map(({ key, labelEn, labelZh, unit, cur, tgt }) => (
          <div key={key} className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{lang === 'zh' ? labelZh : labelEn}</span>
              <span className="text-sm font-light text-[#2D2D2D]">{cur}{unit} <span className="text-stone-300">/ {tgt}{unit}</span></span>
            </div>
            <div className="h-0.5 bg-[#F0EDE9] rounded overflow-hidden">
              <div className="h-full bg-[#8BA888]" style={{ width: `${Math.min(100, (cur / tgt) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-12 gap-16">
        <div className="col-span-12 md:col-span-3 space-y-10">
          <div>
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-8 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              {lang === 'zh' ? '需要尽快用的' : 'Use first'}
            </h3>
            <div className="space-y-8">
              {priorityItems.length === 0 ? (
                <p className="text-sm text-stone-400">{lang === 'zh' ? '暂无' : 'None'}</p>
              ) : (
                priorityItems.slice(0, 5).map((it) => (
                  <div key={it.id} className="border-l-2 border-[#C66B49] pl-4 hover:bg-[#F9F7F2]/50 py-1 rounded-r transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-light text-[#2D2D2D]">{getIngredientName(it.ingredient_id, lang)}</p>
                      <span className="text-[9px] text-[#C66B49] font-bold uppercase tracking-widest">{lang === 'zh' ? '优先' : 'High'}</span>
                    </div>
                    <p className="text-[10px] text-stone-400">{it.quantity_g}g</p>
                  </div>
                ))
              )}
            </div>
            <button type="button" onClick={handleViewPantry} className="mt-12 text-[9px] tracking-[0.2em] uppercase text-stone-400 hover:text-[#C66B49] transition-colors flex items-center gap-2 font-semibold">
              {lang === 'zh' ? '查看全部库存' : 'View all'} <span className="material-symbols-outlined text-xs">arrow_right_alt</span>
            </button>
          </div>
        </div>

        <div className="col-span-12 md:col-span-6 space-y-10">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-stone-400 font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              {lang === 'zh' ? '今日餐单' : "Today's meals"}
            </h3>
            <button type="button" onClick={() => setShowScheduleModal(true)} className="text-[10px] uppercase tracking-widest text-[#8BA888] hover:text-[#7a9a77] font-medium">
              {lang === 'zh' ? '每周时间表' : 'Weekly schedule'}
            </button>
            <span className="text-[10px] text-stone-400 font-light italic">
              {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="space-y-8">
            {meals.map((m, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setRecipeModal(m)}
                className={`w-full text-left p-4 flex gap-6 items-center rounded-xl border border-[#EAE3DB] bg-[#F9F7F2] transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${m.urgent ? 'border-l-4 border-l-[#C66B49] bg-white shadow-sm' : ''}`}
              >
                <div className="w-24 h-24 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-4xl text-stone-300">lunch_dining</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1.5">
                    <h4 className="text-sm font-semibold tracking-wide text-[#2D2D2D]">{lang === 'zh' ? m.nameZh : m.nameEn}</h4>
                    <span className={`text-[9px] uppercase tracking-widest ${m.urgent ? 'text-[#C66B49] font-bold' : 'text-stone-400'}`}>{m.mealTime}</span>
                  </div>
                  <p className="text-[11px] text-stone-500 font-light leading-relaxed mb-2">{lang === 'zh' ? m.descZh : m.descEn}</p>
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[10px] ${m.urgent ? 'text-[#C66B49]' : 'text-[#8BA888]'}`}>{m.urgent ? 'timer' : 'eco'}</span>
                    <p className={`text-[9px] italic tracking-wide ${m.urgent ? 'text-[#C66B49] font-bold' : 'text-[#8BA888] font-semibold'}`}>
                      {lang === 'zh' ? '用到：' : ''}{lang === 'zh' ? m.usingZh : m.usingEn}
                    </p>
                  </div>
                  <p className="text-[9px] text-stone-400 mt-1">
                    {lang === 'zh' ? `约 ${m.cookDurationMins} 分钟` : `~${m.cookDurationMins} min`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-stone-400">chevron_right</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 space-y-12">
          <div className="space-y-8 bg-white p-8 rounded-2xl border border-[#F0EDE9]/40 shadow-sm">
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-stone-400 font-semibold">{lang === 'zh' ? '今日小结' : "Today's summary"}</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 font-semibold">{lang === 'zh' ? '库存用得怎么样' : 'Stock used'}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-light text-[#2D2D2D]">85%</span>
                  <span className="text-[9px] text-[#8BA888] uppercase tracking-widest font-bold">{lang === 'zh' ? '不错' : 'Good'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 font-semibold">{lang === 'zh' ? '本周预算' : 'Budget'}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-light text-[#2D2D2D]">3 <span className="text-stone-300 text-base">/ 5</span></span>
                  <span className="text-[9px] text-[#C66B49] uppercase tracking-widest font-bold">{lang === 'zh' ? '还能买几样' : 'items left'}</span>
                </div>
              </div>
            </div>
            <div className="pt-8 border-t border-[#F0EDE9]/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-lg text-[#C66B49]">lightbulb</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-stone-400 font-bold">{lang === 'zh' ? '小建议' : 'Tip'}</span>
              </div>
              <p className="text-[11px] leading-[1.8] text-stone-500 font-light italic">
                {lang === 'zh' ? '午餐已优先用鸡胸；晚餐搭配了健康脂肪。' : 'Lunch used chicken first; dinner adds healthy fats.'}
              </p>
            </div>
            <div className="pt-4">
              <button type="button" onClick={handleOptimize} className="w-full py-4 text-[9px] tracking-[0.2em] uppercase font-bold bg-[#2D2D2D] text-white hover:bg-[#C66B49] transition-all duration-300 rounded-xl shadow-lg">
                {lang === 'zh' ? '去计划与购物' : 'Plan & shop'}
              </button>
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-dashed border-[#8BA888]/30 bg-[#8BA888]/5 border-[#EAE3DB]">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[#8BA888]">target</span>
              <h4 className="text-[10px] tracking-[0.2em] uppercase text-[#8BA888] font-bold">{lang === 'zh' ? '目标' : 'Goal'}</h4>
            </div>
            <p className="text-[11px] text-stone-600 mb-3">{lang === 'zh' ? '连续 5 天吃到 140g 蛋白质。' : '140g protein for 5 days.'}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((d) => (
                <div key={d} className={`w-full h-1 rounded-full ${d <= 3 ? 'bg-[#8BA888]' : 'bg-stone-200'}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {showScheduleModal && <WeeklyScheduleModal onClose={() => setShowScheduleModal(false)} />}
      {recipeModal && (
        <RecipeDetailModal
          meal={recipeModal}
          onClose={() => setRecipeModal(null)}
          onMealTimeChange={(mealTime) => {
            const idx = meals.findIndex((m) => m === recipeModal)
            if (idx >= 0) handleMealTimeChange(idx, mealTime)
            setRecipeModal((m) => (m ? { ...m, mealTime } : null))
          }}
          onStarted={() => {}}
          onActualDuration={saveCookFeedback}
        />
      )}
    </div>
  )
}
