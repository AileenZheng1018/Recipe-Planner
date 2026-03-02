import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type Toast = { id: number; message: string; type: 'info' | 'success' | 'error' }

type ToastContextType = { show: (message: string, type?: Toast['type']) => void }

const ToastContext = createContext<ToastContextType | null>(null)

let id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const t: Toast = { id: ++id, message, type }
    setToasts((prev) => [...prev, t])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
              t.type === 'error' ? 'bg-red-100 text-red-800' : t.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-[#2D2D2D] text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { show: () => {} }
  return ctx
}
