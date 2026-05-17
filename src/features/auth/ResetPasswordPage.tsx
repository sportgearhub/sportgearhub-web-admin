import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
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
      <form className="grid gap-4" onSubmit={submitForm}>
        <h1 className="text-2xl font-semibold tracking-tight">Новый пароль</h1>

        <p className="text-sm text-muted-foreground">Задайте новый пароль для доступа к административной консоли.</p>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Новый пароль</span>
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            autoFocus
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Повторите пароль</span>
          <Input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
          />
        </label>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        {isComplete ? <p className="text-sm font-medium text-primary">Пароль обновлен. Теперь можно войти.</p> : null}

        <Button type="submit" disabled={isSubmitting || isComplete}>
          {isSubmitting ? 'Сохраняем...' : 'Сохранить пароль'}
        </Button>

        <Button type="button" variant="link" className="h-auto p-0" onClick={onBackToSignIn}>
          Вернуться ко входу
        </Button>
      </form>
    </AuthFrame>
  )
}
