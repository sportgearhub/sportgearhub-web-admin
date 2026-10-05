import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { useNotifications } from '../../../components/ui/notifications-context'
import {
  getBookingPayment,
  getLedgerForPayment,
  getPayment,
  getPaymentRefundCase,
  getPaymentStatus,
  getSettlementPlan,
  postBookingPayout,
  postPaymentCancel,
  postPaymentRefund,
  postPaymentRefundReviewSettlementImpact,
  postPaymentSync,
  type InternalPaymentDetail,
  type InternalRefundCase,
  type LedgerView,
  type PaymentStatus,
  type RefundCommand,
  type SettlementPlan,
} from '../adminApi'
import { formatDateTime, formatKopecks, formatRubles } from '../shared/format'
import { Field, Panel } from '../shared/detail'

type Lookup = 'payment' | 'booking'

type Loaded = {
  detail: InternalPaymentDetail
  status: PaymentStatus | null
  refund: InternalRefundCase | null
  settlement: SettlementPlan | null
  ledger: LedgerView | null
}

/**
 * The by-id window onto the money: read the acquirer's facts and the ledger, and run the guarded
 * write actions — sync, cancel, refund (impact first), and a manual payout. `seedBookingId` lets the
 * booking detail hand a booking straight in.
 */
export function PaymentLookup({ seedBookingId }: { seedBookingId?: string }) {
  const { notify } = useNotifications()
  const [lookup, setLookup] = useState<Lookup>('payment')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmPayout, setConfirmPayout] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  async function loadByPaymentId(paymentId: string): Promise<Loaded> {
    return hydrate(await getPayment(paymentId), paymentId)
  }

  async function loadByBookingId(bookingId: string): Promise<Loaded> {
    const detail = await getBookingPayment(bookingId)
    return hydrate(detail, detail.paymentIntentId)
  }

  async function hydrate(detail: InternalPaymentDetail, paymentId: string): Promise<Loaded> {
    const [status, refund, ledger, settlement] = await Promise.all([
      getPaymentStatus(paymentId).catch(() => null),
      getPaymentRefundCase(paymentId).catch(() => null),
      getLedgerForPayment(paymentId).catch(() => null),
      detail.settlementPlanId ? getSettlementPlan(detail.settlementPlanId).catch(() => null) : Promise.resolve(null),
    ])
    return { detail, status, refund, ledger, settlement }
  }

  async function runWith(nextLookup: Lookup, nextValue: string) {
    const trimmed = nextValue.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      setData(await (nextLookup === 'payment' ? loadByPaymentId(trimmed) : loadByBookingId(trimmed)))
    } catch (failure) {
      setData(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!seedBookingId) return
    const timer = window.setTimeout(() => {
      setLookup('booking')
      setValue(seedBookingId)
      void runWith('booking', seedBookingId)
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedBookingId])

  async function reload() {
    if (!data) return
    try {
      setData(await hydrate(await getPayment(data.detail.paymentIntentId), data.detail.paymentIntentId))
    } catch {
      // keep what we have; the action already reported its own failure
    }
  }

  async function act(label: string, work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      notify({ tone: 'success', title: label })
      await reload()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось выполнить', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const detail = data?.detail
  const paymentId = detail?.paymentIntentId ?? ''

  return (
    <section className="min-h-[calc(100dvh-3.5rem)]">
      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b bg-card/95 px-2 py-2 backdrop-blur sm:px-4">
        <Select
          className="w-[140px]"
          value={lookup}
          onValueChange={(next) => setLookup(next as Lookup)}
          options={[{ value: 'payment', label: 'ID платежа' }, { value: 'booking', label: 'ID брони' }]}
        />
        <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); void runWith(lookup, value) }}>
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-8" value={value} onChange={(event) => setValue(event.target.value)} placeholder={lookup === 'payment' ? 'payment id' : 'booking id'} aria-label="Идентификатор" />
          </div>
          <Button type="submit" disabled={loading || !value.trim()}>{loading ? 'Ищем…' : 'Открыть'}</Button>
        </form>
      </div>

      {error ? <p className="px-4 py-3 text-sm font-medium text-destructive">{error}</p> : null}

      {!detail && !error ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">Введите идентификатор платежа или брони, чтобы увидеть оплату, возвраты и проводки.</p>
      ) : null}

      {detail && data ? (
        <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-2 lg:p-6">
          <Panel
            title="Платёж"
            aside={
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void act('Статус обновлён', () => postPaymentSync(paymentId))}>Синхронизировать</Button>
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>Отменить</Button>
              </div>
            }
          >
            <dl>
              <Field label="ID платежа" value={detail.paymentIntentId} />
              <Field label="Бронь" value={detail.bookingId} />
              <Field label="Сбор" value={<Badge variant="secondary">{detail.collectionStatus}</Badge>} />
              <Field label="Возврат" value={<Badge variant="secondary">{detail.refundStatus}</Badge>} />
              <Field label="Расчёт" value={<Badge variant="secondary">{detail.settlementStatus}</Badge>} />
              <Field label="Всего к списанию" value={formatRubles(detail.totalChargeAmount)} />
              <Field label="Предоплата услуги" value={formatRubles(detail.prepaidServiceAmount)} />
              <Field label="Депозит" value={formatRubles(detail.depositAmount)} />
              <Field label="Обновлён" value={formatDateTime(detail.updatedAt)} />
            </dl>
          </Panel>

          <Panel title="Статус у эквайера">
            {data.status ? (
              <dl>
                <Field label="Провайдер" value={data.status.providerCode} />
                <Field label="Метод" value={data.status.paymentMethod} />
                <Field label="Статус" value={<Badge variant="secondary">{data.status.paymentStatus}</Badge>} />
                <Field label="Внешний статус" value={data.status.externalStatus} />
                <Field label="Сумма" value={formatKopecks(data.status.amountMinorUnits)} />
                <Field label="Возвращено" value={formatKopecks(data.status.refundedAmountMinorUnits)} />
                <Field label="Оплачен" value={formatDateTime(data.status.paidAt)} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Статус недоступен.</p>}
            <p className="mt-2 text-xs text-muted-foreground">AUTHORIZED — ещё не оплата. CONFIRMED списывается без отдельного шага.</p>
          </Panel>

          <Panel title="Возвраты" aside={<Button type="button" size="sm" disabled={busy} onClick={() => setRefundOpen(true)}>Оформить возврат</Button>}>
            {data.refund ? (
              <dl>
                <Field label="Статус" value={<Badge variant="secondary">{data.refund.refundStatus}</Badge>} />
                <Field label="Собрано" value={formatKopecks(data.refund.collectedAmountMinorUnits)} />
                <Field label="Возвращено" value={formatKopecks(data.refund.refundedAmountMinorUnits)} />
                <Field label="Осталось к возврату" value={formatKopecks(data.refund.remainingRefundableAmountMinorUnits)} />
                {data.refund.settlementImpactReviewRequired ? <Field label="Влияние на выплату" value={<Badge variant="warning">Требует проверки</Badge>} /> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">По этому платежу возвратов нет.</p>}
            <p className="mt-2 text-xs text-muted-foreground">Возврат по уже выплаченной брони создаёт долг — его никто не вернёт автоматически.</p>
          </Panel>

          <Panel title="Расчёт и выплата" aside={<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmPayout(true)}>Выплатить вручную</Button>}>
            {data.settlement ? (
              <dl>
                <Field label="План расчёта" value={data.settlement.settlementPlanId} />
                <Field label="Статус" value={<Badge variant="secondary">{data.settlement.status}</Badge>} />
                <Field label="Собрано" value={formatRubles(data.settlement.grossCollectedAmount)} />
                <Field label="К выплате продавцу" value={formatRubles(data.settlement.sellerPayoutAmount)} />
                <Field label="Комиссия платформы" value={formatRubles(data.settlement.platformCommissionAmount)} />
                <Field label="Выплата" value={data.settlement.payoutExecution ? <Badge variant="secondary">{data.settlement.payoutExecution.status}</Badge> : 'нет'} />
                <Field label="Исполнена" value={formatDateTime(data.settlement.executedAt)} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Плана расчёта ещё нет.</p>}
          </Panel>

          <div className="lg:col-span-2">
            <Panel title="Книга проводок" aside={data.ledger ? <Badge variant={data.ledger.status.hasMissingFacts ? 'warning' : 'success'}>{data.ledger.status.hasMissingFacts ? 'Есть пробелы' : data.ledger.status.status}</Badge> : undefined}>
              {data.ledger && data.ledger.entries.length ? (
                <TableFrame className="rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Проводка</TableHead>
                        <TableHead>Направление</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Когда</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ledger.entries.map((entry) => (
                        <TableRow key={entry.ledgerEntryId}>
                          <TableCell className="text-sm">{entry.entryType}</TableCell>
                          <TableCell className="text-sm">{entry.direction}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">{formatRubles(entry.amount)}</TableCell>
                          <TableCell className="text-sm">{entry.status}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.sourceAuthority}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableFrame>
              ) : <p className="text-sm text-muted-foreground">Проводок нет.</p>}
            </Panel>
          </div>
        </div>
      ) : null}

      {confirmCancel ? (
        <ConfirmDialog
          title="Отменить платёж"
          body="Платёж будет отменён у эквайера. Действие необратимо."
          confirmLabel="Отменить платёж"
          destructive
          busy={busy}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={async () => { setConfirmCancel(false); await act('Платёж отменён', () => postPaymentCancel(paymentId)) }}
        />
      ) : null}

      {confirmPayout && detail ? (
        <ConfirmDialog
          title="Выплатить бронь вручную"
          body="Запустит выплату по брони, если её пропустил планировщик. После — проверьте книгу проводок."
          confirmLabel="Выплатить"
          busy={busy}
          onCancel={() => setConfirmPayout(false)}
          onConfirm={async () => { setConfirmPayout(false); await act('Выплата запущена', () => postBookingPayout(detail.bookingId)) }}
        />
      ) : null}

      {refundOpen && detail ? (
        <RefundDialog
          paymentId={paymentId}
          busy={busy}
          onClose={() => setRefundOpen(false)}
          onDone={async () => { setRefundOpen(false); await reload() }}
          runReview={(reasonCode) => postPaymentRefundReviewSettlementImpact(paymentId, { reasonCode })}
          runRefund={(amountMinorUnits, reasonCode) => act('Возврат оформлен', () => postPaymentRefund(paymentId, { amountMinorUnits, reasonCode }))}
        />
      ) : null}
    </section>
  )
}

function ConfirmDialog({ title, body, confirmLabel, destructive, busy, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; destructive?: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody><p className="text-sm text-muted-foreground">{body}</p></DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Отмена</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A refund shows its settlement impact before it fires; amount is roubles in, kopecks out. */
function RefundDialog({ paymentId, busy, onClose, onDone, runReview, runRefund }: {
  paymentId: string
  busy: boolean
  onClose: () => void
  onDone: () => Promise<void>
  runReview: (reasonCode: string) => Promise<RefundCommand>
  runRefund: (amountMinorUnits: number | undefined, reasonCode: string) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [impact, setImpact] = useState<RefundCommand | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const amountMinorUnits = amount.trim() ? Math.round(Number(amount.replace(',', '.')) * 100) : undefined
  const amountValid = amount.trim() === '' || (Number.isFinite(amountMinorUnits) && (amountMinorUnits ?? 0) > 0)

  async function review() {
    setReviewing(true)
    setReviewError('')
    try {
      setImpact(await runReview(reason.trim()))
    } catch (failure) {
      setReviewError(failure instanceof Error ? failure.message : 'Не удалось оценить влияние')
    } finally {
      setReviewing(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Возврат по платежу</DialogTitle></DialogHeader>
        <DialogBody className="grid gap-3">
          <p className="text-xs text-muted-foreground">Платёж {paymentId}. Пусто = полный возврат.</p>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Сумма, ₽</span>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="весь остаток" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Причина (reason_code)</span>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="seller_cancelled" />
          </label>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Влияние на расчёт</span>
              <Button type="button" size="sm" variant="outline" disabled={reviewing} onClick={() => void review()}>{reviewing ? 'Считаем…' : 'Оценить'}</Button>
            </div>
            {reviewError ? <p className="mt-2 text-destructive">{reviewError}</p> : null}
            {impact ? (
              <dl className="mt-2 grid gap-1 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Результат</dt><dd>{impact.result.status}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Осталось к возврату</dt><dd>{formatKopecks(impact.refundCase.remainingRefundableAmountMinorUnits)}</dd></div>
                {impact.refundCase.snapshot ? (
                  <>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Выплата продавцу</dt><dd>{formatRubles(impact.refundCase.snapshot.sellerPayoutAmount)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Комиссия платформы</dt><dd>{formatRubles(impact.refundCase.snapshot.platformCommissionAmount)}</dd></div>
                  </>
                ) : null}
              </dl>
            ) : <p className="mt-2 text-xs text-muted-foreground">Оцените влияние на выплату, прежде чем возвращать деньги.</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button type="button" variant="destructive" disabled={busy || !amountValid} onClick={async () => { await runRefund(amountMinorUnits, reason.trim()); await onDone() }}>Вернуть деньги</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
