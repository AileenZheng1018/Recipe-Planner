import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type UserSettings = {
  budget_weekly: number
  max_new_ingredients: number
  goal_protein_per_day: number
  goal_calories_per_day: number
  currency: string
  region: string
}

const defaults: UserSettings = {
  budget_weekly: 50,
  max_new_ingredients: 5,
  goal_protein_per_day: 130,
  goal_calories_per_day: 2000,
  currency: 'GBP',
  region: 'UK',
}

type UserSettingsContextType = {
  settings: UserSettings
  loading: boolean
  setSettings: (s: Partial<UserSettings>) => Promise<void>
}

const UserSettingsContext = createContext<UserSettingsContextType | null>(null)

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettingsState] = useState<UserSettings>(defaults)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSettingsState(defaults)
      setLoading(false)
      return
    }
    const fetch = async () => {
      const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single()
      if (data) {
        setSettingsState({
          budget_weekly: Number(data.budget_weekly) ?? defaults.budget_weekly,
          max_new_ingredients: Number(data.max_new_ingredients) ?? defaults.max_new_ingredients,
          goal_protein_per_day: Number(data.goal_protein_per_day) ?? defaults.goal_protein_per_day,
          goal_calories_per_day: Number(data.goal_calories_per_day) ?? defaults.goal_calories_per_day,
          currency: data.currency ?? defaults.currency,
          region: (data as { region?: string }).region ?? defaults.region,
        })
      }
      setLoading(false)
    }
    fetch()
  }, [user])

  const setSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return
      const next = { ...settings, ...patch }
      setSettingsState(next)
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        budget_weekly: next.budget_weekly,
        max_new_ingredients: next.max_new_ingredients,
        goal_protein_per_day: next.goal_protein_per_day,
        goal_calories_per_day: next.goal_calories_per_day,
        currency: next.currency,
        region: next.region,
      })
    },
    [user, settings]
  )

  return (
    <UserSettingsContext.Provider value={{ settings, loading, setSettings }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext)
  if (!ctx) return { settings: defaults, loading: false, setSettings: async () => {} }
  return ctx
}
