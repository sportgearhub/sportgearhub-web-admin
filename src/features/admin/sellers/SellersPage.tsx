import { useCallback, useMemo } from 'react'
import { Badge } from '../../../components/ui/badge'
import { getSellers, type SellerListItem } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { ServerDataTable } from '../shared/ServerDataTable'
import type { RsqlColumn, RsqlTableQuery } from '../shared/RsqlDataTable'
import { sellerKindLabel, sellerStatusLabel, sellerStatusVariant } from './sellerLabels'

const ALL_STATUSES = ['draft', 'pending_review', 'changes_requested', 'rejected', 'active', 'suspended', 'archived']
const REVIEW_FILTER = 'status=in=(pending_review,changes_requested,rejected)'

function buildColumns(mode: 'onboarding' | 'all'): Array<RsqlColumn<SellerListItem>> {
  return [
    {
      key: 'seller', label: 'Кабинет', field: 'display_name', filterKind: 'text', width: '26%',
      value: (row) => row.displayName,
      render: (row) => (
        <div className="min-w-0">
          <strong className="block truncate text-sm font-medium">{row.displayName}</strong>
          <small className="block truncate text-xs text-muted-foreground">{row.sellerId}</small>
        </div>
      ),
    },
    {
      key: 'status', label: 'Статус', field: 'status', width: '13%',
      filterKind: 'select', options: ALL_STATUSES, filterable: mode === 'all',
      value: (row) => row.status,
      render: (row) => <Badge variant={sellerStatusVariant(row.status)}>{sellerStatusLabel(row.status)}</Badge>,
    },
    {
      key: 'kind', label: 'Форма', field: 'seller_kind', width: '11%', filterable: false, sortable: false,
      value: (row) => row.sellerKind,
      render: (row) => <span className="text-sm">{sellerKindLabel(row.sellerKind)}</span>,
    },
    {
      key: 'legal', label: 'Юрлицо · ИНН', field: 'legal_name', filterKind: 'text', width: '22%',
      value: (row) => row.legalName,
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm">{row.legalName ?? '—'}</span>
          <small className="block text-xs text-muted-foreground">{row.inn ?? 'ИНН не указан'}</small>
        </div>
      ),
    },
    {
      key: 'payout', label: 'Выплаты', field: 'can_be_paid', width: '12%', filterable: false, sortable: false,
      value: (row) => row.canBePaid,
      render: (row) => (
        <Badge variant={row.canBePaid ? 'success' : row.payoutRegistered ? 'info' : row.payoutDetailsPresent ? 'warning' : 'secondary'}>
          {row.canBePaid ? 'Готовы' : row.payoutRegistered ? 'В банке' : row.payoutDetailsPresent ? 'Ждут банк' : 'Нет'}
        </Badge>
      ),
    },
    {
      key: 'updated', label: 'Обновлён', field: 'updated_at', width: '16%', filterable: false,
      value: (row) => row.updatedAt,
      render: (row) => <span className="text-xs text-muted-foreground">{formatDateTime(row.reviewOpenedAt ?? row.updatedAt)}</span>,
    },
  ]
}

export function SellersPage({ mode, onOpenSeller }: { mode: 'onboarding' | 'all'; onOpenSeller: (sellerId: string) => void }) {
  const columns = useMemo(() => buildColumns(mode), [mode])
  const fetchPage = useCallback((query: RsqlTableQuery) => {
    const filter = [mode === 'onboarding' ? REVIEW_FILTER : '', query.filter].filter(Boolean).join(';')
    return getSellers({ ...query, filter: filter || undefined })
  }, [mode])

  return (
    <section className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      <ServerDataTable
        columns={columns}
        getRowKey={(row) => row.sellerId}
        onRowOpen={(row) => onOpenSeller(row.sellerId)}
        fetchPage={fetchPage}
        emptyText={mode === 'onboarding' ? 'Заявок нет.' : 'Продавцов нет.'}
        pageSizeOptions={[20, 50, 100]}
        initialPageSize={20}
        reloadKey={mode}
      />
    </section>
  )
}
