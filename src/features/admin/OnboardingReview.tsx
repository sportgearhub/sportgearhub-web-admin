import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OnboardingApplication, Severity } from '../../types/admin'
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
  { key: 'displayName', label: 'Провайдер', field: 'displayName', filterKind: 'text' },
  { key: 'legalName', label: 'Юр. название', field: 'legalName', filterKind: 'text' },
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

export function OnboardingReview() {
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

  return (
    <>
      <section className="panel wide">
        <div className="table-controls">
          <button type="button" className="secondary-action" onClick={() => void loadQueue(pagination.page)} disabled={isQueueLoading}>
            {isQueueLoading ? 'Обновляем...' : 'Обновить'}
          </button>
          <button type="button" className="secondary-action" onClick={clearAllFilters}>
            Сбросить фильтры
          </button>
          <label>
            <span>Строк</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        {lookupError ? <p className="panel-error">{lookupError}</p> : null}

        <div className="table-scroll">
          <table className="data-table onboarding-table">
            <thead>
              <tr>
                {columns.map((column) => {
                  const state = columnState[column.key]
                  const hasFilter = Boolean(state.filter.trim())

                  return (
                    <th key={column.key}>
                      <button type="button" className="column-control-button" onClick={() => openColumnDialog(column)}>
                        <span>{column.label}</span>
                        <small>
                          {hasFilter ? 'фильтр' : 'все'} · {getSortLabel(state.sort)}
                        </small>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {applications.length ? (
                applications.map((application) => (
                  <tr
                    key={application.id}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={() => void openApplication(application)}
                    onKeyDown={(event) => openApplicationFromKeyboard(event, application)}
                  >
                    <td>
                      <span className={`severity ${application.priority}`} aria-hidden="true"></span>
                      <strong>{application.providerName}</strong>
                      <small>Заявка {application.id}</small>
                    </td>
                    <td>
                      <strong>{application.legalName}</strong>
                      <small>{application.legalForm ?? 'Форма не указана'}</small>
                    </td>
                    <td>{application.taxId}</td>
                    <td>{application.status}</td>
                    <td>{application.submittedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="empty-table-cell">
                    {isQueueLoading ? 'Загружаем заявки...' : 'Заявок для проверки нет.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-pagination">
          <span>
            Страница {pagination.page || 1} из {Math.max(pagination.totalPages, 1)} · всего {pagination.totalItems}
          </span>
          <div>
            <button type="button" className="secondary-action" onClick={() => void loadQueue(pagination.page - 1)} disabled={!pagination.hasPreviousPage}>
              Назад
            </button>
            <button type="button" className="secondary-action" onClick={() => void loadQueue(pagination.page + 1)} disabled={!pagination.hasNextPage}>
              Вперед
            </button>
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
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="column-filter-modal" role="dialog" aria-modal="true" aria-labelledby="column-filter-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id="column-filter-title">{column.label}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="column-filter-body">
          <label>
            <span>Фильтр</span>
            {column.filterField?.values?.length ? (
              <select value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)}>
                <option value="">Все</option>
                {column.filterField.values.map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <input value={filter} onChange={(event) => onFilterChange(event.target.value)} autoFocus disabled={!canFilterColumn(column)} />
            )}
            {column.filterField?.operators?.length ? <small>Доступно: {column.filterField.operators.join(', ')}</small> : null}
          </label>
          <label>
            <span>Сортировка</span>
            <select value={sort} onChange={(event) => onSortChange(event.target.value as SortDirection)} disabled={!canSortColumn(column)}>
              <option value="">Без сортировки</option>
              <option value="asc">По возрастанию</option>
              <option value="desc">По убыванию</option>
            </select>
          </label>
        </div>

        <footer>
          <button type="button" className="secondary-action" onClick={onReset}>
            Очистить
          </button>
          <button type="button" className="primary-action" onClick={onApply}>
            Применить
          </button>
        </footer>
      </section>
    </div>
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
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="onboarding-modal-header">
          <div>
            <h2 id="onboarding-title">{application.providerName}</h2>
            <span>Заявка {application.id}</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="onboarding-modal-body">
          {detailError ? <p className="form-error">{detailError}</p> : null}

          <section>
            <h3>Заявитель</h3>
            <table className="data-table key-value-table">
              <tbody>
                <tr>
                  <th>Имя</th>
                  <td>{application.applicantName}</td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>{application.applicantEmail}</td>
                </tr>
                <tr>
                  <th>Телефон</th>
                  <td>{application.contactPhone ?? 'Не указан'}</td>
                </tr>
                <tr>
                  <th>Статус</th>
                  <td>{application.status}</td>
                </tr>
                <tr>
                  <th>Профиль провайдера</th>
                  <td>{application.providerId ?? 'Еще не создан'}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>Юридические данные</h3>
            <table className="data-table key-value-table">
              <tbody>
                <tr>
                  <th>Название</th>
                  <td>{application.legalName}</td>
                </tr>
                <tr>
                  <th>Страна</th>
                  <td>{application.legalCountryCode ?? 'Не указана'}</td>
                </tr>
                <tr>
                  <th>Форма</th>
                  <td>{application.legalForm ?? 'Не указана'}</td>
                </tr>
                <tr>
                  <th>ИНН</th>
                  <td>{application.taxId}</td>
                </tr>
                <tr>
                  <th>ОГРН</th>
                  <td>{application.registrationNumber ?? 'Не указан'}</td>
                </tr>
                <tr>
                  <th>КПП</th>
                  <td>{application.branchNumber ?? 'Не указан'}</td>
                </tr>
                <tr>
                  <th>Юр. адрес</th>
                  <td>{application.registeredAddress ?? 'Не указан'}</td>
                </tr>
                <tr>
                  <th>Город</th>
                  <td>{application.city}</td>
                </tr>
                <tr>
                  <th>Адрес</th>
                  <td>{application.address ?? 'Не указан'}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>Чеклист</h3>
            <ul className="modal-checklist">
              {application.checklist.map((item) => (
                <li key={item.label}>
                  <span className={item.done ? 'check done' : 'check'}>{item.done ? '✓' : ''}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Заметка ревью</h3>
            <p>{application.reviewNote}</p>
            {application.description ? <p>{application.description}</p> : null}
          </section>

          <section className="review-decision-panel">
            <h3>Решение</h3>
            {!canReview ? <p className="form-note">Откройте загруженную заявку, чтобы принять решение.</p> : null}
            <label>
              <span>Причина решения</span>
              <input
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                placeholder="Обязательно для запроса изменений или отказа"
                disabled={!canReview}
              />
            </label>
            <label>
              <span>Комментарий</span>
              <textarea value={comments} onChange={(event) => setComments(event.target.value)} disabled={!canReview} />
            </label>
            {actionError ? <p className="form-error">{actionError}</p> : null}
            {actionSuccess ? <p className="form-success">{actionSuccess}</p> : null}
          </section>
        </div>

        <footer className="onboarding-modal-actions">
          {REVIEW_ACTIONS.map((action) => (
            <button
              type="button"
              key={action.code}
              className={action.tone === 'danger' ? 'danger-action' : 'secondary-action'}
              onClick={() => void submitAction(action.code)}
              disabled={!canReview || Boolean(submittingAction)}
            >
              {submittingAction === action.code ? 'Отправляем...' : action.label}
            </button>
          ))}
        </footer>
      </section>
    </div>
  )
}
