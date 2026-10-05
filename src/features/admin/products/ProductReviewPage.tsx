import { useCallback, useMemo, useState } from 'react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { getProductReviewQueue, type ProductReviewQueueItem, type ProductStatus } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn, RsqlTableQuery } from '../shared/RsqlDataTable'
import { productStatusLabel, productStatusVariant } from './productLabels'

const TABS: Array<{ status: ProductStatus; label: string }> = [
  { status: 'pending_review', label: 'На проверке' },
  { status: 'changes_requested', label: 'Нужны изменения' },
  { status: 'rejected', label: 'Отклонённые' },
  { status: 'active', label: 'Активные' },
]

const COLUMNS: Array<RsqlColumn<ProductReviewQueueItem>> = [
  {
    key: 'title', label: 'Карточка', field: 'title', filterKind: 'text', width: '42%',
    value: (row) => row.title,
    render: (row) => (
      <div className="min-w-0">
        <strong className="block truncate text-sm font-medium">{row.title}</strong>
        <small className="block truncate text-xs text-muted-foreground">{row.productId}</small>
      </div>
    ),
  },
  {
    key: 'seller', label: 'Продавец', field: 'seller_id', filterable: false, sortable: false, width: '28%',
    value: (row) => row.sellerDisplayName,
    render: (row) => <span className="text-sm">{row.sellerDisplayName}</span>,
  },
  {
    key: 'status', label: 'Статус', field: 'status', filterable: false, sortable: false, width: '16%',
    value: (row) => row.status,
    render: (row) => <Badge variant={productStatusVariant(row.status)}>{productStatusLabel(row.status)}</Badge>,
  },
  {
    key: 'submitted', label: 'Подана', field: 'created_at', filterable: false, width: '14%',
    value: (row) => row.submittedAt,
    render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.submittedAt)}</span>,
  },
]

export function ProductReviewPage({ onOpen }: { onOpen: (productId: string) => void }) {
  const [status, setStatus] = useState<ProductStatus>('pending_review')
  const fetchPage = useCallback((query: RsqlTableQuery) => getProductReviewQueue(status, query), [status])
  const columns = useMemo(() => COLUMNS, [])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b px-2 py-2 sm:px-3" role="tablist">
        {TABS.map((tab) => (
          <Button key={tab.status} type="button" size="sm" variant={status === tab.status ? 'secondary' : 'ghost'} role="tab" aria-selected={status === tab.status} onClick={() => setStatus(tab.status)} className="shrink-0">
            {tab.label}
          </Button>
        ))}
      </div>
      <ServerDataTable
        columns={columns}
        getRowKey={(row) => row.productId}
        onRowOpen={(row) => onOpen(row.productId)}
        fetchPage={fetchPage}
        emptyText="Карточек нет."
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
        reloadKey={status}
      />
    </section>
  )
}
