import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getProductReviewQueue, type PaginationResponse, type ProductReviewQueueItem, type ProductStatus } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'
import { productStatusLabel, productStatusVariant } from './productLabels'

const PAGE_SIZE = 50

const TABS: Array<{ status: ProductStatus; label: string }> = [
  { status: 'pending_review', label: 'На проверке' },
  { status: 'changes_requested', label: 'Нужны изменения' },
  { status: 'rejected', label: 'Отклонённые' },
  { status: 'active', label: 'Активные' },
]

export function ProductReviewPage({ onOpen }: { onOpen: (productId: string) => void }) {
  const [status, setStatus] = useState<ProductStatus>('pending_review')
  const [rows, setRows] = useState<ProductReviewQueueItem[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getProductReviewQueue(status, { page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить очередь')
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function selectStatus(next: ProductStatus) {
    setStatus(next)
    setPage(1)
  }

  const toolbar = (
    <div className="flex items-center gap-2 p-2 sm:p-3">
      <div className="no-scrollbar -mx-2 flex flex-1 gap-1 overflow-x-auto px-2 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((tab) => (
          <Button key={tab.status} type="button" size="sm" variant={status === tab.status ? 'secondary' : 'ghost'} role="tab" aria-selected={status === tab.status} onClick={() => selectStatus(tab.status)} className="shrink-0">
            {tab.label}
          </Button>
        ))}
      </div>
      <Button type="button" variant="outline" size="icon" onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Карточек нет.</li>
      ) : rows.map((row) => (
        <li key={row.productId}>
          <ListRow
            onClick={() => onOpen(row.productId)}
            title={row.title}
            badges={<Badge variant={productStatusVariant(row.status)}>{productStatusLabel(row.status)}</Badge>}
            fields={[
              { label: 'Продавец', value: row.sellerDisplayName },
              { label: 'Подана', value: formatDateTime(row.submittedAt) },
            ]}
          />
        </li>
      ))}
    </ListScreen>
  )
}
