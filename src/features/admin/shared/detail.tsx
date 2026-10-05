import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/ui/button'

/**
 * The frame every detail view shares: a sticky header with back, title, status and actions, over a
 * content area that holds a responsive grid of panels. Replaces the detail modals — a real page reads
 * better, deep-links, and leaves room to breathe.
 */
export function DetailScreen({
  onBack,
  title,
  subtitle,
  badges,
  actions,
  loading,
  error,
  children,
}: {
  onBack: () => void
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  loading?: boolean
  error?: string
  children?: ReactNode
}) {
  return (
    <section className="min-h-[calc(100dvh-3.5rem)]">
      <div className="sticky top-14 z-20 flex flex-col gap-2 border-b bg-card/95 px-2 py-2 backdrop-blur sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Назад" title="Назад" className="shrink-0">
            <ChevronLeft size={18} />
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
              {badges}
            </div>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? (
          <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 sm:mx-0 sm:ml-auto sm:flex-wrap sm:justify-end sm:px-0">
            {actions}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Загружаем…</p>
      ) : error ? (
        <p className="px-4 py-16 text-center text-sm font-medium text-destructive">{error}</p>
      ) : (
        <div className="p-3 sm:p-4 lg:p-6">{children}</div>
      )}
    </section>
  )
}

/** Two-column-friendly grid for detail panels. */
export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>
}

export function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <div className="panel-header">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2 text-sm last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{value ?? '—'}</dd>
    </div>
  )
}
