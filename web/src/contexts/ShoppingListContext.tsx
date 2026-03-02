import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ShoppingListItem = {
  ingredient_id: string
  nameEn: string
  nameZh: string
  store?: string
  /** 计划需补足量（克） */
  plannedQty: number
  /** 实际购入量（克），可改；无规格时可留空由用户填写 */
  actualQty: number
  /** 实际支付价格（数字），用户填写后写入库存记录 */
  price: number
  /** 是否已购入并加入库存（已购的会从清单移除） */
  purchased?: boolean
  /** 有 purchase_options 时的建议购买量（克） */
  suggested_grams?: number
  /** 有 purchase_options 时的建议价格（展示用） */
  suggested_price?: number
}

type ShoppingListContextType = {
  items: ShoppingListItem[]
  setItems: (items: ShoppingListItem[] | ((prev: ShoppingListItem[]) => ShoppingListItem[])) => void
  updateItem: (ingredient_id: string, patch: Partial<Pick<ShoppingListItem, 'actualQty' | 'price'>>) => void
  removePurchased: (ingredient_id: string) => void
}

const defaultList: ShoppingListItem[] = [
  { ingredient_id: 'salmon_atlantic', nameEn: 'Atlantic Salmon', nameZh: '大西洋三文鱼', plannedQty: 300, actualQty: 300, price: 0 },
  { ingredient_id: 'bok_choy', nameEn: 'Bok Choy', nameZh: '青菜/小白菜', plannedQty: 300, actualQty: 300, price: 0 },
  { ingredient_id: 'tofu_firm', nameEn: 'Firm Tofu', nameZh: '老豆腐', plannedQty: 400, actualQty: 400, price: 0 },
  { ingredient_id: 'white_rice', nameEn: 'White Rice', nameZh: '大米', plannedQty: 100, actualQty: 100, price: 0 },
]

const ShoppingListContext = createContext<ShoppingListContextType | null>(null)

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ShoppingListItem[]>(defaultList)

  const updateItem = useCallback((ingredient_id: string, patch: Partial<Pick<ShoppingListItem, 'actualQty' | 'price'>>) => {
    setItems((prev) => prev.map((it) => (it.ingredient_id === ingredient_id ? { ...it, ...patch } : it)))
  }, [])

  const removePurchased = useCallback((ingredient_id: string) => {
    setItems((prev) => prev.filter((it) => it.ingredient_id !== ingredient_id))
  }, [])

  return (
    <ShoppingListContext.Provider value={{ items, setItems, updateItem, removePurchased }}>
      {children}
    </ShoppingListContext.Provider>
  )
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext)
  if (!ctx) throw new Error('useShoppingList must be used within ShoppingListProvider')
  return ctx
}
