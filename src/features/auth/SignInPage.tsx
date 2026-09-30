import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { AuthFrame } from './AuthFrame'
import { forgetLocalDevice, getPasscodePolicy, hasTrustedDevice, requestEmailCode, type VerificationStarted } from './authApi'

type SignInPageProps = {
  onSubmitCode: (email: string, code: string) => Promise<void>
  onSubmitPasscode: (passcode: string) => Promise<void>
  onEnrolDevice: (passcode: string) => Promise<void>
}

type Step = 'email' | 'code' | 'passcode' | 'enrol'

// There are no passwords. A new session starts with an emailed one-time code; a browser the admin
// has already trusted unlocks with a short passcode instead.
export function SignInPage({ onSubmitCode, onSubmitPasscode, onEnrolDevice }: SignInPageProps) {
  const [step, setStep] = useState<Step>(() => (hasTrustedDevice() ? 'passcode' : 'email'))
  const [email, setEmail] = useState('')
  const [started, setStarted] = useState<VerificationStarted | null>(null)
  const [code, setCode] = useState('')
  const [passcode, setPasscode] = useState('')
  const [passcodeLength, setPasscodeLength] = useState(4)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const trimmedEmail = email.trim()

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

  function begin() {
    return run(async () => {
      const result = await requestEmailCode(trimmedEmail)
      setStarted(result)
      setCode('')
      setStep('code')
    })
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Введите корректный адрес почты')
      return
    }
    void begin()
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      async () => {
        await onSubmitCode(trimmedEmail, code)
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
          <Heading title="Вход" subtitle="Введите код доступа этого устройства" />
          <CodeField label="Код доступа" value={passcode} length={passcodeLength} onChange={setPasscode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>{isSubmitting ? 'Входим...' : 'Войти'}</Button>
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => { forgetLocalDevice(); setPasscode(''); setStep('email') }}>
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
          <Heading title="Код из письма" subtitle={`Отправили код на ${trimmedEmail}. Код действует 10 минут.`} />
          <CodeField label="Код" value={code} length={started?.codeLength ?? 6} onChange={setCode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || code.length < (started?.codeLength ?? 6)}>{isSubmitting ? 'Входим...' : 'Войти'}</Button>
          <div className="flex justify-between">
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => void begin()}>Отправить ещё раз</Button>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => setStep('email')}>Изменить почту</Button>
          </div>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'enrol') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitEnrolment}>
          <Heading title="Быстрый вход" subtitle={`Задайте код доступа из ${passcodeLength} цифр, чтобы входить без письма. Код работает только на этом устройстве.`} />
          <CodeField label="Код доступа" value={passcode} length={passcodeLength} onChange={setPasscode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>{isSubmitting ? 'Сохраняем...' : 'Сохранить'}</Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <form className="grid gap-4" onSubmit={submitEmail}>
        <Heading title="Вход" subtitle="Внутренняя консоль Sportgearhub" />
        <label className="grid gap-2">
          <span className="text-sm font-medium">Почта</span>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="admin@sportgearhub.ru"
            autoFocus
          />
        </label>
        <ErrorLine error={error} />
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Отправляем...' : 'Продолжить'}</Button>
      </form>
    </AuthFrame>
  )
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function CodeField({ label, value, length, onChange }: { label: string; value: string; length: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
      />
    </label>
  )
}

function ErrorLine({ error }: { error: string }) {
  return error ? <p className="text-sm font-medium text-destructive">{error}</p> : null
}
