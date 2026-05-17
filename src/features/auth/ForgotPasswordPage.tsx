import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
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
      <form className="grid gap-4" onSubmit={submitForm}>
        <h1 className="text-2xl font-semibold tracking-tight">Восстановление пароля</h1>

        <p className="text-sm text-muted-foreground">Если email есть в списке администраторов, мы отправим ссылку для смены пароля.</p>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Email</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus />
        </label>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        {isSubmitted ? <p className="text-sm font-medium text-primary">Проверьте почту и откройте ссылку из письма.</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
        </Button>

        <Button type="button" variant="link" className="h-auto p-0" onClick={onBackToSignIn}>
          Вернуться ко входу
        </Button>
      </form>
    </AuthFrame>
  )
}
