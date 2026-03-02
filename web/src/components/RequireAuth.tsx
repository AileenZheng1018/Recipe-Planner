import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="flex items-center justify-center min-h-screen text-stone-500">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}
