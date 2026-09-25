import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { AuthFrame } from './AuthFrame'
import { forgetLocalDevice, getPasscodePolicy, hasTrustedDevice, requestPhoneCode, type VerificationStarted } from './authApi'
import { useVerificationStage } from './useVerificationStage'

type SignInPageProps = {
  onSubmitCode: (phone: string, code: string) => Promise<void>
  onConfirmedPush: (verificationId: string) => Promise<void>
  onSubmitPasscode: (passcode: string) => Promise<void>
  onEnrolDevice: (passcode: string) => Promise<void>
}

type Step = 'phone' | 'waiting' | 'code' | 'passcode' | 'enrol'

// There are no passwords. A new session starts with the phone: a silent SIM push where the
// operator supports it, otherwise a code by SMS. A browser the admin has already trusted unlocks
// with a short passcode instead.
export function SignInPage({ onSubmitCode, onConfirmedPush, onSubmitPasscode, onEnrolDevice }: SignInPageProps) {
  const [step, setStep] = useState<Step>(() => (hasTrustedDevice() ? 'passcode' : 'phone'))
  const [phone, setPhone] = useState('')
  const [started, setStarted] = useState<VerificationStarted | null>(null)
  const [code, setCode] = useState('')
  const [passcode, setPasscode] = useState('')
  const [passcodeLength, setPasscodeLength] = useState(4)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const digits = phone.replace(/\D/g, '')
  const e164 = `+7${digits}`

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
      const result = await requestPhoneCode(e164)
      setStarted(result)
      setCode('')
      setStep(result.stage === 'pending' ? 'waiting' : 'code')
    })
  }

  function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (digits.length !== 10) {
      setError('Введите номер из 10 цифр')
      return
    }
    void begin()
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(
      async () => {
        await onSubmitCode(e164, code)
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
        if (!hasTrustedDevice()) setStep('phone')
      },
    )
  }

  function submitEnrolment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(() => onEnrolDevice(passcode), () => setPasscode(''))
  }

  if (step === 'waiting' && started) {
    return (
      <PushWaitingStep
        phone={digits}
        started={started}
        onNeedsCode={() => setStep('code')}
        onConfirmed={async (verificationId) => {
          await run(async () => {
            await onConfirmedPush(verificationId)
            setStep('enrol')
          })
        }}
        onRestart={(notice) => {
          setStep('phone')
          setStarted(null)
          setError(notice)
        }}
        onBack={() => {
          setStep('phone')
          setStarted(null)
          setError('')
        }}
      />
    )
  }

  if (step === 'passcode') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitPasscode}>
          <Heading title="Вход" subtitle="Введите код доступа этого устройства" />
          <CodeField label="Код доступа" value={passcode} length={passcodeLength} onChange={setPasscode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>{isSubmitting ? 'Входим...' : 'Войти'}</Button>
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => { forgetLocalDevice(); setPasscode(''); setStep('phone') }}>
            Войти по коду из SMS
          </Button>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'code') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitCode}>
          <Heading title="Код из SMS" subtitle={`Отправили код на +7 ${digits}. Код действует 10 минут.`} />
          <CodeField label="Код" value={code} length={started?.codeLength ?? 6} onChange={setCode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || code.length < (started?.codeLength ?? 6)}>{isSubmitting ? 'Входим...' : 'Войти'}</Button>
          <div className="flex justify-between">
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => void begin()}>Отправить ещё раз</Button>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => setStep('phone')}>Изменить номер</Button>
          </div>
        </form>
      </AuthFrame>
    )
  }

  if (step === 'enrol') {
    return (
      <AuthFrame>
        <form className="grid gap-4" onSubmit={submitEnrolment}>
          <Heading title="Быстрый вход" subtitle={`Задайте код доступа из ${passcodeLength} цифр, чтобы входить без SMS. Код работает только на этом устройстве.`} />
          <CodeField label="Код доступа" value={passcode} length={passcodeLength} onChange={setPasscode} />
          <ErrorLine error={error} />
          <Button type="submit" disabled={isSubmitting || passcode.length < passcodeLength}>{isSubmitting ? 'Сохраняем...' : 'Сохранить'}</Button>
        </form>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <form className="grid gap-4" onSubmit={submitPhone}>
        <Heading title="Вход" subtitle="Внутренняя консоль Sportgearhub" />
        <label className="grid gap-2">
          <span className="text-sm font-medium">Телефон</span>
          <div className="flex">
            <span className="flex h-8 items-center gap-1.5 rounded-l-sm border border-r-0 border-input bg-muted px-2 text-sm">
              <span className="text-xs font-medium text-muted-foreground">RU</span>
              +7
            </span>
            <Input
              className="rounded-l-none"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="9271234567"
              autoFocus
            />
          </div>
        </label>
        <ErrorLine error={error} />
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Отправляем...' : 'Продолжить'}</Button>
      </form>
    </AuthFrame>
  )
}

/**
 * The wait while a SIM push is with the user. Three things can happen and each is someone else's
 * decision — approved (sign in, no code typed), fallen back to SMS (show the keypad), or over.
 */
function PushWaitingStep({
  phone,
  started,
  onNeedsCode,
  onConfirmed,
  onRestart,
  onBack,
}: {
  phone: string
  started: VerificationStarted
  onNeedsCode: () => void
  onConfirmed: (verificationId: string) => Promise<void>
  onRestart: (notice: string) => void
  onBack: () => void
}) {
  const stage = useVerificationStage(started.verificationId, started.stage)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current || stage === 'pending') return
    handled.current = true
    if (stage === 'code_required') {
      onNeedsCode()
      return
    }
    if (stage !== 'confirmed') {
      onRestart(stage === 'expired' ? 'Время подтверждения истекло. Попробуйте ещё раз.' : 'Подтвердить вход не удалось. Попробуйте ещё раз.')
      return
    }
    void onConfirmed(started.verificationId)
  }, [stage, started.verificationId, onNeedsCode, onConfirmed, onRestart])

  return (
    <AuthFrame>
      <div className="grid gap-4">
        <Heading title="Подтвердите вход" subtitle={`Отправили запрос на +7 ${phone}.`} />
        <div className="grid justify-items-center gap-3 py-2">
          <div className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-center text-sm text-muted-foreground">Подтвердите вход на телефоне. Если подтверждение не придёт, пришлём код в SMS.</p>
        </div>
        <Button type="button" variant="link" className="h-auto p-0" onClick={onBack}>Изменить номер</Button>
      </div>
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
