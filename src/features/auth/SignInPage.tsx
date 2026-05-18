import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { AuthFrame } from './AuthFrame'

type SignInPageProps = {
  onSignIn: (email: string, password: string) => Promise<void>
  onForgotPassword: () => void
}

export function SignInPage({ onSignIn, onForgotPassword }: SignInPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Заполните email и пароль')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await onSignIn(email.trim(), password)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось войти')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <form className="grid gap-4" onSubmit={submitForm}>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
          <p className="text-sm text-muted-foreground">Административная консоль Sportgearhub</p>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Почта</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Пароль</span>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Входим...' : 'Войти'}
        </Button>

        <Button type="button" variant="link" className="h-auto p-0" onClick={onForgotPassword}>
          Забыли пароль?
        </Button>
      </form>
    </AuthFrame>
  )
}
