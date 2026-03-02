import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type DaySchedule = {
  breakfast_time: string
  lunch_time: string
  dinner_time: string
}

const defaultDay: DaySchedule = { breakfast_time: '08:00', lunch_time: '13:00', dinner_time: '19:30' }

export type WeeklySchedule = Record<number, DaySchedule>

function timeFromDb(v: string | null): string {
  if (!v) return '08:00'
  const part = String(v).slice(0, 5)
  return part.length >= 5 ? part : '08:00'
}

type WeeklyScheduleContextType = {
  schedule: WeeklySchedule
  loading: boolean
  setDay: (dayOfWeek: number, day: Partial<DaySchedule>) => Promise<void>
  getTodayDefaults: () => DaySchedule
}

const WeeklyScheduleContext = createContext<WeeklyScheduleContextType | null>(null)

export function WeeklyScheduleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [schedule, setSchedule] = useState<WeeklySchedule>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSchedule({})
      setLoading(false)
      return
    }
    const fetch = async () => {
      const { data } = await supabase.from('user_weekly_schedule').select('*').eq('user_id', user.id)
      const next: WeeklySchedule = {}
      for (let d = 0; d <= 6; d++) next[d] = { ...defaultDay }
      ;(data ?? []).forEach((row: { day_of_week: number; breakfast_time: string; lunch_time: string; dinner_time: string }) => {
        next[row.day_of_week] = {
          breakfast_time: timeFromDb(row.breakfast_time),
          lunch_time: timeFromDb(row.lunch_time),
          dinner_time: timeFromDb(row.dinner_time),
        }
      })
      setSchedule(next)
      setLoading(false)
    }
    fetch()
  }, [user])

  const setDay = useCallback(
    async (dayOfWeek: number, patch: Partial<DaySchedule>) => {
      if (!user) return
      const current = schedule[dayOfWeek] ?? { ...defaultDay }
      const next = { ...current, ...patch }
      setSchedule((s) => ({ ...s, [dayOfWeek]: next }))
      await supabase.from('user_weekly_schedule').upsert({
        user_id: user.id,
        day_of_week: dayOfWeek,
        breakfast_time: next.breakfast_time + ':00',
        lunch_time: next.lunch_time + ':00',
        dinner_time: next.dinner_time + ':00',
      })
    },
    [user, schedule]
  )

  const getTodayDefaults = useCallback(() => {
    const dayOfWeek = new Date().getDay()
    const d = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return schedule[d] ?? defaultDay
  }, [schedule])

  return (
    <WeeklyScheduleContext.Provider value={{ schedule, loading, setDay, getTodayDefaults }}>
      {children}
    </WeeklyScheduleContext.Provider>
  )
}

export function useWeeklySchedule() {
  const ctx = useContext(WeeklyScheduleContext)
  if (!ctx)
    return {
      schedule: {} as WeeklySchedule,
      loading: false,
      setDay: async () => {},
      getTodayDefaults: () => defaultDay,
    }
  return ctx
}
