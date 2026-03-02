import { useState, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import type { MealItem } from '../types/meal'

type ReminderPhase = 'idle' | 'scheduled' | 'early' | 'ontime' | 'late' | 'started'

function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { h: h ?? 0, m: m ?? 0 }
}

function timeToMinutes(hhmm: string): number {
  const { h, m } = parseTime(hhmm)
  return h * 60 + m
}

interface RecipeDetailModalProps {
  meal: MealItem
  onClose: () => void
  onMealTimeChange?: (mealTime: string) => void
  onStarted?: () => void
  /** 记录实际用时（分钟），用于学习个性化做饭时长；recipeId 可选，无则仅前端记录 */
  onActualDuration?: (recipeId: string | undefined, mins: number) => void
}

export default function RecipeDetailModal({
  meal: initialMeal,
  onClose,
  onMealTimeChange,
  onStarted,
  onActualDuration,
}: RecipeDetailModalProps) {
  const { lang } = useLang()
  const [meal, setMeal] = useState(initialMeal)
  useEffect(() => {
    setMeal(initialMeal)
  }, [initialMeal.mealTime, initialMeal.nameEn])
  const [reminderPhase, setReminderPhase] = useState<ReminderPhase>('idle')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [showFinished, setShowFinished] = useState(false)
  const [actualMins, setActualMins] = useState<number | ''>('')

  const mealTimeMins = timeToMinutes(meal.mealTime)
  const cookStartByMins = mealTimeMins - meal.cookDurationMins
  const reminderEarly = Math.max(0, cookStartByMins - 5)
  const reminderOntime = cookStartByMins
  const reminderLate = Math.min(24 * 60 - 1, cookStartByMins + 5)

  useEffect(() => {
    if (reminderPhase !== 'scheduled') return
    const now = new Date()
    const currentMins = now.getHours() * 60 + now.getMinutes()
    const check = () => {
      const n = new Date()
      const cur = n.getHours() * 60 + n.getMinutes()
      if (cur >= reminderLate) setReminderPhase('late')
      else if (cur >= reminderOntime) setReminderPhase('ontime')
      else if (cur >= reminderEarly) setReminderPhase('early')
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [reminderPhase, reminderEarly, reminderOntime, reminderLate])

  const handleScheduleReminders = () => setReminderPhase('scheduled')
  const handleStarted = () => {
    setReminderPhase('started')
    setStartedAt(new Date())
    onStarted?.()
    setShowFinished(true)
  }
  const handleFinished = () => {
    const mins = typeof actualMins === 'number' ? actualMins : (actualMins !== '' ? Number(actualMins) : meal.cookDurationMins)
    if (mins >= 0) onActualDuration?.(meal.recipeId, mins)
    setShowFinished(false)
  }

  const name = lang === 'zh' ? meal.nameZh : meal.nameEn
  const desc = lang === 'zh' ? meal.descZh : meal.descEn
  const using = lang === 'zh' ? meal.usingZh : meal.usingEn
  const steps = lang === 'zh' ? meal.stepsZh : meal.stepsEn

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative h-44 bg-gradient-to-br from-[#8BA888]/20 via-[#F9F7F2] to-[#EAE3DB] rounded-t-3xl flex items-center justify-center">
          <span className="material-symbols-outlined text-7xl text-[#8BA888]/60">lunch_dining</span>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/80 text-stone-500 hover:text-stone-800 hover:bg-white transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-[#2D2D2D] tracking-tight mb-1">{name}</h2>
          <p className="text-sm text-stone-500 mb-6">{desc}</p>

          {/* 用餐时间 + 做饭时长 */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">
                {lang === 'zh' ? '用餐时间' : 'Meal time'}
              </label>
              <input
                type="time"
                value={meal.mealTime}
                onChange={(e) => {
                  const v = e.target.value
                  setMeal((m) => ({ ...m, mealTime: v }))
                  onMealTimeChange?.(v)
                }}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm font-medium text-[#2D2D2D] focus:ring-2 focus:ring-[#8BA888] focus:border-[#8BA888]"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-50 border border-stone-100">
              <span className="material-symbols-outlined text-[#8BA888] text-lg">schedule</span>
              <span className="text-sm font-medium text-stone-700">
                {lang === 'zh' ? `约 ${meal.cookDurationMins} 分钟` : `~${meal.cookDurationMins} min`}
              </span>
              <span className="text-[10px] text-stone-400">{lang === 'zh' ? '做饭' : 'cook'}</span>
            </div>
          </div>

          {/* 提醒与已开始 */}
          <div className="mb-6 p-4 rounded-2xl bg-[#F9F7F2] border border-[#EAE3DB]">
            {reminderPhase === 'idle' && (
              <button
                type="button"
                onClick={handleScheduleReminders}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#8BA888] border border-[#8BA888]/40 hover:bg-[#8BA888]/10 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">notifications</span>
                {lang === 'zh' ? '提醒我（提前 5 分钟、准时、延后 5 分钟各一次）' : 'Remind me (5 min early, on time, 5 min late)'}
              </button>
            )}
            {(reminderPhase === 'early' || reminderPhase === 'ontime' || reminderPhase === 'late') && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-stone-600">
                  {lang === 'zh' ? '该开始准备这道菜了' : "Time to start cooking"}
                </p>
                <button
                  type="button"
                  onClick={handleStarted}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-[#8BA888] text-white hover:bg-[#7a9a77] transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  {lang === 'zh' ? '已开始' : 'Started'}
                </button>
              </div>
            )}
            {reminderPhase === 'started' && (
              <p className="text-sm text-[#8BA888] font-medium flex items-center gap-2">
                <span className="material-symbols-outlined">check_circle</span>
                {lang === 'zh' ? '已开始做饭，后续提醒已取消' : 'Started — reminders cancelled'}
              </p>
            )}
            {showFinished && (
              <div className="mt-3 pt-3 border-t border-stone-200">
                <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                  {lang === 'zh' ? '实际用时（分钟）' : 'Actual time (mins)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={actualMins}
                    onChange={(e) => setActualMins(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={String(meal.cookDurationMins)}
                    className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleFinished}
                    className="px-4 py-2 rounded-lg bg-[#2D2D2D] text-white text-sm font-medium hover:bg-[#C66B49]"
                  >
                    {lang === 'zh' ? '完成' : 'Done'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 用到食材 */}
          <div className="mb-6">
            <h4 className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">eco</span>
              {lang === 'zh' ? '用到' : 'Uses'}
            </h4>
            <p className="text-sm text-stone-600">{using}</p>
          </div>

          {/* 做法 */}
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">list</span>
              {lang === 'zh' ? '做法' : 'Steps'}
            </h4>
            <p className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">{steps}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
