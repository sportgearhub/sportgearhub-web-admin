import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getPayout, getPayouts, type PayoutSummary } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn, RsqlTableQuery } from '../shared/RsqlDataTable'
import { DetailScreen, Field, Panel } from '../shared/detail'

function payoutVariant(status: string) {
  return status === 'failed' ? 'destructive' : status === 'paid' ? 'success' : 'secondary'
}

const COLUMNS: Array<RsqlColumn<PayoutSummary>> = [
  { key: 'amount', label: 'Сумма', field: 'amount', align: 'right', filterable: false, width: '14%', value: (row) => row.payout.amount, render: (row) => <span className="text-sm font-medium tabular-nums">{formatRubles(row.payout.amount)}</span> },
  { key: 'status', label: 'Статус', field: 'status', filterable: false, sortable: false, width: '12%', value: (row) => row.payout.status, render: (row) => <Badge variant={payoutVariant(row.payout.status)}>{row.payout.status}</Badge> },
  { key: 'seller', label: 'Продавец', field: 'seller_id', filterable: false, sortable: false, width: '22%', value: (row) => row.seller?.displayName, render: (row) => <span className="truncate text-sm">{row.seller?.displayName ?? '—'}</span> },
  { key: 'booking', label: 'Бронь', field: 'booking_number', filterable: false, sortable: false, width: '14%', value: (row) => row.bookingNumber, render: (row) => <span className="text-sm">{row.bookingNumber ? `№ ${row.bookingNumber}` : '—'}</span> },
  { key: 'ref', label: 'Внешний реф', field: 'external_payout_ref', filterKind: 'text', sortable: false, width: '18%', value: (row) => row.payout.externalPayoutRef, render: (row) => <span className="truncate text-xs text-muted-foreground">{row.payout.externalPayoutRef ?? '—'}</span> },
  { key: 'created', label: 'Создана', field: 'created_at', filterable: false, width: '12%', value: (row) => row.payout.createdAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.payout.createdAt)}</span> },
  { key: 'paid', label: 'Оплачена', field: 'paid_at', filterable: false, width: '8%', value: (row) => row.payout.paidAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.payout.paidAt)}</span> },
]

export function PayoutsPage({ onOpen }: { onOpen: (payoutExecutionId: string) => void }) {
  const [onlyFailed, setOnlyFailed] = useState(false)
  const fetchPage = useCallback((query: RsqlTableQuery) => {
    const filter = [onlyFailed ? 'status==failed' : '', query.filter].filter(Boolean).join(';')
    return getPayouts({ ...query, filter: filter || undefined })
  }, [onlyFailed])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex gap-1 border-b px-2 py-2 sm:px-3">
        <Button type="button" size="sm" variant={onlyFailed ? 'ghost' : 'secondary'} onClick={() => setOnlyFailed(false)}>Все</Button>
        <Button type="button" size="sm" variant={onlyFailed ? 'secondary' : 'ghost'} onClick={() => setOnlyFailed(true)}>Неуспешные</Button>
      </div>
      <ServerDataTable
        columns={COLUMNS}
        getRowKey={(row) => row.payout.payoutExecutionId}
        onRowOpen={(row) => onOpen(row.payout.payoutExecutionId)}
        fetchPage={fetchPage}
        emptyText="Выплат нет."
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
        reloadKey={onlyFailed ? 'failed' : 'all'}
      />
    </section>
  )
}

export function PayoutDetailPage({ payoutExecutionId, onBack, onOpenBooking }: { payoutExecutionId: string; onBack: () => void; onOpenBooking: (bookingId: string) => void }) {
  const [item, setItem] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getPayout(payoutExecutionId)
        .then((value) => { if (mounted) { setItem(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить выплату') })
        .finally(() => { if (mounted) setLoading(false) })
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [payoutExecutionId])

  const payout = item?.payout

  return (
    <DetailScreen
      onBack={onBack}
      title={payout ? `Выплата ${formatRubles(payout.amount)}` : 'Выплата'}
      subtitle={item?.seller?.displayName}
      badges={payout ? <Badge variant={payoutVariant(payout.status)}>{payout.status}</Badge> : null}
      loading={loading}
      error={error}
      actions={item?.bookingId ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenBooking(item.bookingId!)}>Бронь</Button> : null}
    >
      {item && payout ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Выплата">
            <dl>
              <Field label="ID выплаты" value={payout.payoutExecutionId} />
              <Field label="План расчёта" value={payout.settlementPlanId} />
              <Field label="Продавец" value={item.seller?.displayName} />
              <Field label="Бронь" value={item.bookingNumber ? `№ ${item.bookingNumber}` : item.bookingId} />
              <Field label="Расчёт" value={item.settlementStatus} />
              <Field label="Сумма" value={formatRubles(payout.amount)} />
              <Field label="Внешний реф" value={payout.externalPayoutRef} />
              <Field label="Создана" value={formatDateTime(payout.createdAt)} />
              <Field label="Отправлена" value={formatDateTime(payout.submittedAt)} />
              <Field label="Оплачена" value={formatDateTime(payout.paidAt)} />
              {payout.failedAt ? <Field label="Ошибка" value={formatDateTime(payout.failedAt)} /> : null}
            </dl>
          </Panel>
        </div>
      ) : null}
    </DetailScreen>
  )
}
