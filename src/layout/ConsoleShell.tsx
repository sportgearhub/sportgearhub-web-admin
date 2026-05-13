import { useState } from 'react'
import type { AdminSectionId, AdminSession, NavItem } from '../types/admin'

type ConsoleShellProps = {
  children: React.ReactNode
  activeSection: AdminSectionId
  currentSection: NavItem
  navItems: NavItem[]
  operator: AdminSession
  search: string
  onSearchChange: (value: string) => void
  onSectionChange: (section: AdminSectionId) => void
  onSignOut: () => void
}

export function ConsoleShell({
  children,
  activeSection,
  currentSection,
  navItems,
  operator,
  search,
  onSearchChange,
  onSectionChange,
  onSignOut,
}: ConsoleShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className={isSidebarCollapsed ? 'console sidebar-collapsed' : 'console'}>
      <header className="navbar">
        <div className="brand-block">
          <span className="mark" aria-hidden="true">
            S
          </span>
          <div>
            <strong>Sportgearhub</strong>
            <span>Внутренняя консоль</span>
          </div>
        </div>

        <label className="global-search">
          <span>Поиск</span>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Бронирование, платеж, провайдер, воркфлоу, сверка"
          />
        </label>

        <div className="environment">
          <span>Среда</span>
          <strong>Разработка</strong>
        </div>
      </header>

      <div className="console-body">
        <aside className="sidebar" aria-label="Навигация администратора">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            title={isSidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            <span aria-hidden="true">{isSidebarCollapsed ? '›' : '‹'}</span>
            <strong>Меню</strong>
          </button>

          <nav>
            {navItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.id === activeSection ? 'active' : ''}
                onClick={() => onSectionChange(item.id)}
                title={item.label}
              >
                <span className="nav-initial" aria-hidden="true">
                  {item.label.slice(0, 1)}
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-account">
            <div className="operator">
              <span>{operator.name}</span>
              <strong>{operator.email}</strong>
            </div>
            <button type="button" className="sign-out-button" onClick={onSignOut}>
              Выйти
            </button>
          </div>
        </aside>

        <main className="workspace">
          <section className="title-row">
            <div>
              <h1>{currentSection.label}</h1>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  )
}
