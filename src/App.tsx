import { useMemo, useState } from 'react'
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

function App() {
  const [activeSession, setActiveSession] = useState<AdminSession | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview')
  const [pendingAction, setPendingAction] = useState<ConsoleAction | null>(null)
  const [search, setSearch] = useState('')
  const currentSection = navItems.find((item) => item.id === activeSection) ?? navItems[0]

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
  }

  function devSignIn() {
    setActiveSession(seededAdminSession)
  }

  function signOut() {
    setActiveSession(null)
    setActiveSection('overview')
    setPendingAction(null)
    setSearch('')
  }

  if (!activeSession) {
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
