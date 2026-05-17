import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Badge, type BadgeProps } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DialogBackdrop, DialogBody, DialogContent, DialogFooter, DialogHeader } from '../../components/ui/dialog'
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

function getSortLabel(direction: SortDirection) {
  if (direction === 'asc') {
    return 'по возрастанию'
  }

  if (direction === 'desc') {
    return 'по убыванию'
  }

  return 'без сортировки'
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
    providerName: response.displayName ?? 'Заявка провайдера',
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
    reviewNote: response.providerId ? 'Профиль провайдера уже создан.' : 'Профиль провайдера будет создан после одобрения.',
    checklist: [],
  }
}

function mapOnboardingResponse(response: ProviderOnboardingResponse, fallback?: OnboardingApplication): OnboardingApplication {
  const draft = response.draft
  const displayName = draft?.displayName ?? fallback?.providerName ?? 'Заявка провайдера'
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
    reviewNote: response.providerId ? 'Профиль провайдера уже создан.' : 'Профиль провайдера будет создан после одобрения.',
    checklist: [
      { label: 'Профиль заполнен', done: isReadyChecklistStatus(response.checklist?.profile) },
      { label: 'Юридические данные заполнены', done: isReadyChecklistStatus(response.checklist?.legal) },
    ],
  }
}

function upsertApplication(applications: OnboardingApplication[], application: OnboardingApplication) {
  const existingIndex = applications.findIndex((item) => item.id === application.id)

  if (existingIndex === -1) {
    return [application, ...applications]
  }

  return applications.map((item, index) => (index === existingIndex ? application : item))
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

type OnboardingReviewProps = {
  viewMode: OnboardingViewMode
}

export function OnboardingReview({ viewMode }: OnboardingReviewProps) {
  const [applications, setApplications] = useState<OnboardingApplication[]>([])
  const [selectedApplication, setSelectedApplication] = useState<OnboardingApplication | null>(null)
  const [columnState, setColumnState] = useState<ColumnState>(EMPTY_COLUMN_STATE)
  const [listOptions, setListOptions] = useState<ProviderOnboardingListOptionsResponse | null>(null)
  const [activeColumn, setActiveColumn] = useState<ColumnConfig | null>(null)
  const [filterDraft, setFilterDraft] = useState('')
  const [sortDraft, setSortDraft] = useState<SortDirection>('')
  const [pagination, setPagination] = useState<PaginationResponse>(DEFAULT_PAGINATION)
  const [pageSize, setPageSize] = useState(20)
  const [lookupError, setLookupError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [isQueueLoading, setIsQueueLoading] = useState(true)

  const columns = useMemo(() => mergeColumnOptions(listOptions), [listOptions])
  const filterExpression = useMemo(() => buildFilterExpression(columnState), [columnState])
  const sortExpression = useMemo(() => buildSortExpression(columnState), [columnState])
  const activeFilter = filterExpression || listOptions?.defaultFilter || ''
  const activeSort = sortExpression || listOptions?.defaultSort || '-submittedAt'

  const loadQueue = useCallback(
    async (page = 1) => {
      try {
        const response = await getProviderOnboardingQueue({
          filter: activeFilter,
          sort: activeSort,
          page,
          pageSize,
        })
        setLookupError('')
        setDetailError('')
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

  async function loadApplication(applicationId: string, fallback?: OnboardingApplication) {
    const response = await getProviderOnboarding(applicationId)
    const application = mapOnboardingResponse(response, fallback)

    setApplications((currentApplications) => upsertApplication(currentApplications, application))
    setSelectedApplication(application)
    return application
  }

  async function openApplication(application: OnboardingApplication) {
    setSelectedApplication(application)
    setDetailError('')

    if (!GUID_PATTERN.test(application.id)) {
      return
    }

    try {
      await loadApplication(application.id, application)
    } catch (error) {
      setDetailError(getErrorMessage(error, 'Не удалось обновить данные заявки'))
    }
  }

  function openApplicationFromKeyboard(event: React.KeyboardEvent<HTMLTableRowElement>, application: OnboardingApplication) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void openApplication(application)
    }
  }

  function openColumnDialog(column: ColumnConfig) {
    const state = columnState[column.key]

    setActiveColumn(column)
    setFilterDraft(state.filter)
    setSortDraft(state.sort)
  }

  function applyColumnDialog() {
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
    setActiveColumn(null)
  }

  function resetColumnDialog() {
    setFilterDraft('')
    setSortDraft('')
  }

  function clearAllFilters() {
    setColumnState(EMPTY_COLUMN_STATE)
  }

  function updateApplication(application: OnboardingApplication) {
    setApplications((currentApplications) => upsertApplication(currentApplications, application))
    setSelectedApplication(application)
  }

  if (viewMode === 'analytics') {
    return (
      <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center border-t bg-background p-6">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold">Аналитика онбординга</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Здесь будет сводка по воронке, статусам и скорости ревью, когда появится аналитический контракт API.
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b px-2 py-2">
          <span className="text-sm text-muted-foreground">
            {pagination.totalItems} заявок
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void loadQueue(pagination.page)}
            disabled={isQueueLoading}
            aria-label="Обновить"
            title="Обновить"
          >
            <RefreshCw size={ICON_SIZE} aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={clearAllFilters} aria-label="Сбросить фильтры" title="Сбросить фильтры">
            <RotateCcw size={ICON_SIZE} aria-hidden="true" />
          </Button>
          <label className="flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted" title="Строк на странице">
            <SlidersHorizontal size={ICON_SIZE} aria-hidden="true" />
            <select className="bg-transparent text-sm outline-none" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        {lookupError ? <p className="border-b px-2 py-2 text-sm font-medium text-destructive">{lookupError}</p> : null}

        <TableFrame className="min-h-0 flex-1 rounded-none border-0 bg-background">
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

                  return (
                    <TableHead key={column.key} className="px-2 py-2 align-top">
                      <button type="button" className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-background" onClick={() => openColumnDialog(column)}>
                        <span className="min-w-0 break-words">
                          {column.label}
                        </span>
                        <span className={state.sort || hasFilter ? 'grid size-5 place-items-center rounded bg-accent text-primary' : 'grid size-5 place-items-center text-muted-foreground'} title={getSortLabel(state.sort)}>
                          {hasFilter ? <Filter size={12} aria-label="Есть фильтр" /> : null}
                          {getSortIcon(state.sort)}
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
                    onClick={() => void openApplication(application)}
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
                    {isQueueLoading ? 'Загружаем заявки...' : 'Заявок для проверки нет.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableFrame>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-2 text-sm text-muted-foreground">
          <span>
            Страница {pagination.page || 1} из {Math.max(pagination.totalPages, 1)} · всего {pagination.totalItems}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void loadQueue(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage}
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
              disabled={!pagination.hasNextPage}
              aria-label="Следующая страница"
              title="Следующая страница"
            >
              <ChevronRight size={ICON_SIZE} aria-hidden="true" />
            </Button>
          </div>
        </footer>
      </section>

      {activeColumn ? (
        <ColumnFilterModal
          column={activeColumn}
          filter={filterDraft}
          sort={sortDraft}
          onFilterChange={setFilterDraft}
          onSortChange={setSortDraft}
          onApply={applyColumnDialog}
          onReset={resetColumnDialog}
          onClose={() => setActiveColumn(null)}
        />
      ) : null}

      {selectedApplication ? (
        <OnboardingDetailModal
          application={selectedApplication}
          detailError={detailError}
          onApplicationUpdated={updateApplication}
          onClose={() => setSelectedApplication(null)}
        />
      ) : null}
    </>
  )
}

function ColumnFilterModal({
  column,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onApply,
  onReset,
  onClose,
}: {
  column: ColumnConfig
  filter: string
  sort: SortDirection
  onFilterChange: (value: string) => void
  onSortChange: (value: SortDirection) => void
  onApply: () => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <DialogBackdrop role="presentation" onMouseDown={onClose}>
      <DialogContent className="max-w-[420px]" role="dialog" aria-modal="true" aria-labelledby="column-filter-title" onMouseDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <h2 id="column-filter-title" className="text-lg font-semibold">{column.label}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" title="Закрыть">
            <X size={ICON_SIZE} aria-hidden="true" />
          </Button>
        </DialogHeader>

        <DialogBody className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Фильтр</span>
            {column.filterField?.values?.length ? (
              <select className="h-10 rounded-md border bg-card px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring" value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)}>
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
                <Input className="pl-9" value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)} />
              </div>
            )}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Сортировка</span>
            <select className="h-10 rounded-md border bg-card px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring" value={sort} onChange={(event) => onSortChange(event.target.value as SortDirection)} disabled={!canSortColumn(column)}>
              <option value="">Без сортировки</option>
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>
          </label>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw size={ICON_SIZE} aria-hidden="true" />
            Очистить
          </Button>
          <Button type="button" onClick={onApply}>
            <Check size={ICON_SIZE} aria-hidden="true" />
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogBackdrop>
  )
}

function OnboardingDetailModal({
  application,
  detailError,
  onApplicationUpdated,
  onClose,
}: {
  application: OnboardingApplication
  detailError: string
  onApplicationUpdated: (application: OnboardingApplication) => void
  onClose: () => void
}) {
  const [reasonCode, setReasonCode] = useState('')
  const [comments, setComments] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [submittingAction, setSubmittingAction] = useState<ProviderOnboardingAction | null>(null)
  const canReview = application.isApiBacked && GUID_PATTERN.test(application.id)

  async function submitAction(action: ProviderOnboardingAction) {
    const requiresReason = action === 'request_changes' || action === 'reject'
    const normalizedReasonCode = reasonCode.trim()
    const normalizedComments = comments.trim()

    if (!canReview) {
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
      onApplicationUpdated(updatedApplication)
      setActionSuccess(`Решение применено: ${response.result?.actionCode ?? action}`)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Не удалось применить решение'))
    } finally {
      setSubmittingAction(null)
    }
  }

  return (
    <DialogBackdrop role="presentation" onMouseDown={onClose}>
      <DialogContent
        className="max-w-[920px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <div>
            <h2 id="onboarding-title" className="text-xl font-semibold">{application.providerName}</h2>
            <span className="block text-sm text-muted-foreground">{application.id}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" title="Закрыть">
            <X size={ICON_SIZE} aria-hidden="true" />
          </Button>
        </DialogHeader>

        <DialogBody className="grid gap-4 lg:grid-cols-2">
          {detailError ? <p className="text-sm font-medium text-destructive lg:col-span-2">{detailError}</p> : null}

          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">Заявитель</h3>
            <TableFrame>
              <Table>
                <TableBody>
                <tr>
                  <TableHead className="w-40 normal-case tracking-normal">Имя</TableHead>
                  <TableCell>{quietValue(application.applicantName)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Email</TableHead>
                  <TableCell>{quietValue(application.applicantEmail)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Телефон</TableHead>
                  <TableCell>{quietValue(application.contactPhone)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Статус</TableHead>
                  <TableCell><Badge variant={getStatusBadgeVariant(application.status)}>{application.status}</Badge></TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Профиль</TableHead>
                  <TableCell>{application.providerId ? application.providerId : <span className="text-muted-foreground">создастся после одобрения</span>}</TableCell>
                </tr>
                </TableBody>
              </Table>
            </TableFrame>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">Юридические данные</h3>
            <TableFrame>
              <Table>
                <TableBody>
                <tr>
                  <TableHead className="w-40 normal-case tracking-normal">Название</TableHead>
                  <TableCell>{quietValue(application.legalName)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Страна</TableHead>
                  <TableCell>{quietValue(application.legalCountryCode)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Форма</TableHead>
                  <TableCell>{quietValue(application.legalForm)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">ИНН</TableHead>
                  <TableCell>{application.taxId}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">ОГРН</TableHead>
                  <TableCell>{quietValue(application.registrationNumber)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">КПП</TableHead>
                  <TableCell>{quietValue(application.branchNumber)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Юр. адрес</TableHead>
                  <TableCell>{quietValue(application.registeredAddress)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Город</TableHead>
                  <TableCell>{quietValue(application.city)}</TableCell>
                </tr>
                <tr>
                  <TableHead className="normal-case tracking-normal">Адрес</TableHead>
                  <TableCell>{quietValue(application.address)}</TableCell>
                </tr>
                </TableBody>
              </Table>
            </TableFrame>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">Чеклист</h3>
            <ul className="grid gap-2">
              {application.checklist.map((item) => (
                <li className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2 text-sm" key={item.label}>
                  <span className={item.done ? 'grid size-5 place-items-center rounded-full bg-primary text-primary-foreground' : 'grid size-5 place-items-center rounded-full bg-muted'}>{item.done ? <Check size={12} aria-hidden="true" /> : null}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-semibold">Заметка ревью</h3>
            <p className="text-sm text-muted-foreground">{application.reviewNote}</p>
            {application.description ? <p className="mt-2 text-sm">{application.description}</p> : null}
          </section>

          <section className="grid gap-3 rounded-lg border bg-muted/30 p-4 lg:col-span-2">
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
          </section>
        </DialogBody>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </DialogBackdrop>
  )
}
