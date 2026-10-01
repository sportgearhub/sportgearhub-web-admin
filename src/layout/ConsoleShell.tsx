import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { LogOut, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { bottomNavIds } from '../data/adminConfig'
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

function initials(session: AdminSession) {
  const source = session.name?.trim() || session.email || '—'
  return source.slice(0, 2).toUpperCase()
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">S</span>
      {compact ? null : (
        <div className="min-w-0">
          <strong className="block truncate text-sm font-semibold leading-tight">Sportgearhub</strong>
          <span className="block truncate text-xs text-muted-foreground">Внутренняя консоль</span>
        </div>
      )}
    </div>
  )
}

function NavList({ navGroups, activeSection, collapsed, onSelect }: { navGroups: NavGroup[]; activeSection: AdminSectionId; collapsed: boolean; onSelect: (section: AdminSectionId) => void }) {
  return (
    <nav className="grid content-start gap-4 p-2" aria-label="Навигация">
      {navGroups.map((group) => (
        <div key={group.id} className="grid gap-1">
          {collapsed ? <div className="mx-auto my-1 h-px w-6 bg-border" aria-hidden="true" /> : (
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group.label}</span>
          )}
          {group.items.map((item) => {
            const Icon = item.icon
            const active = item.id === activeSection
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  'h-11 lg:h-10',
                  collapsed ? 'justify-center px-0' : '',
                  active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon size={19} className="shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function ConsoleShell({ children, activeSection, currentSection, navGroups, operator, topBarContent, onSectionChange, onSignOut }: ConsoleShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const bottomItems = bottomNavIds
    .map((id) => navGroups.flatMap((group) => group.items).find((item) => item.id === id))
    .filter((item): item is NavItem => Boolean(item))

  function go(section: AdminSectionId) {
    onSectionChange(section)
    setDrawerOpen(false)
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r bg-card transition-[width] lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
        <div className={cn('flex h-16 items-center border-b px-3', collapsed ? 'justify-center' : 'justify-between')}>
          <Brand compact={collapsed} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList navGroups={navGroups} activeSection={activeSection} collapsed={collapsed} onSelect={onSectionChange} />
        </div>
        <div className="grid gap-1 border-t p-2">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className={cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground', collapsed && 'justify-center px-0')} title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            {collapsed ? null : <span>Свернуть</span>}
          </button>
          <button type="button" onClick={onSignOut} className={cn('flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground', collapsed && 'justify-center px-0')} title="Выйти">
            <LogOut size={19} />
            {collapsed ? null : <span>Выйти</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-[320px] flex-col bg-card shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden">
            <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
            <div className="flex h-16 items-center justify-between border-b px-3">
              <Brand />
              <Button type="button" variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} aria-label="Закрыть меню"><X size={18} /></Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavList navGroups={navGroups} activeSection={activeSection} collapsed={false} onSelect={go} />
            </div>
            <div className="border-t p-3">
              <div className="mb-2 flex items-center gap-2.5 px-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(operator)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{operator.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{operator.email || operator.phone}</div>
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={onSignOut}><LogOut size={16} /> Выйти</Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-2 backdrop-blur sm:px-4">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Открыть меню"><Menu size={20} /></Button>
          <div className="min-w-0 flex-1">
            {topBarContent ?? <h1 className="truncate text-sm font-semibold sm:text-base">{currentSection.label}</h1>}
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="min-w-0 text-right">
              <div className="truncate text-xs text-muted-foreground">{operator.name}</div>
              <strong className="block truncate text-sm font-medium">{operator.email || operator.phone}</strong>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(operator)}</span>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Быстрая навигация">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const active = item.id === activeSection
          return (
            <button key={item.id} type="button" onClick={() => go(item.id)} className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')} aria-current={active ? 'page' : undefined}>
              <Icon size={21} />
              <span className="max-w-full truncate px-1">{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
        <button type="button" onClick={() => setDrawerOpen(true)} className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
          <MoreHorizontal size={21} />
          <span>Ещё</span>
        </button>
      </nav>
    </div>
  )
}
