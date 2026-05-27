import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Filter,
  LayoutGrid,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Badge, type BadgeProps } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import type { OnboardingApplication, OnboardingViewMode, Severity } from '../../types/admin'
import {
  getProviderOnboarding,
  getProviderOnboardingOptions,
  getProviderOnboardingQueue,
  postProviderOnboardingAction,
  type PaginationResponse,
  type ProviderOnboardingAction,
  type ProviderOnboardingFilterFieldResponse,
  type ProviderOnboardingListOptionsResponse,
  type ProviderOnboardingResponse,
  type ProviderOnboardingSortFieldResponse,
  type ProviderOnboardingSummaryResponse,
} from './adminApi'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REVIEW_ACTIONS: Array<{ code: ProviderOnboardingAction; label: string; tone?: 'danger' }> = [
  { code: 'approve', label: 'Одобрить' },
  { code: 'request_changes', label: 'Запросить изменения' },
  { code: 'reject', label: 'Отклонить', tone: 'danger' },
]
const ICON_SIZE = 16
const DEFAULT_PAGINATION: PaginationResponse = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

type SortDirection = 'asc' | 'desc' | ''
type OnboardingColumnKey = 'displayName' | 'legalName' | 'taxNumber' | 'status' | 'submittedAt'
type FlyoutPosition = { top: number; left: number }
type ColumnConfig = {
  key: OnboardingColumnKey
  label: string
  field: string
  filterKind: 'text' | 'status' | 'date'
  filterField?: ProviderOnboardingFilterFieldResponse
  sortField?: ProviderOnboardingSortFieldResponse
}
type ColumnState = Record<OnboardingColumnKey, { filter: string; sort: SortDirection }>

const COLUMNS: ColumnConfig[] = [
  { key: 'displayName', label: 'Профиль', field: 'displayName', filterKind: 'text' },
  { key: 'legalName', label: 'Юрлицо', field: 'legalName', filterKind: 'text' },
  { key: 'taxNumber', label: 'ИНН', field: 'taxNumber', filterKind: 'text' },
  { key: 'status', label: 'Статус', field: 'status', filterKind: 'status' },
  { key: 'submittedAt', label: 'Подано', field: 'submittedAt', filterKind: 'date' },
]
const EMPTY_COLUMN_STATE = COLUMNS.reduce((state, column) => {
  state[column.key] = { filter: '', sort: '' }
  return state
}, {} as ColumnState)

