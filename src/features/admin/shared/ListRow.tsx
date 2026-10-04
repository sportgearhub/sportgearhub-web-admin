import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import type { PaginationResponse } from '../adminApi'

export type ListField = { label: string; value: ReactNode }

/**
 * One row of an entity list. It reads as a stacked card on a phone and as a tidy aligned row on a
 * wide screen — no horizontal scrolling, and every field keeps its label so nothing is cryptic on
 * mobile.
 */
export function ListRow({ onClick, title, subtitle, badges, fields }: {
  onClick?: () => void
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  fields?: ListField[]
}) {
  const interactive = Boolean(onClick)
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      } : undefined}
      className={`flex items-start gap-3 px-3 py-3 sm:px-4 ${interactive ? 'cursor-pointer transition-colors hover:bg-muted/50' : ''}`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <strong className="block truncate text-sm font-medium">{title}</strong>
            {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
          </div>
          {badges ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{badges}</div> : null}
        </div>
        {fields?.length ? (
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
            {fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{field.label}</dt>
                <dd className="truncate text-xs font-medium">{field.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {interactive ? <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted-foreground" /> : null}
    </div>
  )
}

/** Shared chrome for a list screen: a sticky toolbar over a scrollable, card-framed list. */
export function ListScreen({ toolbar, error, footer, children }: { toolbar: ReactNode; error?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col">
      <div className="sticky top-14 z-20 border-b bg-card/95 backdrop-blur">
        {toolbar}
        {error ? <p className="border-t px-3 py-2 text-sm font-medium text-destructive sm:px-4">{error}</p> : null}
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">{children}</ul>
          {footer ? <div className="border-t bg-muted/20">{footer}</div> : null}
        </div>
      </div>
    </section>
  )
}

/** Server-side pager driven by the `{ items, pagination }` envelope the list endpoints return. */
export function Pager({ pagination, onPage, disabled }: { pagination: PaginationResponse | null; onPage: (page: number) => void; disabled?: boolean }) {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination ? <div className="px-3 py-2 text-xs text-muted-foreground sm:px-4">{pagination.totalItems} всего</div> : null
  }
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground sm:px-4">
      <span className="truncate">{pagination.totalItems} всего · стр. {pagination.page} из {pagination.totalPages}</span>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || !pagination.hasPreviousPage} onClick={() => onPage(pagination.page - 1)}>Назад</Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled || !pagination.hasNextPage} onClick={() => onPage(pagination.page + 1)}>Вперёд</Button>
      </div>
    </div>
  )
}
