import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { ConsentModal } from './components/ConsentModal'
import { MetricsGrid } from './components/MetricsGrid'
import { OperationalQueues } from './components/OperationalQueues'
import { navItems, operationalQueues, sectionActions, seededAdminSession } from './data/adminPrototype'
import { DomainPanel } from './features/admin/DomainPanel'
import { OnboardingReview } from './features/admin/OnboardingReview'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignInPage } from './features/auth/SignInPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import { ConsoleShell } from './layout/ConsoleShell'
import type { AdminSectionId, AdminSession, ConsoleAction } from './types/admin'

const CONSOLE_PATH = '/console'
const FORGOT_PASSWORD_PATH = '/auth/forgot-password'
const RESET_PASSWORD_PATH = '/auth/reset-password'
const SIGN_IN_PATH = '/sign-in'
const VERIFY_EMAIL_PATH = '/auth/verify-email'
const LOCATION_CHANGE_EVENT = 'sportgearhub-location-change'
const SIGN_IN_PATHS = new Set([SIGN_IN_PATH, '/login', '/auth/sign-in', '/auth/login'])
const SIGN_OUT_BUTTON_LABELS = new Set(['Вернуться ко входу', 'Back to sign in'])

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
  const [pendingAction, setPendingAction] = useState<ConsoleAction | null>(null)
  const [search, setSearch] = useState('')
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const [currentSearch, setCurrentSearch] = useState(getCurrentSearch)
  const currentSection = navItems.find((item) => item.id === activeSection) ?? navItems[0]

  const clearAdminState = useCallback(() => {
    setActiveSession(null)
    setActiveSection('overview')
    setPendingAction(null)
    setSearch('')
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

  const filteredQueues = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return operationalQueues
    }

    return operationalQueues.filter((item) =>
      `${item.id} ${item.title} ${item.owner} ${item.status}`.toLowerCase().includes(query),
    )
  }, [search])

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

  function signIn(email: string) {
    const normalizedEmail = email.toLowerCase()
    setActiveSession({ ...seededAdminSession, email: normalizedEmail })
    goToConsole()
  }

  function devSignIn() {
    setActiveSession(seededAdminSession)
    goToConsole()
  }

  function signOut() {
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

  if (!activeSession || isSignInPath(normalizedPath)) {
    return <SignInPage onSignIn={signIn} onDevSignIn={devSignIn} onForgotPassword={goToForgotPassword} />
  }

  return (
    <ConsoleShell
      activeSection={activeSection}
      currentSection={currentSection}
      navItems={navItems}
      operator={activeSession}
      search={search}
      onSearchChange={setSearch}
      onSectionChange={setActiveSection}
      onSignOut={signOut}
    >
      {activeSection === 'overview' ? (
        <>
          <MetricsGrid />

          <section className="content-grid">
            <OperationalQueues items={filteredQueues} />
          </section>
        </>
      ) : (
        <>
          {activeSection === 'onboarding' ? (
            <OnboardingReview actions={visibleActions} onAction={requestActionConsent} />
          ) : (
            <DomainPanel activeSection={activeSection} actions={visibleActions} onAction={requestActionConsent} />
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
