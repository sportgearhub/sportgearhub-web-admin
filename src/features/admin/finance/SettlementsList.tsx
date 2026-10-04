import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { getSettlements, type PaginationResponse, type SettlementPlan } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ListRow, Pager } from '../shared/ListRow'
import { FinanceList, Row, Section } from './FinancePanels'

const PAGE_SIZE = 50

export function SettlementsList() {
  const [rows, setRows] = useState<SettlementPlan[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [onlyPlanned, setOnlyPlanned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<SettlementPlan | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSettlements({ filter: onlyPlanned ? 'status==planned' : undefined, page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить расчёты')
    } finally {
      setLoading(false)
    }
  }, [onlyPlanned, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const toolbar = (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={onlyPlanned ? 'ghost' : 'secondary'} onClick={() => { setPage(1); setOnlyPlanned(false) }}>Все</Button>
        <Button type="button" size="sm" variant={onlyPlanned ? 'secondary' : 'ghost'} onClick={() => { setPage(1); setOnlyPlanned(true) }}>Запланированы</Button>
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
          <li className="py-12 text-center text-sm text-muted-foreground">Расчётов нет.</li>
        ) : rows.map((plan) => (
          <li key={plan.settlementPlanId}>
            <ListRow
              onClick={() => setOpen(plan)}
              title={`${formatRubles(plan.sellerPayoutAmount)} → продавцу`}
              badges={<Badge variant="secondary">{plan.status}</Badge>}
              fields={[
                { label: 'Собрано', value: formatRubles(plan.grossCollectedAmount) },
                { label: 'Комиссия', value: formatRubles(plan.platformCommissionAmount) },
                { label: 'Выплата', value: plan.payoutExecution ? plan.payoutExecution.status : '—' },
                { label: 'Создан', value: formatDateTime(plan.createdAt) },
              ]}
            />
          </li>
        ))}
      </FinanceList>

      {open ? <SettlementDetailModal plan={open} onClose={() => setOpen(null)} /> : null}
    </>
  )
}

function SettlementDetailModal({ plan, onClose }: { plan: SettlementPlan; onClose: () => void }) {
  const snapshot = plan.recipientSnapshot
  const execution = plan.payoutExecution
  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="truncate">План расчёта</DialogTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></Button>
        </DialogHeader>
        <DialogBody className="grid gap-4 lg:grid-cols-2">
          <Section title="Расчёт" aside={<Badge variant="secondary">{plan.status}</Badge>}>
            <dl>
              <Row label="План" value={plan.settlementPlanId} />
              <Row label="Бронь" value={plan.bookingId} />
              <Row label="Исход" value={plan.outcomeType} />
              <Row label="Собрано" value={formatRubles(plan.grossCollectedAmount)} />
              <Row label="К возврату" value={formatRubles(plan.refundableAmount)} />
              <Row label="Выплата продавцу" value={formatRubles(plan.sellerPayoutAmount)} />
              <Row label="Комиссия платформы" value={formatRubles(plan.platformCommissionAmount)} />
              <Row label="Исполнен" value={formatDateTime(plan.executedAt)} />
            </dl>
          </Section>

          <Section title="Получатель">
            {snapshot ? (
              <dl>
                <Row label="Способ" value={snapshot.mode} />
                <Row label="Получатель" value={snapshot.beneficiaryName} />
                <Row label="Банк" value={snapshot.bankName ?? snapshot.displayBankName} />
                <Row label="Счёт" value={snapshot.maskedBankAccount} />
                <Row label="БИК" value={snapshot.bik} />
                <Row label="Телефон (СБП)" value={snapshot.phone} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Снимка получателя нет.</p>}
            <h3 className="mb-1 mt-4 text-sm font-semibold">Выплата</h3>
            {execution ? (
              <dl>
                <Row label="Статус" value={<Badge variant="secondary">{execution.status}</Badge>} />
                <Row label="Сумма" value={formatRubles(execution.amount)} />
                <Row label="Внешний реф" value={execution.externalPayoutRef} />
                <Row label="Оплачена" value={formatDateTime(execution.paidAt)} />
                {execution.failedAt ? <Row label="Ошибка" value={formatDateTime(execution.failedAt)} /> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">Выплата ещё не создана.</p>}
          </Section>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
