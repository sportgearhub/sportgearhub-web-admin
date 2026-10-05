import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getSettlementPlan, getSettlements, type SettlementPlan } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn, RsqlTableQuery } from '../shared/RsqlDataTable'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'

const COLUMNS: Array<RsqlColumn<SettlementPlan>> = [
  { key: 'payout', label: 'Продавцу', field: 'seller_payout_amount', align: 'right', filterable: false, width: '16%', value: (row) => row.sellerPayoutAmount, render: (row) => <span className="text-sm font-medium tabular-nums">{formatRubles(row.sellerPayoutAmount)}</span> },
  { key: 'status', label: 'Статус', field: 'status', filterable: false, sortable: false, width: '14%', value: (row) => row.status, render: (row) => <Badge variant="secondary">{row.status}</Badge> },
  { key: 'gross', label: 'Собрано', field: 'gross_collected_amount', align: 'right', filterable: false, width: '15%', value: (row) => row.grossCollectedAmount, render: (row) => <span className="text-sm tabular-nums">{formatRubles(row.grossCollectedAmount)}</span> },
  { key: 'commission', label: 'Комиссия', field: 'platform_commission_amount', align: 'right', filterable: false, width: '15%', value: (row) => row.platformCommissionAmount, render: (row) => <span className="text-sm tabular-nums">{formatRubles(row.platformCommissionAmount)}</span> },
  { key: 'execution', label: 'Выплата', field: 'payout_execution_id', filterable: false, sortable: false, width: '14%', value: (row) => row.payoutExecution?.status, render: (row) => row.payoutExecution ? <Badge variant="secondary">{row.payoutExecution.status}</Badge> : <span className="text-xs text-muted-foreground">нет</span> },
  { key: 'created', label: 'Создан', field: 'created_at', filterable: false, width: '14%', value: (row) => row.createdAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
]

export function SettlementsPage({ onOpen }: { onOpen: (settlementPlanId: string) => void }) {
  const [onlyPlanned, setOnlyPlanned] = useState(false)
  const fetchPage = useCallback((query: RsqlTableQuery) => {
    const filter = [onlyPlanned ? 'status==planned' : '', query.filter].filter(Boolean).join(';')
    return getSettlements({ ...query, filter: filter || undefined })
  }, [onlyPlanned])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex gap-1 border-b px-2 py-2 sm:px-3">
        <Button type="button" size="sm" variant={onlyPlanned ? 'ghost' : 'secondary'} onClick={() => setOnlyPlanned(false)}>Все</Button>
        <Button type="button" size="sm" variant={onlyPlanned ? 'secondary' : 'ghost'} onClick={() => setOnlyPlanned(true)}>Запланированы</Button>
      </div>
      <ServerDataTable
        columns={COLUMNS}
        getRowKey={(row) => row.settlementPlanId}
        onRowOpen={(row) => onOpen(row.settlementPlanId)}
        fetchPage={fetchPage}
        emptyText="Расчётов нет."
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
        reloadKey={onlyPlanned ? 'planned' : 'all'}
      />
    </section>
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
