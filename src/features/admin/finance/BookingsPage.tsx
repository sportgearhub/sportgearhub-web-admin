import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getBooking, getBookings, type BookingDetail, type BookingSummary } from '../adminApi'
import { formatDateTime, formatKopecks, formatRubles } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn } from '../shared/RsqlDataTable'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'
import { receiptStatusVariant } from './receiptLabels'

const COLUMNS: Array<RsqlColumn<BookingSummary>> = [
  {
    key: 'booking', label: 'Бронь', field: 'booking_number', filterKind: 'text', width: '22%',
    value: (row) => row.bookingNumber,
    render: (row) => (
      <div className="min-w-0">
        <strong className="block truncate text-sm font-medium">№ {row.bookingNumber}</strong>
        <small className="block truncate text-xs text-muted-foreground">{row.product?.title ?? '—'}</small>
      </div>
    ),
  },
  { key: 'customer', label: 'Клиент', field: 'user_id', filterable: false, sortable: false, width: '15%', value: (row) => row.customer?.name, render: (row) => <span className="truncate text-sm">{row.customer?.name ?? '—'}</span> },
  { key: 'seller', label: 'Продавец', field: 'seller_id', filterable: false, sortable: false, width: '15%', value: (row) => row.seller?.displayName, render: (row) => <span className="truncate text-sm">{row.seller?.displayName ?? '—'}</span> },
  { key: 'period', label: 'Период', field: 'start_at', filterable: false, width: '18%', value: (row) => row.startAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.startAt)} — {formatDateTime(row.endAt)}</span> },
  { key: 'amount', label: 'Сумма', field: 'total_charge_amount', filterable: false, align: 'right', width: '12%', value: (row) => row.totalChargeAmount, render: (row) => <span className="text-sm tabular-nums">{formatRubles(row.totalChargeAmount)}</span> },
  { key: 'payment', label: 'Оплата', field: 'payment_status', filterable: false, sortable: false, width: '10%', value: (row) => row.paymentStatus, render: (row) => <Badge variant="secondary">{row.paymentStatus}</Badge> },
  { key: 'created', label: 'Создана', field: 'created_at', filterable: false, width: '8%', value: (row) => row.createdAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
]

export function BookingsPage({ onOpen }: { onOpen: (bookingId: string) => void }) {
  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <ServerDataTable
        columns={COLUMNS}
        getRowKey={(row) => row.bookingId}
        onRowOpen={(row) => onOpen(row.bookingId)}
        fetchPage={(query) => getBookings(query)}
        emptyText="Броней нет."
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
      />
    </section>
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
