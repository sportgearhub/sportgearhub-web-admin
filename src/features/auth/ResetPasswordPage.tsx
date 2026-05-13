import { useState } from 'react'
import { AuthFrame } from './AuthFrame'
import { resetPassword } from './authApi'

type ResetPasswordPageProps = {
  token: string
  onBackToSignIn: () => void
}

export function ResetPasswordPage({ token, onBackToSignIn }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      setError('Ссылка недействительна или в ней нет токена')
      return
    }

    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await resetPassword(token, password)
      setIsComplete(true)
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сменить пароль')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <form className="sign-in-form" onSubmit={submitForm}>
        <h1>Новый пароль</h1>

        <p className="form-note">Задайте новый пароль для доступа к административной консоли.</p>

        <label>
          <span>Новый пароль</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            autoFocus
          />
        </label>

        <label>
          <span>Повторите пароль</span>
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        {isComplete ? <p className="form-success">Пароль обновлен. Теперь можно войти.</p> : null}

        <button type="submit" className="primary-action" disabled={isSubmitting || isComplete}>
          {isSubmitting ? 'Сохраняем...' : 'Сохранить пароль'}
        </button>

        <button type="button" className="text-action" onClick={onBackToSignIn}>
          Вернуться ко входу
        </button>
      </form>
    </AuthFrame>
  )
}
