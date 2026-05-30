import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { AdminSectionId, AdminSession, NavGroup, NavItem } from '../types/admin'

type ConsoleShellProps = {
  children: React.ReactNode
  activeSection: AdminSectionId
  currentSection: NavItem
  navGroups: NavGroup[]
  operator: AdminSession
  topBarContent?: React.ReactNode
  onSectionChange: (section: AdminSectionId) => void
  onSignOut: () => void
}

export function ConsoleShell({
  children,
  activeSection,
  currentSection,
  navGroups,
  operator,
  topBarContent,
  onSectionChange,
  onSignOut,
}: ConsoleShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  function toggleGroup(groupId: string) {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }))
  }

  return (
    <div className="flex min-h-screen bg-background">
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

        <nav className="grid gap-1 overflow-y-auto px-2 pb-3" aria-label="Навигация администратора">
          {navGroups.map((group) => {
            const isActiveGroup = group.items.some((item) => item.id === activeSection)
            const isGroupExpanded = Boolean(expandedGroups[group.id]) || isActiveGroup

            return (
              <section key={group.id} className="grid gap-1">
                <button
                  type="button"
                  className={isSidebarCollapsed ? 'grid h-8 w-full place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground' : 'flex h-8 w-full items-center justify-between rounded-md px-2 text-xs font-medium uppercase tracking-normal text-muted-foreground hover:bg-muted hover:text-foreground'}
                  onClick={() => toggleGroup(group.id)}
                  title={group.label}
                  aria-expanded={isGroupExpanded}
                >
                  <span className={isSidebarCollapsed ? 'text-[10px] font-bold' : 'truncate'}>{isSidebarCollapsed ? group.label.slice(0, 1) : group.label}</span>
                  {isSidebarCollapsed ? null : <ChevronDown size={14} className={isGroupExpanded ? 'transition-transform' : '-rotate-90 transition-transform'} aria-hidden="true" />}
                </button>

                {isGroupExpanded ? group.items.map((item) => (
                  <Button
                    type="button"
                    key={item.id}
                    variant={item.id === activeSection ? 'secondary' : 'ghost'}
                    size={isSidebarCollapsed ? 'icon' : 'sm'}
                    className={isSidebarCollapsed ? 'w-full' : 'w-full justify-start pl-3'}
                    onClick={() => onSectionChange(item.id)}
                    title={item.label}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-[10px] font-bold text-primary" aria-hidden="true">
                      {item.label.slice(0, 1)}
                    </span>
                    {isSidebarCollapsed ? null : <span className="truncate">{item.label}</span>}
                  </Button>
                )) : null}
              </section>
            )
          })}
        </nav>

        <div className="mt-auto border-t p-3">
          <Button type="button" variant="outline" size={isSidebarCollapsed ? 'icon' : 'sm'} className="w-full justify-start" onClick={onSignOut}>
            <LogOut size={16} />
            {isSidebarCollapsed ? null : 'Выйти'}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            {topBarContent ?? <h1 className="truncate text-sm font-semibold">{currentSection.label}</h1>}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <div className="truncate text-xs text-muted-foreground">{operator.name}</div>
              <strong className="block truncate text-sm font-medium">{operator.email}</strong>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onSignOut} aria-label="Выйти" title="Выйти">
              <LogOut size={16} />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
