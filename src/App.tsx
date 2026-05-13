import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { ConsentModal } from './components/ConsentModal'
import { MetricsGrid } from './components/MetricsGrid'
import { OperationalQueues } from './components/OperationalQueues'
import { navItems, operationalQueues, sectionActions, seededAdminSession } from './data/adminPrototype'
import { DomainPanel } from './features/admin/DomainPanel'
import { OnboardingReview } from './features/admin/OnboardingReview'
import { SignInPage } from './features/auth/SignInPage'
import { ConsoleShell } from './layout/ConsoleShell'
import type { AdminSectionId, AdminSession, ConsoleAction } from './types/admin'

const CONSOLE_PATH = '/console'
const SIGN_IN_PATH = '/sign-in'
const LOCATION_CHANGE_EVENT = 'sportgearhub-location-change'
const SIGN_IN_PATHS = new Set([SIGN_IN_PATH, '/login', '/auth/sign-in', '/auth/login'])
const SIGN_OUT_BUTTON_LABELS = new Set(['Вернуться ко входу', 'Back to sign in'])

function getCurrentPath() {
  return window.location.pathname
}

function pushPath(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

function isSignInPath(path: string) {
  return SIGN_IN_PATHS.has(path.replace(/\/+$/, '') || '/')
}

function App() {
  const [activeSession, setActiveSession] = useState<AdminSession | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview')
  const [pendingAction, setPendingAction] = useState<ConsoleAction | null>(null)
  const [search, setSearch] = useState('')
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const currentSection = navItems.find((item) => item.id === activeSection) ?? navItems[0]

  const resetToSignIn = useCallback((path = SIGN_IN_PATH) => {
    setActiveSession(null)
    setActiveSection('overview')
    setPendingAction(null)
    setSearch('')
    pushPath(path)
    setCurrentPath(path)
  }, [])

  useEffect(() => {
    function handlePathChange() {
      const nextPath = getCurrentPath()

      setCurrentPath(nextPath)

      if (isSignInPath(nextPath)) {
        resetToSignIn(nextPath)
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
  }, [resetToSignIn])

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
    pushPath(CONSOLE_PATH)
    setCurrentPath(CONSOLE_PATH)
  }

  function devSignIn() {
    setActiveSession(seededAdminSession)
    pushPath(CONSOLE_PATH)
    setCurrentPath(CONSOLE_PATH)
  }

  function signOut() {
    resetToSignIn()
  }

  if (!activeSession || isSignInPath(currentPath)) {
    return <SignInPage onSignIn={signIn} onDevSignIn={devSignIn} />
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
