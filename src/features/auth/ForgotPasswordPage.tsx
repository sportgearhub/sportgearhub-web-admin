import { useState } from 'react'
import { AuthFrame } from './AuthFrame'
import { requestPasswordReset } from './authApi'

type ForgotPasswordPageProps = {
  onBackToSignIn: () => void
}

export function ForgotPasswordPage({ onBackToSignIn }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Укажите email')
      return
    }

    setError('')
    setIsSubmitting(true)

    await requestPasswordReset(normalizedEmail).catch(() => undefined)
    setIsSubmitted(true)
    setIsSubmitting(false)
  }

  return (
    <AuthFrame>
      <form className="sign-in-form" onSubmit={submitForm}>
        <h1>Восстановление пароля</h1>

        <p className="form-note">Если email есть в списке администраторов, мы отправим ссылку для смены пароля.</p>

        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus />
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        {isSubmitted ? <p className="form-success">Проверьте почту и откройте ссылку из письма.</p> : null}

        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
        </button>

        <button type="button" className="text-action" onClick={onBackToSignIn}>
          Вернуться ко входу
        </button>
      </form>
    </AuthFrame>
  )
}
