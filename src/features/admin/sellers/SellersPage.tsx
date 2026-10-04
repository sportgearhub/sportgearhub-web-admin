import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { getSellers, rsqlStatus, type PaginationResponse, type SellerListItem, type SellerStatus } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { ListRow, ListScreen, Pager } from '../shared/ListRow'

const PAGE_SIZE = 50
import { sellerKindLabel, sellerStatusLabel, sellerStatusVariant } from './sellerLabels'

const ONBOARDING_TABS: Array<{ status: SellerStatus; label: string }> = [
  { status: 'pending_review', label: 'На проверке' },
  { status: 'changes_requested', label: 'Нужны изменения' },
  { status: 'rejected', label: 'Отклонённые' },
]

const ALL_TABS: Array<{ status: SellerStatus | ''; label: string }> = [
  { status: '', label: 'Все' },
  { status: 'active', label: 'Активные' },
  { status: 'draft', label: 'Черновики' },
  { status: 'suspended', label: 'Приостановленные' },
]

type SellersPageProps = {
  /** «Заявки» shows the statuses a reviewer acts on; «Продавцы» shows everyone. */
  mode: 'onboarding' | 'all'
  onOpenSeller: (sellerId: string) => void
}

export function SellersPage({ mode, onOpenSeller }: SellersPageProps) {
  const [status, setStatus] = useState<SellerStatus | ''>(mode === 'onboarding' ? 'pending_review' : '')
  const [rows, setRows] = useState<SellerListItem[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tabs = mode === 'onboarding' ? ONBOARDING_TABS : ALL_TABS

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSellers({ filter: status ? rsqlStatus(status) : undefined, page, pageSize: PAGE_SIZE })
      setRows(result.items)
      setPagination(result.pagination)
      setError('')
    } catch (failure) {
      setRows([])
      setPagination(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить продавцов')
    } finally {
      setLoading(false)
    }
  }, [status, page])

  function selectStatus(next: SellerStatus | '') {
    setStatus(next)
    setPage(1)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => [row.displayName, row.legalName, row.inn, row.sellerId].some((value) => value?.toLowerCase().includes(needle)))
  }, [rows, query])

  const toolbar = (
    <div className="flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-center sm:p-3">
      <div className="no-scrollbar -mx-2 flex gap-1 overflow-x-auto px-2 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((tab) => (
          <Button key={tab.label} type="button" size="sm" variant={status === tab.status ? 'secondary' : 'ghost'} role="tab" aria-selected={status === tab.status} onClick={() => selectStatus(tab.status)} className="shrink-0">
            {tab.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <div className="relative flex-1 sm:w-64 sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, ИНН, юрлицо" aria-label="Поиск" />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void load()} aria-label="Обновить" title="Обновить">
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
        </Button>
      </div>
    </div>
  )

  return (
    <ListScreen toolbar={toolbar} error={error} footer={<Pager pagination={pagination} onPage={setPage} disabled={loading} />}>
      {loading && rows.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">Загружаем…</li>
      ) : visible.length === 0 ? (
        <li className="py-12 text-center text-sm text-muted-foreground">{mode === 'onboarding' ? 'Заявок нет.' : 'Продавцов нет.'}</li>
      ) : visible.map((row) => (
        <li key={row.sellerId}>
          <ListRow
            onClick={() => onOpenSeller(row.sellerId)}
            title={row.displayName}
            badges={
              <>
                <Badge variant={sellerStatusVariant(row.status)}>{sellerStatusLabel(row.status)}</Badge>
                <Badge variant={row.canBePaid ? 'success' : row.payoutRegistered ? 'info' : row.payoutDetailsPresent ? 'warning' : 'secondary'}>
                  {row.canBePaid ? 'Выплаты готовы' : row.payoutRegistered ? 'В банке' : row.payoutDetailsPresent ? 'Ждут банк' : 'Нет выплат'}
                </Badge>
              </>
            }
            fields={[
              { label: 'Форма', value: sellerKindLabel(row.sellerKind) },
              { label: 'Юрлицо · ИНН', value: `${row.legalName ?? '—'}${row.inn ? ` · ${row.inn}` : ''}` },
              { label: 'Договор', value: row.agreementNumber ? `№ ${row.agreementNumber}` : '—' },
              { label: mode === 'onboarding' ? 'Ждёт с' : 'Обновлён', value: formatDateTime(row.reviewOpenedAt ?? row.updatedAt) },
            ]}
          />
        </li>
      ))}
    </ListScreen>
  )
}
