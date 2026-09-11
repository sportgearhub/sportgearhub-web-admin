import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { ConsentModal } from './components/ConsentModal'
import { MetricsGrid } from './components/MetricsGrid'
import { navGroups, navItems, sectionActions } from './data/adminConfig'
import { DomainPanel } from './features/admin/DomainPanel'
import { EquipmentTaxonomyReview } from './features/admin/EquipmentTaxonomyReview'
import { OnboardingApplicationPage, OnboardingReview } from './features/admin/OnboardingReview'
import { ProviderDetailPage } from './features/admin/providers/ProviderDetailPage'
import { ProviderManagementPage } from './features/admin/providers/ProviderManagementPage'
import { UserManagementPage } from './features/admin/users/UserManagementPage'
import { SignInPage } from './features/auth/SignInPage'
import { VerifyEmailPage } from './features/auth/VerifyEmailPage'
import {
  enrolTrustedDevice,
  requestSignInCode,
  restoreCurrentSession,
  signInWithCode,
  signInWithPasscode,
  signOutCurrentUser,
} from './features/auth/authApi'
import { clearStoredAuthTokens } from './features/auth/authTokenStore'
import { ConsoleShell } from './layout/ConsoleShell'
import type { AdminSectionId, AdminSession, ConsoleAction, OnboardingViewMode } from './types/admin'

const CONSOLE_PATH = '/console'
const ONBOARDING_PATH = '/console/onboarding'
const ONBOARDING_APPLICATIONS_PATH = '/console/onboarding/applications'
const PROVIDERS_PATH = '/console/providers'
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

function getSectionPath(section: AdminSectionId) {
  if (section === 'onboarding') {
    return ONBOARDING_PATH
  }

  if (section === 'governance') {
    return PROVIDERS_PATH
  }

  return CONSOLE_PATH
}

