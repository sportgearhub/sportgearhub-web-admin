import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getSettlementPlan, getSettlements, type PaginationResponse, type SettlementPlan } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'

const PAGE_SIZE = 50

export function SettlementsPage({ onOpen }: { onOpen: (settlementPlanId: string) => void }) {
  const [rows, setRows] = useState<SettlementPlan[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [onlyPlanned, setOnlyPlanned] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    <div className="flex items-center gap-2 p-2 sm:p-3">
      <div className="flex gap-1">
        <Button type="button" size="sm" variant={onlyPlanned ? 'ghost' : 'secondary'} onClick={() => { setPage(1); setOnlyPlanned(false) }}>Все</Button>
        <Button type="button" size="sm" variant={onlyPlanned ? 'secondary' : 'ghost'} onClick={() => { setPage(1); setOnlyPlanned(true) }}>Запланированы</Button>
      </div>
      <Button type="button" variant="outline" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Расчётов нет.</li>
      ) : rows.map((plan) => (
        <li key={plan.settlementPlanId}>
          <ListRow
            onClick={() => onOpen(plan.settlementPlanId)}
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
    </ListScreen>
  )
}

export function SettlementDetailPage({ settlementPlanId, onBack, onOpenBooking }: { settlementPlanId: string; onBack: () => void; onOpenBooking: (bookingId: string) => void }) {
  const [plan, setPlan] = useState<SettlementPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getSettlementPlan(settlementPlanId)
        .then((value) => { if (mounted) { setPlan(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить расчёт') })
        .finally(() => { if (mounted) setLoading(false) })
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [settlementPlanId])

  const snapshot = plan?.recipientSnapshot
  const execution = plan?.payoutExecution

  return (
    <DetailScreen
      onBack={onBack}
      title="План расчёта"
      subtitle={plan?.settlementPlanId}
      badges={plan ? <Badge variant="secondary">{plan.status}</Badge> : null}
      loading={loading}
      error={error}
      actions={plan ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenBooking(plan.bookingId)}>Бронь</Button> : null}
    >
      {plan ? (
        <PanelGrid>
          <Panel title="Расчёт">
            <dl>
              <Field label="Бронь" value={plan.bookingId} />
              <Field label="Исход" value={plan.outcomeType} />
              <Field label="Собрано" value={formatRubles(plan.grossCollectedAmount)} />
              <Field label="К возврату" value={formatRubles(plan.refundableAmount)} />
              <Field label="Выплата продавцу" value={formatRubles(plan.sellerPayoutAmount)} />
              <Field label="Комиссия платформы" value={formatRubles(plan.platformCommissionAmount)} />
              <Field label="Создан" value={formatDateTime(plan.createdAt)} />
              <Field label="Исполнен" value={formatDateTime(plan.executedAt)} />
            </dl>
          </Panel>

          <Panel title="Получатель и выплата">
            {snapshot ? (
              <dl>
                <Field label="Способ" value={snapshot.mode} />
                <Field label="Получатель" value={snapshot.beneficiaryName} />
                <Field label="Банк" value={snapshot.bankName ?? snapshot.displayBankName} />
                <Field label="Счёт" value={snapshot.maskedBankAccount} />
                <Field label="БИК" value={snapshot.bik} />
                <Field label="Телефон (СБП)" value={snapshot.phone} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Снимка получателя нет.</p>}
            <h3 className="mb-1 mt-4 text-sm font-semibold">Выплата</h3>
            {execution ? (
              <dl>
                <Field label="Статус" value={<Badge variant="secondary">{execution.status}</Badge>} />
                <Field label="Сумма" value={formatRubles(execution.amount)} />
                <Field label="Внешний реф" value={execution.externalPayoutRef} />
                <Field label="Оплачена" value={formatDateTime(execution.paidAt)} />
                {execution.failedAt ? <Field label="Ошибка" value={formatDateTime(execution.failedAt)} /> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">Выплата ещё не создана.</p>}
          </Panel>
        </PanelGrid>
      ) : null}
    </DetailScreen>
  )
}
