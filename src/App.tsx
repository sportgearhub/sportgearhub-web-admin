import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { ConsentModal } from './components/ConsentModal'
import { MetricsGrid } from './components/MetricsGrid'
import { OperationalQueues } from './components/OperationalQueues'
import { navItems, sectionActions } from './data/adminConfig'
import { DomainPanel } from './features/admin/DomainPanel'
import { EquipmentTaxonomyReview } from './features/admin/EquipmentTaxonomyReview'
import { OnboardingReview } from './features/admin/OnboardingReview'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignInPage } from './features/auth/SignInPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { restoreCurrentSession, signInWithPassword, signOutCurrentUser } from './features/auth/authApi'
import { clearStoredAuthTokens } from './features/auth/authTokenStore'
import { ConsoleShell } from './layout/ConsoleShell'
import type { AdminSectionId, AdminSession, ConsoleAction, OnboardingViewMode, QueueItem } from './types/admin'

const CONSOLE_PATH = '/console'
const FORGOT_PASSWORD_PATH = '/auth/forgot-password'
const RESET_PASSWORD_PATH = '/auth/reset-password'
const SIGN_IN_PATH = '/sign-in'
const VERIFY_EMAIL_PATH = '/auth/verify-email'
const LOCATION_CHANGE_EVENT = 'sportgearhub-location-change'
const SIGN_IN_PATHS = new Set([SIGN_IN_PATH, '/login', '/auth/sign-in', '/auth/login'])
const SIGN_OUT_BUTTON_LABELS = new Set(['Вернуться ко входу', 'Back to sign in'])
const operationalQueues: QueueItem[] = []

function getCurrentPath() {
  return window.location.pathname
}

function getCurrentSearch() {
  return window.location.search
}

function pushPath(path: string) {
  if (`${window.location.pathname}${window.location.search}` !== path) {
    window.history.pushState(null, '', path)
  }
}

function isSignInPath(path: string) {
  return SIGN_IN_PATHS.has(path.replace(/\/+$/, '') || '/')
}

function isAuthPath(path: string) {
  const normalizedPath = path.replace(/\/+$/, '') || '/'

  return isSignInPath(normalizedPath) || normalizedPath === FORGOT_PASSWORD_PATH || normalizedPath === RESET_PASSWORD_PATH || normalizedPath === VERIFY_EMAIL_PATH
}

