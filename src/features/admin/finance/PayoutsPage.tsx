import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getPayout, getPayouts, type PaginationResponse, type PayoutSummary } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'
import { DetailScreen, Field, Panel } from '../shared/detail'

const PAGE_SIZE = 50

function payoutVariant(status: string) {
  return status === 'failed' ? 'destructive' : status === 'paid' ? 'success' : 'secondary'
}

export function PayoutsPage({ onOpen }: { onOpen: (payoutExecutionId: string) => void }) {
  const [rows, setRows] = useState<PayoutSummary[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getPayouts({ filter: onlyFailed ? 'status==failed' : undefined, page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить выплаты')
    } finally {
      setLoading(false)
    }
  }, [onlyFailed, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const toolbar = (
    <div className="flex items-center gap-2 p-2 sm:p-3">
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={onlyFailed ? 'ghost' : 'secondary'} onClick={() => { setPage(1); setOnlyFailed(false) }}>Все</Button>
        <Button type="button" size="sm" variant={onlyFailed ? 'secondary' : 'ghost'} onClick={() => { setPage(1); setOnlyFailed(true) }}>Неуспешные</Button>
      </div>
      <Button type="button" variant="outline" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Выплат нет.</li>
      ) : rows.map((item) => (
        <li key={item.payout.payoutExecutionId}>
          <ListRow
            onClick={() => onOpen(item.payout.payoutExecutionId)}
            title={formatRubles(item.payout.amount)}
            subtitle={item.seller?.displayName}
            badges={<Badge variant={payoutVariant(item.payout.status)}>{item.payout.status}</Badge>}
            fields={[
              { label: 'Бронь', value: item.bookingNumber ? `№ ${item.bookingNumber}` : '—' },
              { label: 'Создана', value: formatDateTime(item.payout.createdAt) },
              { label: 'Оплачена', value: formatDateTime(item.payout.paidAt) },
              { label: 'Реф', value: item.payout.externalPayoutRef ?? '—' },
            ]}
          />
        </li>
      ))}
    </ListScreen>
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
