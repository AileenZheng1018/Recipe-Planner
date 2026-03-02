import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { ToastProvider } from './contexts/ToastContext'
import { ShoppingListProvider } from './contexts/ShoppingListContext'
import { UserSettingsProvider } from './contexts/UserSettingsContext'
import { WeeklyScheduleProvider } from './contexts/WeeklyScheduleContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import DashboardPage from './pages/DashboardPage'
import InventoryPage from './pages/InventoryPage'
import PlanPage from './pages/PlanPage'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <ToastProvider>
          <UserSettingsProvider>
          <WeeklyScheduleProvider>
          <ShoppingListProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="plan" element={<PlanPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
</ShoppingListProvider>
          </WeeklyScheduleProvider>
          </UserSettingsProvider>
        </ToastProvider>
        </LangProvider>
    </AuthProvider>
  )
}
