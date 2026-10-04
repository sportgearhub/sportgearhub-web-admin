import type { ReactNode } from 'react'

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2 text-sm last:border-b-0 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value ?? '—'}</dd>
    </div>
  )
}

/** Toolbar over a card-framed list with an optional pager footer; used by the finance list tabs. */
export function FinanceList({ toolbar, error, footer, children }: { toolbar?: ReactNode; error?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3 p-3 sm:p-4">
      {toolbar}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ul className="divide-y">{children}</ul>
        {footer ? <div className="border-t bg-muted/20">{footer}</div> : null}
      </div>
    </div>
  )
}
