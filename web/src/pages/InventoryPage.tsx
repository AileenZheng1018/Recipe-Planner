import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { INGREDIENT_IDS } from '../data/ingredientIds'
import { getIngredientName, matchIngredientInput } from '../data/ingredientNames'
import type { InventoryItem } from '../types/database'

const CATEGORY_MAP: Record<string, { en: string; zh: string; color: string }> = {
  meat_poultry: { en: 'Poultry', zh: '禽肉', color: 'bg-orange-100 text-orange-800' },
  meat_red: { en: 'Meat', zh: '红肉', color: 'bg-orange-100 text-orange-800' },
  fish: { en: 'Seafood', zh: '海鲜', color: 'bg-blue-100 text-blue-800' },
  vegetable: { en: 'Vegetable', zh: '蔬菜', color: 'bg-green-100 text-green-800' },
  fruit: { en: 'Fruit', zh: '水果', color: 'bg-pink-100 text-pink-800' },
  grain: { en: 'Grain', zh: '谷物', color: 'bg-amber-100 text-amber-800' },
  pantry: { en: 'Pantry', zh: '调料', color: 'bg-stone-100 text-stone-800' },
  plant_protein: { en: 'Plant', zh: '植物蛋白', color: 'bg-lime-100 text-lime-800' },
  frozen_ready: { en: 'Frozen', zh: '速冻', color: 'bg-cyan-100 text-cyan-800' },
  processed: { en: 'Processed', zh: '加工', color: 'bg-violet-100 text-violet-800' },
}

function getCategoryKey(ingredient_id: string): string {
  const id = ingredient_id.toLowerCase()
  if (id.startsWith('chicken') || id.startsWith('duck')) return 'meat_poultry'
  if (id.startsWith('beef') || id.startsWith('pork') || id.startsWith('lamb')) return 'meat_red'
  if (id.startsWith('salmon') || id.startsWith('cod') || id.startsWith('shrimp') || id.startsWith('squid') || id.startsWith('tuna')) return 'fish'
  if (id.startsWith('broccoli') || id.startsWith('spinach') || id.startsWith('carrot') || id.startsWith('potato') || id.startsWith('tomato') || id.startsWith('onion') || id.startsWith('garlic') || id.startsWith('bell_pepper') || id.startsWith('napa') || id.startsWith('bok_choy') || id.startsWith('shiitake') || id.startsWith('green_bean') || id.startsWith('eggplant') || id.startsWith('cucumber') || id.startsWith('ginger') || id.startsWith('romaine')) return 'vegetable'
  if (id.startsWith('apple') || id.startsWith('banana') || id.startsWith('grape') || id.startsWith('orange') || id.startsWith('lemon') || id.startsWith('lime') || id.startsWith('avocado') || id.startsWith('strawberry') || id.startsWith('mango') || id.startsWith('pear')) return 'fruit'
  if (id.startsWith('white_rice') || id.startsWith('pasta')) return 'grain'
  if (id.includes('sauce') || id.includes('oil') || id.includes('vinegar') || id.includes('paste') || id.includes('powder') || id.includes('milk') || id.startsWith('black_beans') || id.startsWith('curry') || id.startsWith('soy_sauce')) return 'pantry'
  if (id.startsWith('tofu')) return 'plant_protein'
  if (id.startsWith('jiaozi') || id.startsWith('wonton')) return 'frozen_ready'
  if (id.startsWith('instant_noodles')) return 'processed'
  return 'vegetable'
}

function getCategory(key: string) {
  return CATEGORY_MAP[key] ?? { en: 'Other', zh: '其他', color: 'bg-stone-100 text-stone-600' }
}

function getUrgency(priority: string): { labelEn: string; labelZh: string; color: string } {
  if (priority === 'high') return { labelEn: 'Use soon', labelZh: '优先用', color: 'text-amber-600' }
  return { labelEn: 'Normal', labelZh: '正常', color: 'text-stone-400' }
}

