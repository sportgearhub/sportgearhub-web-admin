import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { getBooking, getBookings, type BookingDetail, type BookingSummary, type PaginationResponse } from '../adminApi'
import { formatDateTime, formatKopecks, formatRubles } from '../shared/format'
import { ListRow, Pager } from '../shared/ListRow'
import { FinanceList, Row, Section } from './FinancePanels'

const PAGE_SIZE = 50

export function BookingsList({ onOpenPayment }: { onOpenPayment: (bookingId: string) => void }) {
  const [rows, setRows] = useState<BookingSummary[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

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
    <div className="flex items-center gap-2">
      <form className="relative min-w-0 flex-1 sm:max-w-sm" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(draft.trim()) }}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-8" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Номер брони" aria-label="Поиск по номеру брони" />
      </form>
      <Button type="button" variant="outline" size="icon" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <>
      <FinanceList toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
        {loading && rows.length === 0 ? (
          <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
        ) : rows.length === 0 ? (
          <li className="py-12 text-center text-sm text-muted-foreground">Броней нет.</li>
        ) : rows.map((booking) => (
          <li key={booking.bookingId}>
            <ListRow
              onClick={() => setOpenId(booking.bookingId)}
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
      </FinanceList>

      {openId ? <BookingDetailModal bookingId={openId} onClose={() => setOpenId(null)} onOpenPayment={onOpenPayment} /> : null}
    </>
  )
}

function BookingDetailModal({ bookingId, onClose, onOpenPayment }: { bookingId: string; onClose: () => void; onOpenPayment: (bookingId: string) => void }) {
  const [card, setCard] = useState<BookingDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getBooking(bookingId)
      .then((value) => { if (mounted) { setCard(value); setError('') } })
      .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить бронь') })
    return () => { mounted = false }
  }, [bookingId])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle className="truncate">Бронь № {card?.bookingNumber ?? ''}</DialogTitle>
            <span className="block truncate text-sm text-muted-foreground">{card?.product?.title ?? bookingId}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></Button>
        </DialogHeader>
        <DialogBody className="grid gap-4 lg:grid-cols-2">
          {error ? <p className="text-sm font-medium text-destructive lg:col-span-2">{error}</p> : null}
          {card ? (
            <>
              <Section title="Бронь" aside={<Badge variant="secondary">{card.status}</Badge>}>
                <dl>
                  <Row label="Номер" value={card.bookingNumber} />
                  <Row label="Товар" value={card.product ? `${card.product.title}${card.product.categoryTitle ? ` · ${card.product.categoryTitle}` : ''}` : '—'} />
                  <Row label="Продавец" value={card.seller?.displayName} />
                  <Row label="Период" value={`${formatDateTime(card.startAt)} — ${formatDateTime(card.endAt)}`} />
                  <Row label="Количество" value={card.quantity} />
                  {card.cancelledAt ? <Row label="Отменена" value={formatDateTime(card.cancelledAt)} /> : null}
                </dl>
              </Section>

              <Section title="Клиент">
                <dl>
                  <Row label="Имя" value={card.customer?.name} />
                  <Row label="Почта" value={card.customer?.email} />
                  <Row label="Телефон" value={card.customer?.phone} />
                </dl>
              </Section>

              <Section title="Деньги">
                <dl>
                  <Row label="Стоимость аренды" value={formatRubles(card.totalPrice)} />
                  <Row label="Предоплата услуги" value={formatRubles(card.prepaidServiceAmount)} />
                  <Row label="Депозит" value={formatRubles(card.depositAmount)} />
                  <Row label="Всего к списанию" value={formatRubles(card.totalChargeAmount)} />
                </dl>
              </Section>

              <Section title="Платёж">
                {card.payment ? (
                  <dl>
                    <Row label="Статус" value={<Badge variant="secondary">{card.payment.paymentStatus}</Badge>} />
                    <Row label="Внешний статус" value={card.payment.externalStatus} />
                    <Row label="Сумма" value={formatKopecks(card.payment.amountMinorUnits)} />
                    <Row label="Оплачен" value={formatDateTime(card.payment.paidAt)} />
                    {card.payment.refundedAt ? <Row label="Возвращён" value={formatDateTime(card.payment.refundedAt)} /> : null}
                    {card.payment.failedAt ? <Row label="Ошибка" value={formatDateTime(card.payment.failedAt)} /> : null}
                  </dl>
                ) : <p className="text-sm text-muted-foreground">Платежа ещё нет.</p>}
              </Section>

              <Section title="Расчёт">
                {card.settlement ? (
                  <dl>
                    <Row label="Статус" value={<Badge variant="secondary">{card.settlement.status}</Badge>} />
                    <Row label="Исход" value={card.settlement.outcomeType} />
                    <Row label="Собрано" value={formatRubles(card.settlement.grossCollectedAmount)} />
                    <Row label="Выплата продавцу" value={formatRubles(card.settlement.sellerPayoutAmount)} />
                    <Row label="Комиссия платформы" value={formatRubles(card.settlement.platformCommissionAmount)} />
                    <Row label="Эквайринг / выплата" value={`${formatRubles(card.settlement.acquiringFeeAmount)} / ${formatRubles(card.settlement.payoutFeeAmount)}`} />
                    <Row label="Чистыми платформе" value={formatRubles(card.settlement.platformNetAmount)} />
                    <Row label="Исполнен" value={formatDateTime(card.settlement.executedAt)} />
                  </dl>
                ) : <p className="text-sm text-muted-foreground">Плана расчёта ещё нет.</p>}
              </Section>

              <Section title="Исполнение">
                {card.fulfillment ? (
                  <dl>
                    <Row label="Выдан" value={formatDateTime(card.fulfillment.handedOverAt)} />
                    <Row label="Возвращён" value={formatDateTime(card.fulfillment.returnedAt)} />
                    <Row label="Завершён" value={formatDateTime(card.fulfillment.completedAt)} />
                    <Row label="Проблема" value={card.fulfillment.hasIssue ? <Badge variant="destructive">Есть</Badge> : 'нет'} />
                  </dl>
                ) : <p className="text-sm text-muted-foreground">Выдача ещё не начата.</p>}
              </Section>
            </>
          ) : !error ? <p className="text-sm text-muted-foreground lg:col-span-2">Загружаем бронь…</p> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Закрыть</Button>
          <Button type="button" onClick={() => onOpenPayment(bookingId)}>Платёж и возвраты</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
