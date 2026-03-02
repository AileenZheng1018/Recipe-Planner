import { useState, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import { useUserSettings } from '../contexts/UserSettingsContext'
import type { UserSettings } from '../contexts/UserSettingsContext'

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLang()
  const { settings, setSettings } = useUserSettings()
  const [form, setForm] = useState<UserSettings>({ ...settings, region: settings.region ?? 'UK' })

  useEffect(() => {
    setForm({ ...settings, region: settings.region ?? 'UK' })
  }, [settings])

  const handleSave = async () => {
    await setSettings(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#2D2D2D] mb-6">{lang === 'zh' ? '限制与目标' : 'Limits & goals'}</h3>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto thin-scrollbar pr-1">
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '地区' : 'Region'}</label>
            <select value={form.region ?? 'UK'} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm">
              <option value="UK">{lang === 'zh' ? '英国' : 'UK'}</option>
              <option value="CN">{lang === 'zh' ? '中国' : 'China'}</option>
            </select>
            <p className="text-[11px] text-stone-400 mt-1">{lang === 'zh' ? '用于推荐与购物清单中优先本地区易购食材' : 'Used to prefer locally available ingredients in plan & shopping list'}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '每周预算' : 'Weekly budget'}</label>
            <input type="number" min={0} step={1} value={form.budget_weekly} onChange={(e) => setForm((f) => ({ ...f, budget_weekly: Number(e.target.value) || 0 }))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '每周最多新食材种类' : 'Max new ingredients per week'}</label>
            <input type="number" min={1} max={20} value={form.max_new_ingredients} onChange={(e) => setForm((f) => ({ ...f, max_new_ingredients: Number(e.target.value) || 1 }))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '每日蛋白质目标 (g)' : 'Daily protein goal (g)'}</label>
            <input type="number" min={0} value={form.goal_protein_per_day} onChange={(e) => setForm((f) => ({ ...f, goal_protein_per_day: Number(e.target.value) || 0 }))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '每日热量目标 (kcal)' : 'Daily calories goal (kcal)'}</label>
            <input type="number" min={0} value={form.goal_calories_per_day} onChange={(e) => setForm((f) => ({ ...f, goal_calories_per_day: Number(e.target.value) || 0 }))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50">{lang === 'zh' ? '取消' : 'Cancel'}</button>
          <button type="button" onClick={handleSave} className="flex-1 py-2.5 bg-[#2D2D2D] text-white rounded-lg text-sm font-bold hover:bg-[#C66B49]">{lang === 'zh' ? '保存' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
