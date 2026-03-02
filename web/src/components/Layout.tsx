import { useState } from 'react'
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useToast } from '../contexts/ToastContext'
import SettingsModal from './SettingsModal'

const navItems = [
  { to: '/dashboard', icon: 'grid_view', labelEn: 'Home', labelZh: '首页' },
  { to: '/inventory', icon: 'kitchen', labelEn: 'Inventory', labelZh: '库存' },
  { to: '/plan', icon: 'shopping_basket', labelEn: 'Plan & Shop', labelZh: '计划与购物' },
] as const

const ROUTE_TITLES: Record<string, { en: string; zh: string }> = {
  '/dashboard': { en: 'Home', zh: '首页' },
  '/inventory': { en: 'Inventory', zh: '库存' },
  '/plan': { en: 'Plan & Shop', zh: '计划与购物' },
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, setLang } = useLang()
  const toast = useToast()
  const [showSettings, setShowSettings] = useState(false)
  const title = ROUTE_TITLES[location.pathname] ?? ROUTE_TITLES['/dashboard']

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-20 lg:w-24 flex-shrink-0 bg-white flex flex-col items-center py-8 gap-10 border-r border-[#F0EDE9]/50">
        <div className="text-[#C66B49] mb-4">
          <span className="material-symbols-outlined text-3xl">restaurant_menu</span>
        </div>
        <nav className="flex flex-col gap-6 w-full px-4">
          {navItems.map(({ to, icon, labelEn, labelZh }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative flex justify-center p-3 rounded-xl transition-colors ${
                  isActive ? 'text-[#C66B49] bg-[#F9F7F2]' : 'text-stone-300 hover:text-[#8BA888]'
                }`
              }
            >
              <span className="material-symbols-outlined text-2xl">{icon}</span>
              <span className="absolute left-full ml-4 px-2 py-1 bg-[#2D2D2D] text-white text-[10px] rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap uppercase tracking-widest z-50">
                {lang === 'zh' ? labelZh : labelEn}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-6 w-full px-4 border-t border-[#F0EDE9]/30 pt-8">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="group relative flex justify-center p-3 w-full text-stone-300 hover:text-[#C66B49] transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">settings</span>
            <span className="absolute left-full ml-4 px-2 py-1 bg-[#2D2D2D] text-white text-[10px] rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap uppercase tracking-widest z-50">
              {lang === 'zh' ? '设置' : 'Settings'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="group relative flex justify-center pb-2 w-full"
            title={user?.email ?? ''}
          >
            <div className="w-10 h-10 rounded-full bg-[#F9F7F2] border border-[#F0EDE9] flex items-center justify-center text-[#C66B49] cursor-pointer hover:border-[#C66B49] transition-colors">
              <span className="material-symbols-outlined text-xl">person</span>
            </div>
            <span className="absolute left-full ml-4 px-2 py-1 bg-[#2D2D2D] text-white text-[10px] rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              {lang === 'zh' ? '退出登录' : 'Sign out'}
            </span>
          </button>
        </div>
      </aside>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 flex items-center justify-between px-12 bg-[#F0EDE9]/30 border-b border-[#F0EDE9]/20">
          <h1 className="text-lg font-light tracking-tight text-[#2D2D2D]">
            Nutrition Agent <span className="text-stone-300 mx-2">/</span>{' '}
            <span className="text-stone-400">{lang === 'zh' ? title.zh : title.en}</span>
          </h1>
          <div className="flex items-center gap-10">
            <div className="flex items-center p-1 bg-white rounded-full border border-[#F0EDE9]/80 shadow-sm">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${lang === 'en' ? 'bg-[#C66B49] text-white' : 'text-stone-400 hover:text-[#2D2D2D]'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('zh')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-medium tracking-widest transition-all ${lang === 'zh' ? 'bg-[#C66B49] text-white' : 'text-stone-400 hover:text-[#2D2D2D]'}`}
              >
                中
              </button>
            </div>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => toast.show(lang === 'zh' ? '搜索开发中' : 'Search coming soon')}
                className="group relative p-2 text-stone-400 hover:text-[#C66B49] transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">search</span>
              </button>
              <button
                type="button"
                onClick={() => toast.show(lang === 'zh' ? '暂无新通知' : 'No new notifications')}
                className="group relative p-2 text-stone-400 hover:text-[#C66B49] transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">notifications_active</span>
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#C66B49] rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto thin-scrollbar px-12 pb-12 pt-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
