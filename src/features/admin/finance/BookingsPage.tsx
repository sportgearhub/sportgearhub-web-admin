import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Search } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { getBooking, getBookings, type BookingDetail, type BookingSummary, type PaginationResponse } from '../adminApi'
import { formatDateTime, formatKopecks, formatRubles } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'
import { receiptStatusVariant } from './receiptLabels'

const PAGE_SIZE = 50

export function BookingsPage({ onOpen }: { onOpen: (bookingId: string) => void }) {
  const [rows, setRows] = useState<BookingSummary[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filter = search ? `booking_number=="*${search.replace(/"/g, '')}*"` : undefined
      const result = await getBookings({ filter, page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить брони')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const toolbar = (
    <div className="flex items-center gap-2 p-2 sm:p-3">
      <form className="relative min-w-0 flex-1 sm:max-w-sm" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(draft.trim()) }}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-8" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Номер брони" aria-label="Поиск по номеру брони" />
      </form>
      <Button type="button" variant="outline" size="icon" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Броней нет.</li>
      ) : rows.map((booking) => (
        <li key={booking.bookingId}>
          <ListRow
            onClick={() => onOpen(booking.bookingId)}
            title={`№ ${booking.bookingNumber}`}
            subtitle={booking.product?.title}
            badges={<Badge variant="secondary">{booking.status}</Badge>}
            fields={[
              { label: 'Клиент', value: booking.customer?.name ?? '—' },
              { label: 'Продавец', value: booking.seller?.displayName ?? '—' },
              { label: 'Период', value: `${formatDateTime(booking.startAt)} — ${formatDateTime(booking.endAt)}` },
              { label: 'Сумма', value: formatRubles(booking.totalChargeAmount) },
              { label: 'Оплата', value: booking.paymentStatus },
              { label: 'Расчёт', value: booking.settlementStatus },
            ]}
          />
        </li>
      ))}
    </ListScreen>
  )
}

export function BookingDetailPage({ bookingId, onBack, onOpenPayment, onOpenSeller }: {
  bookingId: string
  onBack: () => void
  onOpenPayment: (bookingId: string) => void
  onOpenSeller: (sellerId: string) => void
}) {
  const [card, setCard] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getBooking(bookingId)
        .then((value) => { if (mounted) { setCard(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить бронь') })
        .finally(() => { if (mounted) setLoading(false) })
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [bookingId])

  return (
    <DetailScreen
      onBack={onBack}
      title={card ? `Бронь № ${card.bookingNumber}` : 'Бронь'}
      subtitle={card?.product?.title}
      badges={card ? <Badge variant="secondary">{card.status}</Badge> : null}
      loading={loading}
      error={error}
      actions={card ? (
        <>
          {card.seller ? <Button type="button" size="sm" variant="outline" onClick={() => onOpenSeller(card.seller!.sellerId)}>Продавец</Button> : null}
          <Button type="button" size="sm" onClick={() => onOpenPayment(bookingId)}>Платёж и возвраты</Button>
        </>
      ) : null}
    >
      {card ? (
        <PanelGrid>
          <Panel title="Бронь">
            <dl>
              <Field label="Номер" value={card.bookingNumber} />
              <Field label="Товар" value={card.product ? `${card.product.title}${card.product.categoryTitle ? ` · ${card.product.categoryTitle}` : ''}` : '—'} />
              <Field label="Продавец" value={card.seller?.displayName} />
              <Field label="Период" value={`${formatDateTime(card.startAt)} — ${formatDateTime(card.endAt)}`} />
              <Field label="Количество" value={card.quantity} />
              {card.cancelledAt ? <Field label="Отменена" value={formatDateTime(card.cancelledAt)} /> : null}
              <Field label="Создана" value={formatDateTime(card.createdAt)} />
            </dl>
          </Panel>

          <Panel title="Клиент">
            <dl>
              <Field label="Имя" value={card.customer?.name} />
              <Field label="Почта" value={card.customer?.email} />
              <Field label="Телефон" value={card.customer?.phone} />
            </dl>
          </Panel>

          <Panel title="Деньги">
            <dl>
              <Field label="Стоимость аренды" value={formatRubles(card.totalPrice)} />
              <Field label="Предоплата услуги" value={formatRubles(card.prepaidServiceAmount)} />
              <Field label="Депозит" value={formatRubles(card.depositAmount)} />
              <Field label="Всего к списанию" value={formatRubles(card.totalChargeAmount)} />
            </dl>
          </Panel>

          <Panel title="Платёж">
            {card.payment ? (
              <dl>
                <Field label="Статус" value={<Badge variant="secondary">{card.payment.paymentStatus}</Badge>} />
                <Field label="Внешний статус" value={card.payment.externalStatus} />
                <Field label="Сумма" value={formatKopecks(card.payment.amountMinorUnits)} />
                <Field label="Оплачен" value={formatDateTime(card.payment.paidAt)} />
                {card.payment.refundedAt ? <Field label="Возвращён" value={formatDateTime(card.payment.refundedAt)} /> : null}
                {card.payment.failedAt ? <Field label="Ошибка" value={formatDateTime(card.payment.failedAt)} /> : null}
              </dl>
            ) : <p className="text-sm text-muted-foreground">Платежа ещё нет.</p>}
          </Panel>

          <Panel title="Расчёт">
            {card.settlement ? (
              <dl>
                <Field label="Статус" value={<Badge variant="secondary">{card.settlement.status}</Badge>} />
                <Field label="Исход" value={card.settlement.outcomeType} />
                <Field label="Собрано" value={formatRubles(card.settlement.grossCollectedAmount)} />
                <Field label="Выплата продавцу" value={formatRubles(card.settlement.sellerPayoutAmount)} />
                <Field label="Комиссия платформы" value={formatRubles(card.settlement.platformCommissionAmount)} />
                <Field label="Эквайринг / выплата" value={`${formatRubles(card.settlement.acquiringFeeAmount)} / ${formatRubles(card.settlement.payoutFeeAmount)}`} />
                <Field label="Чистыми платформе" value={formatRubles(card.settlement.platformNetAmount)} />
                <Field label="Исполнен" value={formatDateTime(card.settlement.executedAt)} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Плана расчёта ещё нет.</p>}
          </Panel>

          <Panel title="Исполнение">
            {card.fulfillment ? (
              <dl>
                <Field label="Выдан" value={formatDateTime(card.fulfillment.handedOverAt)} />
                <Field label="Возвращён" value={formatDateTime(card.fulfillment.returnedAt)} />
                <Field label="Завершён" value={formatDateTime(card.fulfillment.completedAt)} />
                <Field label="Проблема" value={card.fulfillment.hasIssue ? <Badge variant="destructive">Есть</Badge> : 'нет'} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Выдача ещё не начата.</p>}
          </Panel>

          <Panel title="Фискальные чеки" className="lg:col-span-2">
            {card.receipts.length ? (
              <ul className="divide-y text-sm">
                {card.receipts.map((receipt) => (
                  <li key={receipt.receiptId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <span className="font-medium">{receipt.operation}</span>
                      <span className="ml-2 text-muted-foreground">{formatRubles(receipt.total)}</span>
                      {receipt.error ? <span className="mt-0.5 block text-xs text-destructive">{receipt.error}</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      {receipt.ofdReceiptUrl ? <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={receipt.ofdReceiptUrl} target="_blank" rel="noreferrer">Чек <ExternalLink size={12} /></a> : null}
                      <Badge variant={receiptStatusVariant(receipt.status)}>{receipt.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Чеков по брони нет.</p>}
          </Panel>
        </PanelGrid>
      ) : null}
    </DetailScreen>
  )
}
