import { useEffect, useMemo, useState } from 'react'
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
const SIGN_IN_PATHS = new Set([SIGN_IN_PATH, '/login'])

function getCurrentPath() {
  return window.location.pathname
}

function pushPath(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}

function isSignInPath(path: string) {
  return SIGN_IN_PATHS.has(path)
}

function App() {
  const [activeSession, setActiveSession] = useState<AdminSession | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview')
  const [pendingAction, setPendingAction] = useState<ConsoleAction | null>(null)
  const [search, setSearch] = useState('')
  const [currentPath, setCurrentPath] = useState(getCurrentPath)
  const currentSection = navItems.find((item) => item.id === activeSection) ?? navItems[0]

  useEffect(() => {
    function handlePathChange() {
      const nextPath = getCurrentPath()

      setCurrentPath(nextPath)

      if (isSignInPath(nextPath)) {
        setActiveSession(null)
        setActiveSection('overview')
        setPendingAction(null)
        setSearch('')
      }
    }

    window.addEventListener('popstate', handlePathChange)

    return () => {
      window.removeEventListener('popstate', handlePathChange)
    }
  }, [])

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
    setActiveSession(null)
    setActiveSection('overview')
    setPendingAction(null)
    setSearch('')
    pushPath(SIGN_IN_PATH)
    setCurrentPath(SIGN_IN_PATH)
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
