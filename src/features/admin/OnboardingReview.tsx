import { useState } from 'react'
import { onboardingApplications } from '../../data/adminPrototype'
import type { OnboardingApplication, Severity } from '../../types/admin'
import {
  getProviderOnboarding,
  postProviderOnboardingAction,
  type ProviderOnboardingAction,
  type ProviderOnboardingResponse,
} from './adminApi'

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REVIEW_ACTIONS: Array<{ code: ProviderOnboardingAction; label: string; tone?: 'danger' }> = [
  { code: 'approve', label: 'Одобрить' },
  { code: 'request_changes', label: 'Запросить изменения' },
  { code: 'reject', label: 'Отклонить', tone: 'danger' },
]

function formatDate(value?: string) {
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

function mapOnboardingResponse(response: ProviderOnboardingResponse, fallback?: OnboardingApplication): OnboardingApplication {
  const draft = response.draft
  const displayName = draft?.displayName ?? fallback?.providerName ?? 'Заявка провайдера'
  const legalName = draft?.legalName ?? fallback?.legalName ?? 'Не указано'
  const city = draft?.cityId ? `ID города: ${draft.cityId}` : fallback?.city ?? 'Не указан'
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
    reviewNote: response.providerId
      ? `Данные загружены из API. Provider ID: ${response.providerId}`
      : 'Данные загружены из API. Профиль провайдера еще не создан.',
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
  const [applications, setApplications] = useState<OnboardingApplication[]>(onboardingApplications)
  const [selectedApplication, setSelectedApplication] = useState<OnboardingApplication | null>(null)
  const [lookupId, setLookupId] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [isLookupLoading, setIsLookupLoading] = useState(false)

  async function loadApplication(applicationId: string, fallback?: OnboardingApplication) {
    const response = await getProviderOnboarding(applicationId)
    const application = mapOnboardingResponse(response, fallback)

    setApplications((currentApplications) => upsertApplication(currentApplications, application))
    setSelectedApplication(application)
    return application
  }

  async function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const applicationId = lookupId.trim()

    if (!GUID_PATTERN.test(applicationId)) {
      setLookupError('Укажите applicationId в формате GUID')
      return
    }

    setLookupError('')
    setDetailError('')
    setIsLookupLoading(true)

    try {
      await loadApplication(applicationId)
      setLookupId('')
    } catch (error) {
      setLookupError(getErrorMessage(error, 'Не удалось загрузить заявку'))
    } finally {
      setIsLookupLoading(false)
    }
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

  function updateApplication(application: OnboardingApplication) {
    setApplications((currentApplications) => upsertApplication(currentApplications, application))
    setSelectedApplication(application)
  }

  return (
    <>
      <section className="panel wide">
        <form className="onboarding-lookup" onSubmit={submitLookup}>
          <label>
            <span>Загрузить заявку из API</span>
            <input
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="applicationId"
              aria-label="Application ID"
            />
          </label>
          <button type="submit" className="secondary-action" disabled={isLookupLoading}>
            {isLookupLoading ? 'Загрузка...' : 'Загрузить'}
          </button>
        </form>

        {lookupError ? <p className="panel-error">{lookupError}</p> : null}

        <p className="panel-note">
          В Swagger пока нет отдельной очереди онбординга. Список ниже остается локальной витриной, а заявки по GUID загружаются и ревьюятся через
          внутренние API.
        </p>

        <div className="table-scroll">
          <table className="data-table onboarding-table">
            <thead>
              <tr>
                <th>Провайдер</th>
                <th>Заявитель</th>
                <th>Город</th>
                <th>Статус</th>
                <th>Подано</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
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
                    <small>{application.id}</small>
                  </td>
                  <td>
                    <strong>{application.applicantName}</strong>
                    <small>{application.applicantEmail}</small>
                  </td>
                  <td>{application.city}</td>
                  <td>{application.status}</td>
                  <td>{application.submittedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
      setActionError('Сначала загрузите реальную заявку из API по applicationId')
      return
    }

    if (requiresReason && !normalizedReasonCode) {
      setActionError('Для этого решения нужен reasonCode')
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
            <span>{application.id}</span>
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
                  <th>Provider ID</th>
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
            {!canReview ? <p className="form-note">Действия доступны только для заявки, загруженной из API по GUID.</p> : null}
            <label>
              <span>Reason code</span>
              <input
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                placeholder="required for request_changes/reject"
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
