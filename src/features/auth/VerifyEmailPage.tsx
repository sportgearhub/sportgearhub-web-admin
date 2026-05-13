import { useState } from 'react'
import { AuthFrame } from './AuthFrame'
import { requestEmailVerification } from './authApi'

type VerifyEmailPageProps = {
  hasToken: boolean
  onBackToSignIn: () => void
}

export function VerifyEmailPage({ hasToken, onBackToSignIn }: VerifyEmailPageProps) {
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

    try {
      await requestEmailVerification(normalizedEmail)
      setIsSubmitted(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось отправить письмо')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <form className="sign-in-form" onSubmit={submitForm}>
        <h1>Подтверждение email</h1>

        {hasToken ? (
          <p className="form-success">Ссылка подтверждения открыта. Вернитесь ко входу и войдите в консоль.</p>
        ) : (
          <p className="form-note">Введите email администратора, чтобы получить новую ссылку подтверждения.</p>
        )}

        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus={!hasToken} />
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