function getStats(rows: InventoryItem[]) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const weekStart = startOfWeek.toISOString().slice(0, 10)
  const monthStart = now.toISOString().slice(0, 7) + '-01'
  const yearStart = now.getFullYear() + '-01-01'
  let daySum = 0
  let weekSum = 0
  let monthSum = 0
  let yearSum = 0
  rows.forEach((r) => {
    const p = r.price_paid
    const d = r.purchased_at
    if (p == null || !d) return
    if (d === today) daySum += p
    if (d >= weekStart) weekSum += p
    if (d >= monthStart) monthSum += p
    if (d >= yearStart) yearSum += p
  })
  return { daySum, weekSum, monthSum, yearSum }
}

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const toast = useToast()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [modal, setModal] = useState(false)
  const [manualIngredient, setManualIngredient] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [manualQuantity, setManualQuantity] = useState(300)
  const [manualPrice, setManualPrice] = useState<number | ''>('')
  const [manualPriority, setManualPriority] = useState<'normal' | 'high'>('normal')
  const [showFullList, setShowFullList] = useState(false)

  const fetchItems = async () => {
    if (!user) return
    const { data, error } = await supabase.from('inventory_items').select('*').order('updated_at', { ascending: false })
    if (!error) setItems((data ?? []) as InventoryItem[])
  }

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    fetchItems().then(() => setLoading(false))
  }, [user, navigate])

  let filtered = items.filter((it) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    if (it.ingredient_id.toLowerCase().includes(q)) return true
    const en = getIngredientName(it.ingredient_id, 'en').toLowerCase()
    const zh = getIngredientName(it.ingredient_id, 'zh')
    return en.includes(q) || zh.includes(search.trim())
  })
  if (filterCategory !== 'all') filtered = filtered.filter((it) => getCategoryKey(it.ingredient_id) === filterCategory)
  if (filterPriority !== 'all') filtered = filtered.filter((it) => it.priority === filterPriority)

  const categoryKeys = ['all', ...Array.from(new Set(items.map((it) => getCategoryKey(it.ingredient_id))))]
  const stats = getStats(items)

  const matchedId = manualInput.trim() ? matchIngredientInput(manualInput.trim(), INGREDIENT_IDS) : null
  const filteredForSelect = manualInput.trim()
    ? INGREDIENT_IDS.filter((id) => {
        const name = getIngredientName(id, lang)
        const en = getIngredientName(id, 'en')
        const zh = getIngredientName(id, 'zh')
        const q = manualInput.trim().toLowerCase()
        return name.toLowerCase().includes(q) || en.toLowerCase().includes(q) || zh.includes(manualInput.trim())
      })
    : [...INGREDIENT_IDS]

  const handleManualSubmit = async () => {
    const toUse = manualIngredient || matchedId
    if (!user || !toUse?.trim()) {
      toast.show(lang === 'zh' ? '请输入或选择食材（如 五花肉、猪五花）' : 'Type or select ingredient (e.g. pork belly)', 'error')
      return
    }
    const qty = Math.max(0, manualQuantity) || 300
    const price = typeof manualPrice === 'number' ? manualPrice : null
    const payload: Record<string, unknown> = {
      user_id: user.id,
      ingredient_id: toUse.trim(),
      quantity_g: qty,
      priority: manualPriority,
      purchased_at: new Date().toISOString().slice(0, 10),
    }
    if (price != null && price > 0) payload.price_paid = price

    const { error } = await supabase.from('inventory_items').insert(payload)
    if (error) {
      const { error: err2 } = await supabase.from('inventory_items').update({ quantity_g: qty, priority: manualPriority, price_paid: price, purchased_at: payload.purchased_at }).eq('user_id', user.id).eq('ingredient_id', toUse.trim())
      if (err2) toast.show(lang === 'zh' ? '添加失败' : 'Failed', 'error')
      else toast.show(lang === 'zh' ? '已更新' : 'Updated', 'success')
    } else toast.show(lang === 'zh' ? '已添加' : 'Added', 'success')
    setModal(false)
    setManualIngredient('')
    setManualInput('')
    setManualQuantity(300)
    setManualPrice('')
    setManualPriority('normal')
    setShowFullList(false)
    fetchItems()
  }

  if (authLoading) return <div className="flex items-center justify-center py-20 text-stone-500">Loading…</div>

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-light text-stone-900 tracking-tight">{lang === 'zh' ? '我的库存' : 'My inventory'}</h2>
          <p className="text-sm text-stone-500 mt-2">{lang === 'zh' ? '查看和管理食材；在计划页用「已购入」从购物清单加入。' : 'View and manage. Use "Mark purchased" on Plan page to add from list.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => toast.show(lang === 'zh' ? '导出开发中' : 'Export coming soon')} className="flex items-center justify-center size-11 rounded-full bg-white border border-stone-200 text-stone-600 hover:bg-stone-900 hover:text-white transition-all shadow-sm">
            <span className="material-symbols-outlined text-xl">ios_share</span>
          </button>
          <button type="button" onClick={() => setModal(true)} className="bg-[#2D2D2D] text-white px-8 py-3.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-[#C66B49] transition-all shadow-xl active:scale-95">
            <span className="material-symbols-outlined text-lg">add</span>
            {lang === 'zh' ? '手动添加' : 'Add manually'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{lang === 'zh' ? '今日' : 'Today'}</p>
          <p className="text-xl font-semibold text-[#2D2D2D]">£{stats.daySum.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{lang === 'zh' ? '本周' : 'This week'}</p>
          <p className="text-xl font-semibold text-[#2D2D2D]">£{stats.weekSum.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{lang === 'zh' ? '本月' : 'This month'}</p>
          <p className="text-xl font-semibold text-[#2D2D2D]">£{stats.monthSum.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-4 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest text-stone-400">{lang === 'zh' ? '本年' : 'This year'}</p>
          <p className="text-xl font-semibold text-[#2D2D2D]">£{stats.yearSum.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-stone-400">search</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-stone-200 rounded-full py-3.5 pl-14 pr-6 focus:ring-2 focus:ring-[#8BA888] focus:border-[#8BA888] text-sm transition-all shadow-sm" placeholder={lang === 'zh' ? '搜索食材' : 'Search'} />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-6 py-3.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-600 focus:ring-2 focus:ring-[#8BA888] shadow-sm">
          <option value="all">{lang === 'zh' ? '全部类别' : 'All categories'}</option>
          {categoryKeys.filter((k) => k !== 'all').map((k) => (
            <option key={k} value={k}>{lang === 'zh' ? getCategory(k).zh : getCategory(k).en}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-6 py-3.5 bg-white border border-stone-200 rounded-full text-xs font-bold text-stone-600 focus:ring-2 focus:ring-[#8BA888] shadow-sm">
          <option value="all">{lang === 'zh' ? '全部状态' : 'All status'}</option>
          <option value="normal">{lang === 'zh' ? '正常' : 'Normal'}</option>
          <option value="high">{lang === 'zh' ? '优先用' : 'Use soon'}</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50/50">
              <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{lang === 'zh' ? '食材' : 'Ingredient'}</th>
              <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{lang === 'zh' ? '类别' : 'Category'}</th>
              <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{lang === 'zh' ? '数量' : 'Qty'}</th>
              <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{lang === 'zh' ? '价格' : 'Price'}</th>
              <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">{lang === 'zh' ? '状态' : 'Status'}</th>
              <th className="px-10 py-7 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {loading ? (
              <tr><td colSpan={6} className="px-10 py-12 text-center text-stone-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-10 py-12 text-center text-stone-400">{lang === 'zh' ? '没有匹配项' : 'No match'}</td></tr>
            ) : (
              filtered.map((it) => {
                const cat = getCategory(getCategoryKey(it.ingredient_id))
                const urg = getUrgency(it.priority)
                const pricePaid = it.price_paid
                return (
                  <tr key={it.id} className="group hover:bg-[#F9F7F2]/40 transition-colors">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-white border border-orange-50 flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-2xl text-[#8BA888]">eco</span>
                        </div>
                        <span className="text-sm font-bold text-stone-800">{getIngredientName(it.ingredient_id, lang)}</span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`rounded-full text-[10px] font-bold px-4 py-1.5 uppercase tracking-wide ${cat.color}`}>{lang === 'zh' ? cat.zh : cat.en}</span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-stone-700">{it.quantity_g}g</span>
                        <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#8BA888]" style={{ width: `${Math.min(100, (it.quantity_g / 1000) * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-sm text-stone-600">{pricePaid != null ? `£${Number(pricePaid).toFixed(2)}` : '–'}</td>
                    <td className="px-10 py-6">
                      <span className={`flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider ${urg.color}`}>
                        <span className="material-symbols-outlined text-lg">{it.priority === 'high' ? 'priority_high' : 'check_circle'}</span>
                        {lang === 'zh' ? urg.labelZh : urg.labelEn}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button type="button" className="material-symbols-outlined text-stone-300 hover:text-stone-900 transition-colors" aria-label="More">more_vert</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="px-10 py-6 bg-stone-50/30 border-t border-stone-50">
          <span className="text-[11px] font-bold text-stone-400 tracking-widest uppercase">{filtered.length} {lang === 'zh' ? '项' : 'items'}</span>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#2D2D2D] mb-6">{lang === 'zh' ? '手动添加食材' : 'Add ingredient'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '输入食材名（如 五花肉、猪五花）' : 'Type ingredient (e.g. pork belly)'}</label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => { setManualInput(e.target.value); if (!e.target.value) setManualIngredient('') }}
                  onBlur={() => { if (matchedId && !manualIngredient) setManualIngredient(matchedId) }}
                  className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm"
                  placeholder={lang === 'zh' ? '猪五花、鸡胸、豆腐…' : 'Pork belly, chicken…'}
                />
                {manualInput.trim() && !matchedId && filteredForSelect.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    {lang === 'zh' ? '未找到。可试同义名（如 猪五花=五花肉）或从下方列表选择；扩充食材请运行：scripts/crawl_recipes.py --ingredients' : 'No match. Try synonyms or pick from list; run scripts/crawl_recipes.py --ingredients to add more.'}
                  </p>
                )}
                {matchedId && (
                  <p className="text-[11px] text-[#8BA888] mt-1">
                    {lang === 'zh' ? '匹配：' : 'Match: '}{getIngredientName(matchedId, lang)}
                  </p>
                )}
                <button type="button" onClick={() => setShowFullList((v) => !v)} className="mt-2 text-[11px] text-stone-500 hover:text-[#8BA888]">
                  {lang === 'zh' ? (showFullList ? '收起列表' : '从列表选择') : (showFullList ? 'Hide list' : 'Pick from list')}
                </button>
                {showFullList && (
                  <select
                    value={manualIngredient || matchedId || ''}
                    onChange={(e) => { setManualIngredient(e.target.value); if (e.target.value) setManualInput(getIngredientName(e.target.value, lang)) }}
                    className="w-full mt-2 border border-stone-200 rounded-lg py-2 px-3 text-sm"
                  >
                    <option value="">{lang === 'zh' ? '请选择' : 'Select'}</option>
                    {(manualInput.trim() ? filteredForSelect : INGREDIENT_IDS).map((id) => (
                      <option key={id} value={id}>{getIngredientName(id, lang)}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '数量 (克)' : 'Quantity (g)'}</label>
                <input type="number" min={1} value={manualQuantity} onChange={(e) => setManualQuantity(Number(e.target.value) || 0)} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '价格 (£)' : 'Price (£)'}</label>
                <input type="number" min={0} step={0.01} value={manualPrice} onChange={(e) => setManualPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm" placeholder={lang === 'zh' ? '选填' : 'Optional'} />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">{lang === 'zh' ? '状态' : 'Priority'}</label>
                <select value={manualPriority} onChange={(e) => setManualPriority(e.target.value as 'normal' | 'high')} className="w-full border border-stone-200 rounded-lg py-2.5 px-3 text-sm">
                  <option value="normal">{lang === 'zh' ? '正常' : 'Normal'}</option>
                  <option value="high">{lang === 'zh' ? '优先用' : 'Use soon'}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50">{lang === 'zh' ? '取消' : 'Cancel'}</button>
              <button type="button" onClick={handleManualSubmit} className="flex-1 py-2.5 bg-[#2D2D2D] text-white rounded-lg text-sm font-bold hover:bg-[#C66B49]">{lang === 'zh' ? '添加' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