function getSectionFromPath(path: string): AdminSectionId | null {
  if (path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}/`)) {
    return 'onboarding'
  }

  if (path === PROVIDERS_PATH || path.startsWith(`${PROVIDERS_PATH}/`)) {
    return 'governance'
  }

  return null
}

function getOnboardingApplicationId(path: string) {
  if (!path.startsWith(`${ONBOARDING_APPLICATIONS_PATH}/`)) {
    return ''
  }

  return decodeURIComponent(path.slice(ONBOARDING_APPLICATIONS_PATH.length + 1))
}

function getProviderIdFromPath(path: string) {
  if (!path.startsWith(`${PROVIDERS_PATH}/`)) {
    return ''
  }

  return decodeURIComponent(path.slice(PROVIDERS_PATH.length + 1).split('/')[0] ?? '')
}

function getProviderPayoutContractIdFromPath(path: string) {
  const providerId = getProviderIdFromPath(path)

  if (!providerId) {
    return ''
  }

  const payoutContractsPath = `${PROVIDERS_PATH}/${encodeURIComponent(providerId)}/payout-contracts/`

  if (!path.startsWith(payoutContractsPath)) {
    return ''
  }

  return decodeURIComponent(path.slice(payoutContractsPath.length))
}

function isSignInPath(path: string) {
  return SIGN_IN_PATHS.has(path.replace(/\/+$/, '') || '/')
}

function isAuthPath(path: string) {
  const normalizedPath = path.replace(/\/+$/, '') || '/'

  return isSignInPath(normalizedPath) || normalizedPath === VERIFY_EMAIL_PATH
}

function App() {
  const [activeSession, setActiveSession] = useState<AdminSession | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() => getSectionFromPath(getCurrentPath()) ?? 'overview')
  const [onboardingViewMode, setOnboardingViewMode] = useState<OnboardingViewMode>('table')
  const [topBarContent, setTopBarContent] = useState<React.ReactNode | null>(null)
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
  const currentProviderId = useMemo(() => getProviderIdFromPath(normalizedPath), [normalizedPath])
  const currentProviderPayoutContractId = useMemo(() => getProviderPayoutContractIdFromPath(normalizedPath), [normalizedPath])

  const goToConsole = useCallback(() => {
    navigateTo(CONSOLE_PATH)
  }, [navigateTo])

  const handleSectionChange = useCallback((section: AdminSectionId) => {
    setTopBarContent(null)
    setActiveSection(section)
    navigateTo(getSectionPath(section))
  }, [navigateTo])

  const openOnboardingApplication = useCallback((applicationId: string) => {
    navigateTo(`${ONBOARDING_APPLICATIONS_PATH}/${encodeURIComponent(applicationId)}`)
  }, [navigateTo])

  const closeOnboardingApplication = useCallback(() => {
    navigateTo(ONBOARDING_PATH)
  }, [navigateTo])

  const openProvider = useCallback((providerId: string) => {
    navigateTo(`${PROVIDERS_PATH}/${encodeURIComponent(providerId)}`)
  }, [navigateTo])

  const closeProvider = useCallback(() => {
    navigateTo(PROVIDERS_PATH)
  }, [navigateTo])

  const openProviderPayoutContract = useCallback((providerId: string, contractId: string) => {
    navigateTo(`${PROVIDERS_PATH}/${encodeURIComponent(providerId)}/payout-contracts/${encodeURIComponent(contractId)}`)
  }, [navigateTo])

  const closeProviderPayoutContract = useCallback((providerId: string) => {
    navigateTo(`${PROVIDERS_PATH}/${encodeURIComponent(providerId)}`)
  }, [navigateTo])

  const openCurrentProviderPayoutContract = useCallback((contractId: string) => {
    if (currentProviderId) {
      openProviderPayoutContract(currentProviderId, contractId)
    }
  }, [currentProviderId, openProviderPayoutContract])

  const newCurrentProviderPayoutContract = useCallback(() => {
    if (currentProviderId) {
      openProviderPayoutContract(currentProviderId, 'new')
    }
  }, [currentProviderId, openProviderPayoutContract])

  const closeCurrentProviderPayoutContract = useCallback(() => {
    if (currentProviderId) {
      closeProviderPayoutContract(currentProviderId)
    }
  }, [closeProviderPayoutContract, currentProviderId])

  useEffect(() => {
    function handlePathChange() {
      const nextPath = getCurrentPath()

      setCurrentPath(nextPath)
      setCurrentSearch(getCurrentSearch())

      if (isAuthPath(nextPath)) {
        clearAdminState()
        return
      }

      const nextSection = getSectionFromPath(nextPath)

      if (nextSection) {
        setActiveSection(nextSection)
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

  function requestCode(email: string) {
    return requestSignInCode(email.toLowerCase())
  }

  // The session starts here; the console opens only after the optional passcode enrolment step, so the
  // admin is not dropped into the shell mid-flow.
  async function submitCode(email: string, code: string) {
    setActiveSession(await signInWithCode(email.toLowerCase(), code))
  }

  async function submitPasscode(passcode: string) {
    setActiveSession(await signInWithPasscode(passcode))
    goToConsole()
  }

  async function enrolDevice(passcode: string) {
    await enrolTrustedDevice(passcode, navigator.userAgent.slice(0, 100))
    goToConsole()
  }

  async function signOut() {
    await signOutCurrentUser().catch(() => undefined)
    resetToSignIn()
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
    return (
      <SignInPage
        onRequestCode={requestCode}
        onSubmitCode={submitCode}
        onSubmitPasscode={submitPasscode}
        onEnrolDevice={enrolDevice}
      />
    )
  }

  return (
    <ConsoleShell
      activeSection={activeSection}
      currentSection={currentSection}
      navGroups={navGroups}
      operator={activeSession}
      topBarContent={topBarContent}
      onSectionChange={handleSectionChange}
      onSignOut={signOut}
    >
      {activeSection === 'overview' ? (
        <section className="min-h-[calc(100vh-3.5rem)] bg-card p-3">
          <MetricsGrid />

          <section>
            <h2 className="text-sm font-semibold">Операционная консоль</h2>
            <p className="mt-1 text-sm text-muted-foreground">Выберите раздел в навигации для работы с реальными API-очередями.</p>
          </section>
        </section>
      ) : (
        <>
          {activeSection === 'onboarding' ? (
            getOnboardingApplicationId(normalizedPath) ? (
              <OnboardingApplicationPage
                applicationId={getOnboardingApplicationId(normalizedPath)}
                onBack={closeOnboardingApplication}
                onTopBarContentChange={setTopBarContent}
              />
            ) : (
              <OnboardingReview
                viewMode={onboardingViewMode}
                onViewModeChange={setOnboardingViewMode}
                onOpenApplication={openOnboardingApplication}
                onTopBarContentChange={setTopBarContent}
              />
            )
          ) : activeSection === 'governance' ? (
            currentProviderId ? (
              <ProviderDetailPage
                providerId={currentProviderId}
                payoutContractId={currentProviderPayoutContractId || undefined}
                onBack={closeProvider}
                onOpenPayoutContract={openCurrentProviderPayoutContract}
                onNewPayoutContract={newCurrentProviderPayoutContract}
                onClosePayoutContract={closeCurrentProviderPayoutContract}
                onTopBarContentChange={setTopBarContent}
              />
            ) : (
              <ProviderManagementPage onOpenProvider={openProvider} />
            )
          ) : activeSection === 'users' ? (
            <UserManagementPage />
          ) : activeSection === 'canonicalization' ? (
            <EquipmentTaxonomyReview onTopBarContentChange={setTopBarContent} />
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
