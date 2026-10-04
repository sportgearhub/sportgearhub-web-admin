import { useCallback, useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { navGroups, navItems } from './data/adminConfig'
import { CatalogPage } from './features/admin/catalog/CatalogPage'
import { FinancePage } from './features/admin/finance/FinancePage'
import { OverviewPage } from './features/admin/overview/OverviewPage'
import { ProductReviewPage } from './features/admin/products/ProductReviewPage'
import { SellerCardPage } from './features/admin/sellers/SellerCardPage'
import { SellersPage } from './features/admin/sellers/SellersPage'
import { UserManagementPage } from './features/admin/users/UserManagementPage'
import { SignInPage } from './features/auth/SignInPage'
import { AuthFrame } from './features/auth/AuthFrame'
import {
  enrolTrustedDevice,
  restoreCurrentSession,
  signInWithEmailCode,
  signInWithPasscode,
  signOutCurrentUser,
} from './features/auth/authApi'
import { clearStoredAuthTokens } from './features/auth/authTokenStore'
import { ConsoleShell } from './layout/ConsoleShell'
import type { AdminSectionId, AdminSession } from './types/admin'

const CONSOLE_PATH = '/console'
const SIGN_IN_PATH = '/sign-in'
const LOCATION_CHANGE_EVENT = 'sportgearhub-location-change'

const SECTION_PATHS: Record<AdminSectionId, string> = {
  overview: CONSOLE_PATH,
  onboarding: `${CONSOLE_PATH}/onboarding`,
  products: `${CONSOLE_PATH}/products`,
  sellers: `${CONSOLE_PATH}/sellers`,
  finance: `${CONSOLE_PATH}/finance`,
  users: `${CONSOLE_PATH}/users`,
  catalog: `${CONSOLE_PATH}/catalog`,
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/'
}

function sectionFromPath(path: string): AdminSectionId {
  const found = (Object.entries(SECTION_PATHS) as Array<[AdminSectionId, string]>)
    .filter(([id]) => id !== 'overview')
    .find(([, prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return found?.[0] ?? 'overview'
}

function sellerIdFromPath(path: string) {
  const match = /^\/console\/sellers\/([^/]+)$/.exec(path)
  return match ? decodeURIComponent(match[1]) : ''
}

function pushPath(path: string) {
  if (normalizePath(window.location.pathname) !== path) {
    window.history.pushState(null, '', path)
  }
}

function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  const [topBarContent, setTopBarContent] = useState<React.ReactNode | null>(null)
  const section = sectionFromPath(path)
  const currentSection = navItems.find((item) => item.id === section) ?? navItems[0]
  const sellerId = sellerIdFromPath(path)

  const navigateTo = useCallback((next: string) => {
    pushPath(next)
    setPath(next)
  }, [])

  // SellerCardPage pushes its breadcrumb through an effect that lists onBack in its deps, so this
  // callback must be stable — an inline arrow here would make the effect re-run every render, call
  // setTopBarContent again, and loop until React throws (#185).
  const backToSellers = useCallback(() => navigateTo(SECTION_PATHS.sellers), [navigateTo])

  useEffect(() => {
    const onChange = () => setPath(normalizePath(window.location.pathname))
    const originalPushState = window.history.pushState
    window.history.pushState = function pushStateWithEvent(...args) {
      const result = originalPushState.apply(this, args)
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
      return result
    }
    window.addEventListener('popstate', onChange)
    window.addEventListener(LOCATION_CHANGE_EVENT, onChange)
    return () => {
      window.history.pushState = originalPushState
      window.removeEventListener('popstate', onChange)
      window.removeEventListener(LOCATION_CHANGE_EVENT, onChange)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    restoreCurrentSession()
      .then((restored) => { if (mounted) setSession(restored) })
      .finally(() => { if (mounted) setRestoring(false) })
    return () => { mounted = false }
  }, [])

  // A signed-in admin on /sign-in or an unknown path lands in the console.
  useEffect(() => {
    if (!session?.isAdmin || path.startsWith(CONSOLE_PATH)) return
    const timer = window.setTimeout(() => navigateTo(CONSOLE_PATH), 0)
    return () => window.clearTimeout(timer)
  }, [session, path, navigateTo])

  const enterConsole = useCallback(() => {
    navigateTo(path.startsWith(CONSOLE_PATH) ? path : CONSOLE_PATH)
  }, [navigateTo, path])

  async function signOut() {
    await signOutCurrentUser().catch(() => undefined)
    clearStoredAuthTokens()
    setSession(null)
    setTopBarContent(null)
    navigateTo(SIGN_IN_PATH)
  }

  if (restoring) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/40 p-4">
        <Card className="w-full max-w-[420px]">
          <CardHeader className="pb-6">
            <strong className="block text-sm font-semibold">Sportgearhub · Внутренняя консоль</strong>
            <span className="block text-xs text-muted-foreground">Проверяем сессию</span>
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

  if (!session) {
    return (
      <SignInPage
        onSubmitCode={async (email, code) => setSession(await signInWithEmailCode(email, code))}
        onSubmitPasscode={async (passcode) => {
          setSession(await signInWithPasscode(passcode))
          enterConsole()
        }}
        onEnrolDevice={async (passcode) => {
          await enrolTrustedDevice(passcode, navigator.userAgent.slice(0, 100))
          enterConsole()
        }}
      />
    )
  }

  if (!session.isAdmin) {
    return (
      <AuthFrame>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Нет доступа</h1>
            <p className="text-sm text-muted-foreground">
              Вы вошли как {session.name}, но эта учётная запись не администратор платформы. Кабинет продавца находится на crm.sportgearhub.ru.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void signOut()}>Выйти</Button>
        </div>
      </AuthFrame>
    )
  }

  return (
    <ConsoleShell
      activeSection={section}
      currentSection={currentSection}
      navGroups={navGroups}
      operator={session}
      topBarContent={topBarContent}
      onSectionChange={(next) => {
        setTopBarContent(null)
        navigateTo(SECTION_PATHS[next])
      }}
      onSignOut={() => void signOut()}
    >
      {section === 'overview' ? (
        <OverviewPage
          onOpenOnboarding={() => navigateTo(SECTION_PATHS.onboarding)}
          onOpenSellers={() => navigateTo(SECTION_PATHS.sellers)}
          onOpenProducts={() => navigateTo(SECTION_PATHS.products)}
          onOpenSeller={(id) => navigateTo(`${SECTION_PATHS.sellers}/${encodeURIComponent(id)}`)}
        />
      ) : section === 'onboarding' ? (
        <SellersPage mode="onboarding" onOpenSeller={(id) => navigateTo(`${SECTION_PATHS.sellers}/${encodeURIComponent(id)}`)} />
      ) : section === 'products' ? (
        <ProductReviewPage />
      ) : section === 'sellers' ? (
        sellerId ? (
          <SellerCardPage sellerId={sellerId} onBack={backToSellers} onTopBarContentChange={setTopBarContent} />
        ) : (
          <SellersPage mode="all" onOpenSeller={(id) => navigateTo(`${SECTION_PATHS.sellers}/${encodeURIComponent(id)}`)} />
        )
      ) : section === 'finance' ? (
        <FinancePage />
      ) : section === 'users' ? (
        <UserManagementPage />
      ) : (
        <CatalogPage />
      )}
    </ConsoleShell>
  )
}

export default App