function App() {
  const [activeSession, setActiveSession] = useState<AdminSession | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview')
  const [onboardingViewMode, setOnboardingViewMode] = useState<OnboardingViewMode>('table')
  const [pendingAction, setPendingAction] = useState<ConsoleAction | null>(null)
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const [currentSearch, setCurrentSearch] = useState(getCurrentSearch)
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const currentSection = navItems.find((item) => item.id === activeSection) ?? navItems[0]

  const clearAdminState = useCallback(() => {
    clearStoredAuthTokens()
    setActiveSession(null)
    setActiveSection('overview')
    setPendingAction(null)
  }, [])

  const navigateTo = useCallback((path: string) => {
    pushPath(path)
    setCurrentPath(path)
    setCurrentSearch('')
  }, [])

  const resetToSignIn = useCallback((path = SIGN_IN_PATH) => {
    clearAdminState()
    navigateTo(path)
  }, [clearAdminState, navigateTo])

  const resetToken = useMemo(() => {
    return new URLSearchParams(currentSearch).get('token') ?? ''
  }, [currentSearch])

  const normalizedPath = currentPath.replace(/\/+$/, '') || '/'

  const goToForgotPassword = useCallback(() => {
    clearAdminState()
    navigateTo(FORGOT_PASSWORD_PATH)
  }, [clearAdminState, navigateTo])

  const goToConsole = useCallback(() => {
    navigateTo(CONSOLE_PATH)
  }, [navigateTo])

  useEffect(() => {
    function handlePathChange() {
      const nextPath = getCurrentPath()

      setCurrentPath(nextPath)
      setCurrentSearch(getCurrentSearch())

      if (isAuthPath(nextPath)) {
        clearAdminState()
      }
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function pushStateWithLocationChange(...args) {
      const result = originalPushState.apply(this, args)
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
      return result
    }

    window.history.replaceState = function replaceStateWithLocationChange(...args) {
      const result = originalReplaceState.apply(this, args)
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
      return result
    }

    window.addEventListener('popstate', handlePathChange)
    window.addEventListener(LOCATION_CHANGE_EVENT, handlePathChange)

    return () => {
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      window.removeEventListener('popstate', handlePathChange)
      window.removeEventListener(LOCATION_CHANGE_EVENT, handlePathChange)
    }
  }, [clearAdminState])

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      if (isAuthPath(getCurrentPath())) {
        setIsRestoringSession(false)
        return
      }

      const session = await restoreCurrentSession()

      if (!isMounted) {
        return
      }

      setActiveSession(session)
      setIsRestoringSession(false)
    }

    void restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      const trigger = target.closest('a, button')

      if (!(trigger instanceof HTMLElement)) {
        return
      }

      const label = trigger.textContent?.replace(/\s+/g, ' ').trim()
      const isSignOutLabel = label ? SIGN_OUT_BUTTON_LABELS.has(label) : false
      const isSignInLink = trigger instanceof HTMLAnchorElement ? isSignInPath(new URL(trigger.href).pathname) : false

      if (!isSignOutLabel && !isSignInLink) {
        return
      }

      event.preventDefault()
      resetToSignIn()
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [resetToSignIn])

  const visibleActions = sectionActions[activeSection] ?? [
    {
      label: 'Только просмотр',
    },
  ]

  function requestActionConsent(action: ConsoleAction) {
    setPendingAction(action)
  }

  function confirmPendingAction() {
    setPendingAction(null)
  }

  async function signIn(email: string, password: string) {
    const session = await signInWithPassword(email.toLowerCase(), password)
    setActiveSession(session)
    goToConsole()
  }

  async function signOut() {
    await signOutCurrentUser().catch(() => undefined)
    resetToSignIn()
  }

  if (normalizedPath === FORGOT_PASSWORD_PATH) {
    return <ForgotPasswordPage onBackToSignIn={resetToSignIn} />
  }

  if (normalizedPath === RESET_PASSWORD_PATH) {
    return <ResetPasswordPage token={resetToken} onBackToSignIn={resetToSignIn} />
  }

  if (normalizedPath === VERIFY_EMAIL_PATH) {
    return <VerifyEmailPage hasToken={Boolean(resetToken)} onBackToSignIn={resetToSignIn} />
  }

  if (isRestoringSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">SG</span>
              <div>
                <strong className="block text-sm font-semibold">Sportgearhub Admin</strong>
                <span className="block text-xs text-muted-foreground">Проверяем сессию</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!activeSession || isSignInPath(normalizedPath)) {
    return <SignInPage onSignIn={signIn} onForgotPassword={goToForgotPassword} />
  }

  return (
    <ConsoleShell
      activeSection={activeSection}
      currentSection={currentSection}
      navItems={navItems}
      operator={activeSession}
      onboardingViewMode={onboardingViewMode}
      onSectionChange={setActiveSection}
      onOnboardingViewModeChange={setOnboardingViewMode}
      onSignOut={signOut}
    >
      {activeSection === 'overview' ? (
        <>
          <MetricsGrid />

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <OperationalQueues items={operationalQueues} />
          </section>
        </>
      ) : (
        <>
          {activeSection === 'onboarding' ? (
            <OnboardingReview viewMode={onboardingViewMode} />
          ) : activeSection === 'canonicalization' ? (
            <EquipmentTaxonomyReview />
          ) : (
            <DomainPanel actions={visibleActions} onAction={requestActionConsent} />
          )}
        </>
      )}

      {pendingAction ? (
        <ConsentModal
          action={pendingAction}
          operatorEmail={activeSession.email}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      ) : null}
    </ConsoleShell>
  )
}

export default App
