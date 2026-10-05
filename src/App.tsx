import { useCallback, useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { navGroups, navItems } from './data/adminConfig'
import { CatalogPage } from './features/admin/catalog/CatalogPage'
import { BookingDetailPage, BookingsPage } from './features/admin/finance/BookingsPage'
import { PaymentLookup } from './features/admin/finance/PaymentLookup'
import { PayoutDetailPage, PayoutsPage } from './features/admin/finance/PayoutsPage'
import { ReceiptDetailPage, ReceiptsPage } from './features/admin/finance/ReceiptsPage'
import { SettlementDetailPage, SettlementsPage } from './features/admin/finance/SettlementsPage'
import { OverviewPage } from './features/admin/overview/OverviewPage'
import { ProductDetailPage } from './features/admin/products/ProductDetailPage'
import { ProductReviewPage } from './features/admin/products/ProductReviewPage'
import { SellerCardPage } from './features/admin/sellers/SellerCardPage'
import { SellersPage } from './features/admin/sellers/SellersPage'
import { UserDetailPage } from './features/admin/users/UserDetailPage'
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
  bookings: `${CONSOLE_PATH}/bookings`,
  settlements: `${CONSOLE_PATH}/settlements`,
  payouts: `${CONSOLE_PATH}/payouts`,
  receipts: `${CONSOLE_PATH}/receipts`,
  payments: `${CONSOLE_PATH}/payments`,
  users: `${CONSOLE_PATH}/users`,
  catalog: `${CONSOLE_PATH}/catalog`,
}

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/'
}

/** `/console/<section>/<id?>` → the active section and an optional detail id. */
function parseRoute(path: string): { section: AdminSectionId; detailId: string } {
  const rest = normalizePath(path).replace(/^\/console\/?/, '')
  if (!rest) return { section: 'overview', detailId: '' }
  const [seg, rawId] = rest.split('/')
  const entry = (Object.entries(SECTION_PATHS) as Array<[AdminSectionId, string]>).find(([, prefix]) => prefix === `${CONSOLE_PATH}/${seg}`)
  return { section: entry?.[0] ?? 'overview', detailId: rawId ? decodeURIComponent(rawId) : '' }
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
  const { section, detailId } = parseRoute(path)
  const currentSection = navItems.find((item) => item.id === section) ?? navItems[0]

  const navigateTo = useCallback((next: string) => {
    pushPath(next)
    setPath(next)
  }, [])

  const openSection = useCallback((next: AdminSectionId) => navigateTo(SECTION_PATHS[next]), [navigateTo])
  const openDetail = useCallback((next: AdminSectionId, id: string) => navigateTo(`${SECTION_PATHS[next]}/${encodeURIComponent(id)}`), [navigateTo])

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

  function renderSection() {
    switch (section) {
      case 'overview':
        return (
          <OverviewPage
            onOpenOnboarding={() => openSection('onboarding')}
            onOpenSellers={() => openSection('sellers')}
            onOpenProducts={() => openSection('products')}
            onOpenSeller={(id) => openDetail('sellers', id)}
          />
        )
      case 'onboarding':
        return <SellersPage mode="onboarding" onOpenSeller={(id) => openDetail('sellers', id)} />
      case 'products':
        return detailId
          ? <ProductDetailPage productId={detailId} onBack={() => openSection('products')} onOpenSeller={(id) => openDetail('sellers', id)} />
          : <ProductReviewPage onOpen={(id) => openDetail('products', id)} />
      case 'sellers':
        return detailId
          ? <SellerCardPage sellerId={detailId} onBack={() => openSection('sellers')} />
          : <SellersPage mode="all" onOpenSeller={(id) => openDetail('sellers', id)} />
      case 'bookings':
        return detailId
          ? <BookingDetailPage bookingId={detailId} onBack={() => openSection('bookings')} onOpenPayment={(id) => openDetail('payments', id)} onOpenSeller={(id) => openDetail('sellers', id)} />
          : <BookingsPage onOpen={(id) => openDetail('bookings', id)} />
      case 'settlements':
        return detailId
          ? <SettlementDetailPage settlementPlanId={detailId} onBack={() => openSection('settlements')} onOpenBooking={(id) => openDetail('bookings', id)} />
          : <SettlementsPage onOpen={(id) => openDetail('settlements', id)} />
      case 'payouts':
        return detailId
          ? <PayoutDetailPage payoutExecutionId={detailId} onBack={() => openSection('payouts')} onOpenBooking={(id) => openDetail('bookings', id)} />
          : <PayoutsPage onOpen={(id) => openDetail('payouts', id)} />
      case 'receipts':
        return detailId
          ? <ReceiptDetailPage receiptId={detailId} onBack={() => openSection('receipts')} onOpenBooking={(id) => openDetail('bookings', id)} />
          : <ReceiptsPage onOpen={(id) => openDetail('receipts', id)} />
      case 'payments':
        return <PaymentLookup seedBookingId={detailId || undefined} />
      case 'users':
        return detailId
          ? <UserDetailPage userId={detailId} onBack={() => openSection('users')} onOpenSeller={(id) => openDetail('sellers', id)} />
          : <UserManagementPage onOpen={(id) => openDetail('users', id)} />
      case 'catalog':
        return <CatalogPage />
      default:
        return null
    }
  }

  return (
    <ConsoleShell
      activeSection={section}
      currentSection={currentSection}
      navGroups={navGroups}
      operator={session}
      onSectionChange={openSection}
      onSignOut={() => void signOut()}
    >
      {renderSection()}
    </ConsoleShell>
  )
}

export default App
