import { useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, LayoutGrid, LogOut } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { AdminSectionId, AdminSession, NavItem, OnboardingViewMode } from '../types/admin'

type ConsoleShellProps = {
  children: React.ReactNode
  activeSection: AdminSectionId
  currentSection: NavItem
  navItems: NavItem[]
  operator: AdminSession
  onboardingViewMode: OnboardingViewMode
  onSectionChange: (section: AdminSectionId) => void
  onOnboardingViewModeChange: (mode: OnboardingViewMode) => void
  onSignOut: () => void
}

export function ConsoleShell({
  children,
  activeSection,
  currentSection,
  navItems,
  operator,
  onboardingViewMode,
  onSectionChange,
  onOnboardingViewModeChange,
  onSignOut,
}: ConsoleShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const isTableFirstSection = activeSection === 'onboarding'

  return (
    <div className="flex min-h-screen bg-muted/35">
      <aside className={isSidebarCollapsed ? 'flex w-[72px] flex-col border-r bg-card transition-all' : 'flex w-72 flex-col border-r bg-card transition-all'}>
        <div className="flex h-16 items-center gap-3 border-b px-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
            S
          </span>
          <div className={isSidebarCollapsed ? 'hidden' : 'min-w-0'}>
            <strong className="block truncate text-sm font-semibold">Sportgearhub</strong>
            <span className="block truncate text-xs text-muted-foreground">Внутренняя консоль</span>
          </div>
        </div>

        <div className="p-2">
          <Button
            type="button"
            variant="ghost"
            size={isSidebarCollapsed ? 'icon' : 'sm'}
            className={isSidebarCollapsed ? 'w-full' : 'w-full justify-start'}
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            title={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {isSidebarCollapsed ? null : 'Меню'}
          </Button>
        </div>

        <nav className="grid gap-1 px-2" aria-label="Навигация администратора">
            {navItems.map((item) => (
              <Button
                type="button"
                key={item.id}
                variant={item.id === activeSection ? 'secondary' : 'ghost'}
                size={isSidebarCollapsed ? 'icon' : 'sm'}
                className={isSidebarCollapsed ? 'w-full' : 'w-full justify-start'}
                onClick={() => onSectionChange(item.id)}
                title={item.label}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-[10px] font-bold text-primary" aria-hidden="true">
                  {item.label.slice(0, 1)}
                </span>
                {isSidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
              </Button>
            ))}
        </nav>

        <div className="mt-auto border-t p-3">
          <Button type="button" variant="outline" size={isSidebarCollapsed ? 'icon' : 'sm'} className="w-full justify-start" onClick={onSignOut}>
            <LogOut size={16} />
            {isSidebarCollapsed ? null : 'Выйти'}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{currentSection.label}</h1>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {activeSection === 'onboarding' ? (
              <div className="grid grid-cols-2 rounded-md border bg-muted p-1" aria-label="Режим онбординга">
                <Button
                  type="button"
                  variant={onboardingViewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onOnboardingViewModeChange('table')}
                  aria-pressed={onboardingViewMode === 'table'}
                  title="Таблица"
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">Таблица</span>
                </Button>
                <Button
                  type="button"
                  variant={onboardingViewMode === 'analytics' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => onOnboardingViewModeChange('analytics')}
                  aria-pressed={onboardingViewMode === 'analytics'}
                  title="Аналитика"
                >
                  <BarChart3 size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">Аналитика</span>
                </Button>
              </div>
            ) : null}
            <div className="hidden min-w-0 text-right sm:block">
              <div className="truncate text-xs text-muted-foreground">{operator.name}</div>
              <strong className="block truncate text-sm font-medium">{operator.email}</strong>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onSignOut} aria-label="Выйти" title="Выйти">
              <LogOut size={16} />
            </Button>
          </div>
        </header>
        <main className={isTableFirstSection ? 'min-w-0 flex-1 p-0' : 'min-w-0 flex-1 p-4'}>
          <div
            className={
              isTableFirstSection
                ? 'min-h-[calc(100vh-3.5rem)] bg-background'
                : 'min-h-[calc(100vh-5.5rem)] rounded-lg border bg-background p-4 shadow-sm'
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
