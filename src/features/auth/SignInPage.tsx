import { useState } from 'react'
import { AuthFrame } from './AuthFrame'

type SignInPageProps = {
  onSignIn: (email: string) => void
  onDevSignIn: () => void
  onForgotPassword: () => void
}

export function SignInPage({ onSignIn, onDevSignIn, onForgotPassword }: SignInPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Заполните email и пароль')
      return
    }

    setError('')
    onSignIn(email.trim())
  }

  return (
    <AuthFrame>
      <form className="sign-in-form" onSubmit={submitForm}>
        <h1>Вход</h1>

        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus />
        </label>

        <label>
          <span>Пароль</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="primary-action">
          Войти
        </button>

        <button type="button" className="text-action" onClick={onForgotPassword}>
          Забыли пароль?
        </button>

        <button type="button" className="dev-sign-in-button" onClick={onDevSignIn}>
          Войти как администратор
        </button>
      </form>
    </AuthFrame>
  )
}
