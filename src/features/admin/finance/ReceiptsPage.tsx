import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getFiscalReceipt, getFiscalReceipts, type FiscalReceipt, type PaginationResponse } from '../adminApi'
import { formatDateTime, formatRubles } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'
import { DetailScreen, Field, Panel } from '../shared/detail'
import { receiptStatusVariant } from './receiptLabels'

const PAGE_SIZE = 50

export function ReceiptsPage({ onOpen }: { onOpen: (receiptId: string) => void }) {
  const [rows, setRows] = useState<FiscalReceipt[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getFiscalReceipts({ filter: onlyFailed ? 'status==Failed' : undefined, page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить чеки')
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
        <Button type="button" size="sm" variant={onlyFailed ? 'secondary' : 'ghost'} onClick={() => { setPage(1); setOnlyFailed(true) }}>С ошибкой</Button>
      </div>
      <Button type="button" variant="outline" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Чеков нет.</li>
      ) : rows.map((receipt) => (
        <li key={receipt.receiptId}>
          <ListRow
            onClick={() => onOpen(receipt.receiptId)}
            title={`${receipt.operation} · ${formatRubles(receipt.total)}`}
            subtitle={receipt.seller?.displayName}
            badges={<Badge variant={receiptStatusVariant(receipt.status)}>{receipt.status}</Badge>}
            fields={[
              { label: 'Бронь', value: receipt.bookingNumber ? `№ ${receipt.bookingNumber}` : '—' },
              { label: 'Попыток', value: receipt.attempts },
              { label: 'Создан', value: formatDateTime(receipt.createdAt) },
              { label: 'Ошибка', value: receipt.error ?? '—' },
            ]}
          />
        </li>
      ))}
    </ListScreen>
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
