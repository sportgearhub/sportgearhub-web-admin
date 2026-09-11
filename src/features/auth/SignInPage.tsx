import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { AuthFrame } from './AuthFrame'
import { forgetLocalDevice, getPasscodePolicy, hasTrustedDevice } from './authApi'

type SignInPageProps = {
  onRequestCode: (email: string) => Promise<void>
  onSubmitCode: (email: string, code: string) => Promise<void>
  onSubmitPasscode: (passcode: string) => Promise<void>
  onEnrolDevice: (passcode: string) => Promise<void>
}

type Step = 'email' | 'code' | 'passcode' | 'enrol'

// There are no passwords. A new session starts with a one-time code mailed to the address; a browser the
// admin has already trusted unlocks with a short passcode instead.
export function SignInPage({ onRequestCode, onSubmitCode, onSubmitPasscode, onEnrolDevice }: SignInPageProps) {
  const [step, setStep] = useState<Step>(() => (hasTrustedDevice() ? 'passcode' : 'email'))
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [passcode, setPasscode] = useState('')
  const [passcodeLength, setPasscodeLength] = useState(4)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void getPasscodePolicy().then((policy) => setPasscodeLength(policy.length)).catch(() => undefined)
  }, [])

  async function run(action: () => Promise<void>, onFailure?: () => void) {
    setError('')
    setIsSubmitting(true)

    try {
      await action()
    } catch (failure) {
      onFailure?.()
      setError(failure instanceof Error ? failure.message : 'Не удалось войти')
    } finally {
      setIsSubmitting(false)
    }
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setError('Введите почту')
      return
    }

    void run(async () => {
      await onRequestCode(email.trim())
      setCode('')
      setStep('code')
    })
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      async () => {
        await onSubmitCode(email.trim(), code)
        setStep('enrol')
      },
      () => setCode(''),
    )
  }

  function submitPasscode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      () => onSubmitPasscode(passcode),
      () => {
        setPasscode('')
        if (!hasTrustedDevice()) setStep('email')
      },
    )
  }

  function submitEnrolment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => onEnrolDevice(passcode), () => setPasscode(''))
  }

  if (step === 'passcode') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitPasscode}>
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
            <p className="text-sm text-muted-foreground">Введите код доступа этого устройства</p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Код доступа</span>
            <Input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, passcodeLength))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </Button>

          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              forgetLocalDevice()
              setPasscode('')
              setStep('email')
            }}
          >
            Войти по коду из почты
          </Button>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'code') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitCode}>
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Код из письма</h1>
            <p className="text-sm text-muted-foreground">Отправили код на {email.trim()}. Код действует 10 минут.</p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Код</span>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting || code.length < 6}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </Button>

          <Button type="button" variant="link" className="h-auto p-0" onClick={() => setStep('email')}>
            Изменить почту
          </Button>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'enrol') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitEnrolment}>
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Быстрый вход</h1>
            <p className="text-sm text-muted-foreground">
              Задайте код доступа из {passcodeLength} цифр, чтобы входить без письма. Код работает только на этом устройстве.
            </p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Код доступа</span>
            <Input
              value={passcode}
              onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, passcodeLength))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>
            {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <form className="grid gap-4" onSubmit={submitEmail}>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Вход</h1>
          <p className="text-sm text-muted-foreground">Административная консоль Sportgearhub</p>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Почта</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" autoFocus />
        </label>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Отправляем...' : 'Получить код'}
        </Button>
      </form>
    </AuthFrame>
  )
}
