import { useCallback, useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getFiscalReceipt, getFiscalReceipts, type FiscalReceipt } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn, RsqlTableQuery } from '../shared/RsqlDataTable'
import { DetailScreen, Field, Panel } from '../shared/detail'
import { receiptStatusVariant } from './receiptLabels'

const COLUMNS: Array<RsqlColumn<FiscalReceipt>> = [
  { key: 'operation', label: 'Операция', field: 'operation', filterable: false, sortable: false, width: '24%', value: (row) => row.operation, render: (row) => <div className="min-w-0"><strong className="block truncate text-sm font-medium">{row.operation}</strong><small className="block text-xs text-muted-foreground">{formatRubles(row.total)}</small></div> },
  { key: 'status', label: 'Статус', field: 'status', filterable: false, sortable: false, width: '14%', value: (row) => row.status, render: (row) => <Badge variant={receiptStatusVariant(row.status)}>{row.status}</Badge> },
  { key: 'seller', label: 'Продавец', field: 'seller_id', filterable: false, sortable: false, width: '22%', value: (row) => row.seller?.displayName, render: (row) => <span className="truncate text-sm">{row.seller?.displayName ?? '—'}</span> },
  { key: 'booking', label: 'Бронь', field: 'booking_number', filterable: false, sortable: false, width: '12%', value: (row) => row.bookingNumber, render: (row) => <span className="text-sm">{row.bookingNumber ? `№ ${row.bookingNumber}` : '—'}</span> },
  { key: 'attempts', label: 'Попыток', field: 'attempts', filterable: false, sortable: false, align: 'right', width: '10%', value: (row) => row.attempts, render: (row) => <span className="text-sm tabular-nums">{row.attempts}</span> },
  { key: 'created', label: 'Создан', field: 'created_at', filterable: false, sortable: false, width: '18%', value: (row) => row.createdAt, render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span> },
]

export function ReceiptsPage({ onOpen }: { onOpen: (receiptId: string) => void }) {
  const [onlyFailed, setOnlyFailed] = useState(false)
  const fetchPage = useCallback((query: RsqlTableQuery) => {
    const filter = [onlyFailed ? 'status==Failed' : '', query.filter].filter(Boolean).join(';')
    return getFiscalReceipts({ ...query, filter: filter || undefined })
  }, [onlyFailed])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex gap-1 border-b px-2 py-2 sm:px-3">
        <Button type="button" size="sm" variant={onlyFailed ? 'ghost' : 'secondary'} onClick={() => setOnlyFailed(false)}>Все</Button>
        <Button type="button" size="sm" variant={onlyFailed ? 'secondary' : 'ghost'} onClick={() => setOnlyFailed(true)}>С ошибкой</Button>
      </div>
      <ServerDataTable
        columns={COLUMNS}
        getRowKey={(row) => row.receiptId}
        onRowOpen={(row) => onOpen(row.receiptId)}
        fetchPage={fetchPage}
        emptyText="Чеков нет."
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
        reloadKey={onlyFailed ? 'failed' : 'all'}
      />
    </section>
  )
}

export function ReceiptDetailPage({ receiptId, onBack, onOpenBooking }: { receiptId: string; onBack: () => void; onOpenBooking: (bookingId: string) => void }) {
  const [receipt, setReceipt] = useState<FiscalReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getFiscalReceipt(receiptId)
        .then((value) => { if (mounted) { setReceipt(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить чек') })
        .finally(() => { if (mounted) setLoading(false) })
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [receiptId])

  return (
    <DetailScreen
      onBack={onBack}
      title={receipt ? `Чек · ${receipt.operation}` : 'Чек'}
      subtitle={receipt?.seller?.displayName}
      badges={receipt ? <Badge variant={receiptStatusVariant(receipt.status)}>{receipt.status}</Badge> : null}
      loading={loading}
      error={error}
      actions={receipt ? (
        <>
          {receipt.ofdReceiptUrl ? <Button type="button" size="sm" variant="outline" asChild><a href={receipt.ofdReceiptUrl} target="_blank" rel="noreferrer">Чек ОФД <ExternalLink size={14} /></a></Button> : null}
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenBooking(receipt.bookingId)}>Бронь</Button>
        </>
      ) : null}
    >
      {receipt ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Чек">
            <dl>
              <Field label="Операция" value={receipt.operation} />
              <Field label="Сумма" value={formatRubles(receipt.total)} />
              <Field label="Бронь" value={receipt.bookingNumber ? `№ ${receipt.bookingNumber}` : receipt.bookingId} />
              <Field label="Провайдер" value={receipt.provider} />
              <Field label="Попыток" value={receipt.attempts} />
              <Field label="Создан" value={formatDateTime(receipt.createdAt)} />
              <Field label="Последняя попытка" value={formatDateTime(receipt.lastAttemptAt)} />
              <Field label="Завершён" value={formatDateTime(receipt.completedAt)} />
              {receipt.error ? <Field label="Ошибка" value={<span className="text-destructive">{receipt.error}</span>} /> : null}
            </dl>
          </Panel>

          <Panel title="Фискальные данные">
            <dl>
              <Field label="UUID" value={receipt.uuid} />
              <Field label="ФД №" value={receipt.fiscalDocumentNumber} />
              <Field label="ФП" value={receipt.fiscalSign} />
              <Field label="Внешний ID" value={receipt.externalId} />
            </dl>
            {receipt.status !== 'Done' ? <p className="mt-2 text-xs text-muted-foreground">Фискальные реквизиты появляются после успешной регистрации в ОФД.</p> : null}
          </Panel>
        </div>
      ) : null}
    </DetailScreen>
  )
}
