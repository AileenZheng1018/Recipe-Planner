import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'

export default function Login() {
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: isSignUp ? (lang === 'zh' ? '请查收确认邮件' : 'Please check your email') : (lang === 'zh' ? '登录成功' : 'Signed in') })
    if (!isSignUp) navigate('/dashboard', { replace: true })
  }

  return (
    <div className="login-page">
      <h1>Recipe Planner</h1>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          placeholder={lang === 'zh' ? '邮箱' : 'Email'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={lang === 'zh' ? '密码' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{isSignUp ? (lang === 'zh' ? '注册' : 'Sign up') : (lang === 'zh' ? '登录' : 'Sign in')}</button>
        <button
          type="button"
          className="link"
          onClick={() => setIsSignUp((v) => !v)}
        >
          {isSignUp ? (lang === 'zh' ? '已有账号？登录' : 'Have an account? Sign in') : (lang === 'zh' ? '没有账号？注册' : "Don't have an account? Sign up")}
        </button>
      </form>
      {message && (
        <p className={message.type === 'err' ? 'error' : 'success'}>{message.text}</p>
      )}
    </div>
  )
}