function formatDate(value?: string | null) {
  if (!value) {
    return 'не указано'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeRsqlValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getStatusSeverity(status: string): Severity {
  const normalizedStatus = status.toLowerCase()

  if (normalizedStatus.includes('reject') || normalizedStatus.includes('block') || normalizedStatus.includes('error')) {
    return 'critical'
  }

  if (normalizedStatus.includes('approve') || normalizedStatus.includes('ready') || normalizedStatus.includes('active')) {
    return 'ok'
  }

  if (normalizedStatus.includes('submit') || normalizedStatus.includes('review') || normalizedStatus.includes('change')) {
    return 'warning'
  }

  return 'info'
}

function isReadyChecklistStatus(status?: number) {
  return status === 1
}

function buildFilterExpression(columnState: ColumnState) {
  return COLUMNS.flatMap((column) => {
    const value = columnState[column.key].filter.trim()

    if (!value) {
      return []
    }

    if (column.filterKind === 'text') {
      return `${column.field}=="*${escapeRsqlValue(value)}*"`
    }

    return `${column.field}=="${escapeRsqlValue(value)}"`
  }).join(';')
}

function buildSortExpression(columnState: ColumnState) {
  return COLUMNS.flatMap((column) => {
    const direction = columnState[column.key].sort

    if (!direction) {
      return []
    }

    return direction === 'desc' ? `-${column.field}` : column.field
  }).join(',')
}

function getSortIcon(direction: SortDirection) {
  if (direction === 'asc') {
    return <ArrowUp size={ICON_SIZE} aria-hidden="true" />
  }

  if (direction === 'desc') {
    return <ArrowDown size={ICON_SIZE} aria-hidden="true" />
  }

  return <ArrowUpDown size={ICON_SIZE} aria-hidden="true" />
}

function getNextSortDirection(direction: SortDirection): SortDirection {
  if (direction === '') {
    return 'asc'
  }

  if (direction === 'asc') {
    return 'desc'
  }

  return ''
}

function getSortToggleLabel(direction: SortDirection) {
  if (direction === 'asc') {
    return 'По возрастанию'
  }

  if (direction === 'desc') {
    return 'По убыванию'
  }

  return 'Без сортировки'
}

function getStatusBadgeVariant(status: string): BadgeProps['variant'] {
  const severity = getStatusSeverity(status)

  if (severity === 'critical') {
    return 'destructive'
  }

  if (severity === 'warning') {
    return 'warning'
  }

  if (severity === 'ok') {
    return 'success'
  }

  return 'info'
}

function quietValue(value?: string | null) {
  if (!value || value === 'Не указан' || value === 'Не указано' || value === 'Не указана') {
    return <span className="text-muted-foreground">—</span>
  }

  return value
}

function mergeColumnOptions(options: ProviderOnboardingListOptionsResponse | null) {
  if (!options) {
    return COLUMNS
  }

  return COLUMNS.map((column) => ({
    ...column,
    filterField: options.filterFields.find((field) => field.name === column.field),
    sortField: options.sortFields.find((field) => field.name === column.field),
  }))
}

function canFilterColumn(column: ColumnConfig) {
  return !column.filterField || column.filterField.operators.length > 0
}

function canSortColumn(column: ColumnConfig) {
  return !column.sortField || Boolean(column.sortField.name)
}

function mapSummaryResponse(response: ProviderOnboardingSummaryResponse): OnboardingApplication {
  return {
    id: response.applicationId,
    providerId: response.providerId ?? undefined,
    isApiBacked: true,
    providerName: response.displayName ?? 'Заявка поставщика',
    applicantName: 'Не указано',
    applicantEmail: response.contactEmail ?? 'Не указан',
    submittedAt: formatDate(response.submittedAt ?? response.updatedAt),
    status: response.status,
    priority: getStatusSeverity(response.status),
    legalName: response.legalName ?? 'Не указано',
    legalCountryCode: response.legalCountryCode ?? undefined,
    legalForm: response.legalForm ?? undefined,
    taxId: response.taxNumber ?? 'Не указан',
    city: 'Не указан',
    reviewNote: response.providerId ? 'Профиль поставщика уже создан.' : 'Профиль поставщика будет создан после одобрения.',
    checklist: [],
  }
}

function mapOnboardingResponse(response: ProviderOnboardingResponse, fallback?: OnboardingApplication): OnboardingApplication {
  const draft = response.draft
  const displayName = draft?.displayName ?? fallback?.providerName ?? 'Заявка поставщика'
  const legalName = draft?.legalName ?? fallback?.legalName ?? 'Не указано'
  const city = draft?.cityId ? 'Указан в заявке' : fallback?.city ?? 'Не указан'
  const applicationId = response.applicationId ?? fallback?.id ?? ''

  return {
    id: applicationId,
    providerId: response.providerId ?? fallback?.providerId,
    isApiBacked: true,
    providerName: displayName,
    applicantName: fallback?.applicantName ?? 'Не указано',
    applicantEmail: draft?.contactEmail ?? fallback?.applicantEmail ?? 'Не указан',
    submittedAt: formatDate(response.updatedAt),
    status: response.status,
    priority: getStatusSeverity(response.status),
    legalName,
    legalCountryCode: draft?.legalCountryCode ?? fallback?.legalCountryCode,
    legalForm: draft?.legalForm ?? fallback?.legalForm,
    taxId: draft?.taxNumber ?? fallback?.taxId ?? 'Не указан',
    registrationNumber: draft?.registrationNumber ?? fallback?.registrationNumber,
    branchNumber: draft?.branchNumber ?? fallback?.branchNumber,
    registeredAddress: draft?.registeredAddress ?? fallback?.registeredAddress,
    contactPhone: draft?.contactPhone ?? fallback?.contactPhone,
    city,
    address: draft?.address ?? fallback?.address,
    description: draft?.description ?? fallback?.description,
    reviewNote: response.providerId ? 'Профиль поставщика уже создан.' : 'Профиль поставщика будет создан после одобрения.',
    checklist: [
      { label: 'Профиль заполнен', done: isReadyChecklistStatus(response.checklist?.profile) },
      { label: 'Юридические данные заполнены', done: isReadyChecklistStatus(response.checklist?.legal) },
    ],
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

type OnboardingReviewProps = {
  viewMode: OnboardingViewMode
  onViewModeChange: (mode: OnboardingViewMode) => void
  onOpenApplication: (applicationId: string) => void
  onTopBarContentChange?: (content: React.ReactNode | null) => void
}

export function OnboardingReview({ viewMode, onViewModeChange, onOpenApplication, onTopBarContentChange }: OnboardingReviewProps) {
  const [applications, setApplications] = useState<OnboardingApplication[]>([])
  const [columnState, setColumnState] = useState<ColumnState>(EMPTY_COLUMN_STATE)
  const [listOptions, setListOptions] = useState<ProviderOnboardingListOptionsResponse | null>(null)
  const [activeColumn, setActiveColumn] = useState<ColumnConfig | null>(null)
  const [filterFlyoutPosition, setFilterFlyoutPosition] = useState<FlyoutPosition | null>(null)
  const [filterDraft, setFilterDraft] = useState('')
  const [sortDraft, setSortDraft] = useState<SortDirection>('')
  const [pagination, setPagination] = useState<PaginationResponse>(DEFAULT_PAGINATION)
  const [pageSize, setPageSize] = useState(20)
  const [lookupError, setLookupError] = useState('')
  const [isQueueLoading, setIsQueueLoading] = useState(true)

  const columns = useMemo(() => mergeColumnOptions(listOptions), [listOptions])
  const filterExpression = useMemo(() => buildFilterExpression(columnState), [columnState])
  const sortExpression = useMemo(() => buildSortExpression(columnState), [columnState])
  const activeFilter = filterExpression || listOptions?.defaultFilter || ''
  const activeSort = sortExpression || listOptions?.defaultSort || '-submittedAt'

  const loadQueue = useCallback(
    async (page = 1) => {
      try {
        setIsQueueLoading(true)
        const response = await getProviderOnboardingQueue({
          filter: activeFilter,
          sort: activeSort,
          page,
          pageSize,
        })
        setLookupError('')
        setApplications(response.items.map(mapSummaryResponse))
        setPagination(response.pagination)
      } catch (error) {
        setLookupError(getErrorMessage(error, 'Не удалось загрузить заявки'))
        setApplications([])
        setPagination(DEFAULT_PAGINATION)
      } finally {
        setIsQueueLoading(false)
      }
    },
    [activeFilter, activeSort, pageSize],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void getProviderOnboardingOptions()
        .then((options) => {
          setListOptions(options)
        })
        .catch(() => {
          setListOptions(null)
        })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadQueue(1)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadQueue])

  function openApplication(application: OnboardingApplication) {
    onOpenApplication(application.id)
  }

  function openApplicationFromKeyboard(event: React.KeyboardEvent<HTMLTableRowElement>, application: OnboardingApplication) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void openApplication(application)
    }
  }

  function openColumnFlyout(column: ColumnConfig, anchor: HTMLElement) {
    const state = columnState[column.key]
    const rect = anchor.getBoundingClientRect()

    setActiveColumn(column)
    setFilterFlyoutPosition({
      top: rect.bottom + 8,
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 376)),
    })
    setFilterDraft(state.filter)
    setSortDraft(state.sort)
  }

  function closeColumnFlyout() {
    setActiveColumn(null)
    setFilterFlyoutPosition(null)
  }

  function applyColumnFlyout() {
    if (!activeColumn) {
      return
    }

    setColumnState((currentState) => ({
      ...currentState,
      [activeColumn.key]: {
        filter: filterDraft,
        sort: sortDraft,
      },
    }))
    closeColumnFlyout()
  }

  function resetColumnFlyout() {
    setFilterDraft('')
    setSortDraft('')
  }

  const activeFilterCount = Object.values(columnState).filter((state) => state.filter.trim()).length
  const activeSortCount = Object.values(columnState).filter((state) => state.sort).length

  useEffect(() => {
    if (!onTopBarContentChange || viewMode !== 'table') {
      onTopBarContentChange?.(null)
      return undefined
    }

    onTopBarContentChange(
      <div className="flex min-w-0 items-center gap-1">
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {pagination.totalItems} заявок
          {activeFilterCount ? ` · фильтры ${activeFilterCount}` : ''}
          {activeSortCount ? ` · сортировка ${activeSortCount}` : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadQueue(pagination.page || 1)}
          disabled={isQueueLoading}
          aria-label="Обновить заявки"
          title="Обновить заявки"
        >
          {isQueueLoading ? <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={ICON_SIZE} aria-hidden="true" />}
        </Button>
      </div>,
    )

    return () => onTopBarContentChange(null)
  }, [activeFilterCount, activeSortCount, isQueueLoading, loadQueue, onTopBarContentChange, pagination.page, pagination.totalItems, viewMode])

  return (
    <>
      <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
        <OnboardingTabs activeTab={viewMode} onTabChange={onViewModeChange} />
        {viewMode === 'analytics' ? (
        <div className="grid flex-1 place-items-center border-t bg-card p-4">
            <div className="max-w-md text-center">
              <h2 className="text-lg font-semibold">Аналитика онбординга</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Здесь будет сводка по воронке, статусам и скорости ревью, когда появится аналитический контракт API.
              </p>
            </div>
          </div>
        ) : (
          <>
        {lookupError ? <p className="border-b px-2 py-2 text-sm font-medium text-destructive">{lookupError}</p> : null}

        <TableFrame className="relative min-h-0 flex-1 rounded-none border-0 bg-card">
          <Table className="min-w-0 table-fixed">
            <colgroup>
              <col className="w-[31%]" />
              <col className="w-[26%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <TableRow>
                {columns.map((column) => {
                  const state = columnState[column.key]
                  const hasFilter = Boolean(state.filter.trim())
                  const isActive = hasFilter || Boolean(state.sort)

                  return (
                    <TableHead key={column.key} className="px-3 py-2 align-top">
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
                        onClick={(event) => openColumnFlyout(column, event.currentTarget)}
                      >
                        <span className="min-w-0 break-words">{column.label}</span>
                        <span className={isActive ? 'grid size-5 shrink-0 place-items-center rounded bg-accent text-primary' : 'grid size-5 shrink-0 place-items-center text-muted-foreground'}>
                          {hasFilter ? <Filter size={12} aria-hidden="true" /> : getSortIcon(state.sort)}
                        </span>
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length ? (
                applications.map((application) => (
                  <TableRow
                    key={application.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => openApplication(application)}
                    onKeyDown={(event) => openApplicationFromKeyboard(event, application)}
                  >
                    <TableCell className="min-w-0 px-2">
                      <div className="grid min-w-0 grid-cols-[10px_minmax(0,1fr)] gap-2">
                        <span className={application.priority === 'critical' ? 'mt-1.5 size-2 rounded-full bg-destructive' : application.priority === 'warning' ? 'mt-1.5 size-2 rounded-full bg-amber-500' : application.priority === 'ok' ? 'mt-1.5 size-2 rounded-full bg-primary' : 'mt-1.5 size-2 rounded-full bg-sky-500'} aria-hidden="true"></span>
                        <div>
                          <strong className="block truncate text-sm font-medium">{application.providerName}</strong>
                          <small className="block truncate text-xs text-muted-foreground">{application.applicantEmail}</small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 px-2">
                      <strong className="block truncate text-sm font-medium">{quietValue(application.legalName)}</strong>
                      <small className="block truncate text-xs text-muted-foreground">{application.legalForm || application.id}</small>
                    </TableCell>
                    <TableCell className="px-2">{quietValue(application.taxId)}</TableCell>
                    <TableCell className="px-2">
                      <Badge variant={getStatusBadgeVariant(application.status)} className="max-w-full truncate">{application.status}</Badge>
                    </TableCell>
                    <TableCell className="px-2 text-xs text-muted-foreground">{application.submittedAt}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                    {isQueueLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" />
                        Загружаем заявки...
                      </span>
                    ) : 'Заявок для проверки нет.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {isQueueLoading && applications.length ? (
            <div className="absolute inset-0 grid place-items-center bg-card/65 backdrop-blur-[1px]">
              <span className="inline-flex items-center gap-2 border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" />
                Обновляем заявки...
              </span>
            </div>
          ) : null}
        </TableFrame>
        <footer className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate">
              Страница {pagination.page || 1} из {Math.max(pagination.totalPages, 1)} · всего {pagination.totalItems}
            </span>
            <label className="flex h-8 items-center gap-2 border bg-card px-2 text-sm" title="Строк на странице">
              <SlidersHorizontal size={ICON_SIZE} aria-hidden="true" />
              <select className="bg-transparent text-sm outline-none" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void loadQueue(pagination.page - 1)}
              disabled={isQueueLoading || !pagination.hasPreviousPage}
              aria-label="Предыдущая страница"
              title="Предыдущая страница"
            >
              <ChevronLeft size={ICON_SIZE} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void loadQueue(pagination.page + 1)}
              disabled={isQueueLoading || !pagination.hasNextPage}
              aria-label="Следующая страница"
              title="Следующая страница"
            >
              <ChevronRight size={ICON_SIZE} aria-hidden="true" />
            </Button>
          </div>
        </footer>
          </>
        )}
      </section>

      {activeColumn && filterFlyoutPosition ? (
        <ColumnFilterFlyout
          column={activeColumn}
          position={filterFlyoutPosition}
          filter={filterDraft}
          sort={sortDraft}
          onFilterChange={setFilterDraft}
          onSortChange={setSortDraft}
          onApply={applyColumnFlyout}
          onReset={resetColumnFlyout}
          onClose={closeColumnFlyout}
        />
      ) : null}

    </>
  )
}

function OnboardingTabs({ activeTab, onTabChange }: { activeTab: OnboardingViewMode; onTabChange: (tab: OnboardingViewMode) => void }) {
  return (
    <div className="flex h-10 items-end gap-5 border-b bg-card px-3" role="tablist" aria-label="Онбординг">
      <button
        type="button"
        className={getTabClassName(activeTab === 'table')}
        onClick={() => onTabChange('table')}
        role="tab"
        aria-selected={activeTab === 'table'}
      >
        <LayoutGrid size={ICON_SIZE} aria-hidden="true" />
        Заявки
      </button>
      <button
        type="button"
        className={getTabClassName(activeTab === 'analytics')}
        onClick={() => onTabChange('analytics')}
        role="tab"
        aria-selected={activeTab === 'analytics'}
      >
        <BarChart3 size={ICON_SIZE} aria-hidden="true" />
        Аналитика
      </button>
    </div>
  )
}

function getTabClassName(active: boolean) {
  return active
    ? '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-primary px-0 text-sm font-medium text-foreground'
    : '-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground'
}

function ColumnFilterFlyout({
  column,
  position,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onApply,
  onReset,
  onClose,
}: {
  column: ColumnConfig
  position: FlyoutPosition
  filter: string
  sort: SortDirection
  onFilterChange: (value: string) => void
  onSortChange: (value: SortDirection) => void
  onApply: () => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50" role="presentation" onMouseDown={onClose}>
      <section
        className="absolute grid w-[min(300px,calc(100vw-2rem))] gap-2 border bg-popover p-2 text-popover-foreground shadow-lg"
        style={{ top: position.top, left: position.left }}
        role="dialog"
        aria-label={`Фильтр: ${column.label}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">Фильтр</span>
            {column.filterField?.values?.length ? (
              <select className="h-8 rounded-sm border bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)}>
                <option value="">Все</option>
                {column.filterField.values.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input className="h-9 pl-9" value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)} />
              </div>
            )}
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Сортировка</span>
            <Button
              type="button"
              variant={sort ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 min-w-36 justify-start"
              onClick={() => onSortChange(getNextSortDirection(sort))}
              disabled={!canSortColumn(column)}
              aria-label="Изменить сортировку"
              title="Изменить сортировку"
            >
              {getSortIcon(sort)}
              {getSortToggleLabel(sort)}
            </Button>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw size={ICON_SIZE} aria-hidden="true" />
            Очистить
          </Button>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" title="Закрыть">
              <X size={ICON_SIZE} aria-hidden="true" />
            </Button>
            <Button type="button" size="sm" onClick={onApply}>
            <Check size={ICON_SIZE} aria-hidden="true" />
            Применить
            </Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

type ApplicationDetailTab = 'summary' | 'legal' | 'decision'

export function OnboardingApplicationPage({
  applicationId,
  onBack,
  onTopBarContentChange,
}: {
  applicationId: string
  onBack: () => void
  onTopBarContentChange?: (content: React.ReactNode | null) => void
}) {
  const [application, setApplication] = useState<OnboardingApplication | null>(null)
  const [activeTab, setActiveTab] = useState<ApplicationDetailTab>('summary')
  const [detailError, setDetailError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reasonCode, setReasonCode] = useState('')
  const [comments, setComments] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [submittingAction, setSubmittingAction] = useState<ProviderOnboardingAction | null>(null)
  const canReview = Boolean(application?.isApiBacked && GUID_PATTERN.test(application.id))

  const loadApplication = useCallback(async () => {
    if (!GUID_PATTERN.test(applicationId)) {
      setDetailError('Некорректный идентификатор заявки')
      setApplication(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const response = await getProviderOnboarding(applicationId)
      setApplication(mapOnboardingResponse(response))
      setDetailError('')
    } catch (error) {
      setApplication(null)
      setDetailError(getErrorMessage(error, 'Не удалось загрузить заявку'))
    } finally {
      setIsLoading(false)
    }
  }, [applicationId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadApplication()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadApplication])

  useEffect(() => {
    onTopBarContentChange?.(
      <div className="flex min-w-0 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft size={ICON_SIZE} aria-hidden="true" />
          Назад
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadApplication()}
          disabled={isLoading}
          aria-label="Обновить заявку"
          title="Обновить заявку"
        >
          {isLoading ? <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={ICON_SIZE} aria-hidden="true" />}
        </Button>
      </div>,
    )

    return () => onTopBarContentChange?.(null)
  }, [isLoading, loadApplication, onBack, onTopBarContentChange])

  async function submitAction(action: ProviderOnboardingAction) {
    const requiresReason = action === 'request_changes' || action === 'reject'
    const normalizedReasonCode = reasonCode.trim()
    const normalizedComments = comments.trim()

    if (!canReview || !application) {
      setActionError('Сначала откройте заявку для проверки')
      return
    }

    if (requiresReason && !normalizedReasonCode) {
      setActionError('Для этого решения нужна причина')
      return
    }

    setActionError('')
    setActionSuccess('')
    setSubmittingAction(action)

    try {
      const response = await postProviderOnboardingAction(application.id, {
        action,
        reasonCode: requiresReason ? normalizedReasonCode : null,
        comments: normalizedComments || null,
      })
      const updatedApplication = mapOnboardingResponse(response.onboarding, application)
      setApplication(updatedApplication)
      setActionSuccess(`Решение применено: ${response.result?.actionCode ?? action}`)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Не удалось применить решение'))
    } finally {
      setSubmittingAction(null)
    }
  }

  if (isLoading) {
    return (
      <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-card p-4">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" />
          Загружаем заявку...
        </span>
      </section>
    )
  }

  if (!application) {
    return (
      <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-card p-4">
        <div className="grid max-w-md gap-3 text-center">
          <h2 className="text-lg font-semibold">Заявка недоступна</h2>
          <p className="text-sm text-muted-foreground">{detailError || 'Не удалось открыть заявку.'}</p>
          <Button type="button" variant="outline" className="justify-self-center" onClick={onBack}>
            <ChevronLeft size={ICON_SIZE} aria-hidden="true" />
            Вернуться к списку
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-card">
      <div className="border-b bg-card px-3 pt-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="onboarding-title" className="text-xl font-semibold">{application.providerName}</h2>
            <span className="block text-sm text-muted-foreground">{application.id}</span>
          </div>
          <Badge variant={getStatusBadgeVariant(application.status)}>{application.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-5" role="tablist" aria-label="Разделы заявки">
          <DetailTabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>Сводка</DetailTabButton>
          <DetailTabButton active={activeTab === 'legal'} onClick={() => setActiveTab('legal')}>Юрданные</DetailTabButton>
          <DetailTabButton active={activeTab === 'decision'} onClick={() => setActiveTab('decision')}>Решение</DetailTabButton>
        </div>
      </div>

      <div className="p-4">
        {detailError ? <p className="text-sm font-medium text-destructive lg:col-span-2">{detailError}</p> : null}

        {activeTab === 'summary' ? (
          <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Заявитель</h3>
              <DetailFieldList
                rows={[
                  { label: 'Имя', value: quietValue(application.applicantName) },
                  { label: 'Почта', value: quietValue(application.applicantEmail) },
                  { label: 'Телефон', value: quietValue(application.contactPhone) },
                  { label: 'Статус', value: <Badge variant={getStatusBadgeVariant(application.status)}>{application.status}</Badge> },
                  {
                    label: 'Профиль',
                    value: application.providerId ? application.providerId : <span className="text-muted-foreground">создастся после одобрения</span>,
                  },
                ]}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Чеклист</h3>
              <ul className="grid gap-2">
                {application.checklist.map((item) => (
                  <li className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2 text-sm" key={item.label}>
                    <span className={item.done ? 'grid size-5 place-items-center rounded-full bg-primary text-primary-foreground' : 'grid size-5 place-items-center rounded-full bg-muted'}>{item.done ? <Check size={12} aria-hidden="true" /> : null}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:col-span-2">
              <h3 className="mb-2 text-sm font-semibold">Заметка ревью</h3>
              <p className="max-w-3xl text-sm text-muted-foreground">{application.reviewNote}</p>
              {application.description ? <p className="mt-2 max-w-3xl text-sm">{application.description}</p> : null}
            </section>
          </div>
        ) : null}

        {activeTab === 'legal' ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Юридические данные</h3>
            <DetailFieldList
              rows={[
                { label: 'Название', value: quietValue(application.legalName) },
                { label: 'Страна', value: quietValue(application.legalCountryCode) },
                { label: 'Форма', value: quietValue(application.legalForm) },
                { label: 'ИНН', value: application.taxId },
                { label: 'ОГРН', value: quietValue(application.registrationNumber) },
                { label: 'КПП', value: quietValue(application.branchNumber) },
                { label: 'Юр. адрес', value: quietValue(application.registeredAddress) },
                { label: 'Город', value: quietValue(application.city) },
                { label: 'Адрес', value: quietValue(application.address) },
              ]}
            />
          </section>
        ) : null}

        {activeTab === 'decision' ? (
          <section className="grid max-w-3xl gap-3">
            <h3 className="text-sm font-semibold">Решение</h3>
            {!canReview ? <p className="text-sm text-muted-foreground">Откройте загруженную заявку, чтобы принять решение.</p> : null}
            <label className="grid gap-2">
              <span className="text-sm font-medium">Причина</span>
              <Input
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                placeholder="Обязательно для запроса изменений или отказа"
                disabled={!canReview}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Комментарий</span>
              <Textarea value={comments} onChange={(event) => setComments(event.target.value)} disabled={!canReview} />
            </label>
            {actionError ? <p className="text-sm font-medium text-destructive">{actionError}</p> : null}
            {actionSuccess ? <p className="text-sm font-medium text-primary">{actionSuccess}</p> : null}
            <footer className="flex flex-wrap justify-end gap-2 pt-1">
              {REVIEW_ACTIONS.map((action) => (
                <Button
                  type="button"
                  key={action.code}
                  variant={action.tone === 'danger' ? 'destructive' : 'outline'}
                  onClick={() => void submitAction(action.code)}
                  disabled={!canReview || Boolean(submittingAction)}
                >
                  {action.code === 'approve' ? <CircleCheck size={ICON_SIZE} aria-hidden="true" /> : null}
                  {action.code === 'request_changes' ? <CircleAlert size={ICON_SIZE} aria-hidden="true" /> : null}
                  {action.code === 'reject' ? <CircleX size={ICON_SIZE} aria-hidden="true" /> : null}
                  {submittingAction === action.code ? 'Отправляем...' : action.label}
                </Button>
              ))}
            </footer>
          </section>
        ) : null}
      </div>
    </section>
  )
}

function DetailTabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={getTabClassName(active)} onClick={onClick} role="tab" aria-selected={active}>
      {children}
    </button>
  )
}

function DetailFieldList({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="max-w-3xl divide-y text-sm">
      {rows.map((row) => (
        <div className="grid gap-1 py-2 sm:grid-cols-[180px_minmax(0,1fr)]" key={row.label}>
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
