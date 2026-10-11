import { useCallback, useEffect, useState } from 'react'
import { Badge, type BadgeProps } from '../../../components/ui/badge'
import { getDeals, type PlatformDeal } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { BooleanBadge, RsqlDataTable, type RsqlColumn } from '../shared/RsqlDataTable'

function healthVariant(health: string): BadgeProps['variant'] {
  const value = health.toLowerCase()
  if (value.includes('ok') || value.includes('health') || value.includes('open')) return 'success'
  if (value.includes('warn') || value.includes('soon') || value.includes('closing')) return 'warning'
  if (value.includes('closed') || value.includes('expired') || value.includes('error') || value.includes('crit')) return 'destructive'
  return 'secondary'
}

const COLUMNS: Array<RsqlColumn<PlatformDeal>> = [
  { key: 'deal', label: 'Сделка банка', field: 'bankDealId', filterKind: 'text', width: '26%', value: (row) => row.bankDealId, render: (row) => <span className="truncate font-mono text-xs">{row.bankDealId}</span> },
  { key: 'status', label: 'Статус', field: 'status', filterKind: 'text', width: '14%', value: (row) => row.status, render: (row) => <Badge variant="secondary">{row.status}</Badge> },
  { key: 'health', label: 'Состояние', field: 'health', filterKind: 'text', width: '14%', value: (row) => row.health, render: (row) => <Badge variant={healthVariant(row.health)}>{row.health}</Badge> },
  { key: 'settled', label: 'Рассчитана', field: 'isSettled', filterKind: 'select', options: ['true', 'false'], width: '12%', value: (row) => row.isSettled, render: (row) => <BooleanBadge value={row.isSettled} /> },
  { key: 'closes', label: 'Закроется', field: 'closesAt', width: '18%', value: (row) => row.closesAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.closesAt)}</span> },
  { key: 'hours', label: 'До закрытия, ч', field: 'hoursUntilTheBankCloses', align: 'right', width: '16%', value: (row) => row.hoursUntilTheBankCloses, render: (row) => <span className="text-sm tabular-nums">{row.hoursUntilTheBankCloses == null ? '—' : Math.round(row.hoursUntilTheBankCloses)}</span> },
]

export function DealsPage() {
  const [rows, setRows] = useState<PlatformDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getDeals()
      .then((deals) => { setRows(deals); setError('') })
      .catch((failure: unknown) => { setRows([]); setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сделки') })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <RsqlDataTable
        rows={rows}
        columns={COLUMNS}
        getRowKey={(row) => row.bankDealId}
        emptyText="Сделок нет."
        loading={loading}
        onRefresh={load}
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={50}
      />
    </section>
  )
}
