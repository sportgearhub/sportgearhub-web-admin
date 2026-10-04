import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { getPayouts, type PaginationResponse, type PayoutSummary } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ListRow, Pager } from '../shared/ListRow'
import { FinanceList, Row, Section } from './FinancePanels'

const PAGE_SIZE = 50

export function PayoutsList() {
  const [rows, setRows] = useState<PayoutSummary[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<PayoutSummary | null>(null)

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
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={onlyFailed ? 'ghost' : 'secondary'} onClick={() => { setPage(1); setOnlyFailed(false) }}>Все</Button>
        <Button type="button" size="sm" variant={onlyFailed ? 'secondary' : 'ghost'} onClick={() => { setPage(1); setOnlyFailed(true) }}>Неуспешные</Button>
      </div>
      <Button type="button" variant="outline" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <>
      <FinanceList toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
        {loading && rows.length === 0 ? (
          <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
        ) : rows.length === 0 ? (
          <li className="py-12 text-center text-sm text-muted-foreground">Выплат нет.</li>
        ) : rows.map((item) => (
          <li key={item.payout.payoutExecutionId}>
            <ListRow
              onClick={() => setOpen(item)}
              title={formatRubles(item.payout.amount)}
              subtitle={item.seller?.displayName}
              badges={<Badge variant={item.payout.status === 'failed' ? 'destructive' : item.payout.status === 'paid' ? 'success' : 'secondary'}>{item.payout.status}</Badge>}
              fields={[
                { label: 'Бронь', value: item.bookingNumber ? `№ ${item.bookingNumber}` : '—' },
                { label: 'Создана', value: formatDateTime(item.payout.createdAt) },
                { label: 'Оплачена', value: formatDateTime(item.payout.paidAt) },
                { label: 'Реф', value: item.payout.externalPayoutRef ?? '—' },
              ]}
            />
          </li>
        ))}
      </FinanceList>

      {open ? <PayoutDetailModal item={open} onClose={() => setOpen(null)} /> : null}
    </>
  )
}

function PayoutDetailModal({ item, onClose }: { item: PayoutSummary; onClose: () => void }) {
  const { payout } = item
  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle className="truncate">Выплата {formatRubles(payout.amount)}</DialogTitle>
            <span className="block truncate text-sm text-muted-foreground">{item.seller?.displayName ?? payout.payoutExecutionId}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></Button>
        </DialogHeader>
        <DialogBody>
          <Section title="Выплата" aside={<Badge variant={payout.status === 'failed' ? 'destructive' : payout.status === 'paid' ? 'success' : 'secondary'}>{payout.status}</Badge>}>
            <dl>
              <Row label="ID выплаты" value={payout.payoutExecutionId} />
              <Row label="План расчёта" value={payout.settlementPlanId} />
              <Row label="Продавец" value={item.seller?.displayName} />
              <Row label="Бронь" value={item.bookingNumber ? `№ ${item.bookingNumber}` : item.bookingId} />
              <Row label="Расчёт" value={item.settlementStatus} />
              <Row label="Сумма" value={formatRubles(payout.amount)} />
              <Row label="Внешний реф" value={payout.externalPayoutRef} />
              <Row label="Создана" value={formatDateTime(payout.createdAt)} />
              <Row label="Отправлена" value={formatDateTime(payout.submittedAt)} />
              <Row label="Оплачена" value={formatDateTime(payout.paidAt)} />
              {payout.failedAt ? <Row label="Ошибка" value={formatDateTime(payout.failedAt)} /> : null}
            </dl>
          </Section>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
