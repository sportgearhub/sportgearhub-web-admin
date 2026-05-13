import { useState } from 'react'
import { onboardingApplications } from '../../data/adminPrototype'
import type { ConsoleAction, OnboardingApplication } from '../../types/admin'

type OnboardingReviewProps = {
  actions: ConsoleAction[]
  onAction: (action: ConsoleAction) => void
}

export function OnboardingReview({ actions, onAction }: OnboardingReviewProps) {
  const [selectedApplication, setSelectedApplication] = useState<OnboardingApplication | null>(null)

  function openApplication(application: OnboardingApplication) {
    setSelectedApplication(application)
  }

  function openApplicationFromKeyboard(event: React.KeyboardEvent<HTMLTableRowElement>, application: OnboardingApplication) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openApplication(application)
    }
  }

  return (
    <>
      <section className="panel wide">
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
              {onboardingApplications.map((application) => (
                <tr
                  key={application.id}
                  className="clickable-row"
                  tabIndex={0}
                  onClick={() => openApplication(application)}
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
          actions={actions}
          onAction={onAction}
          onClose={() => setSelectedApplication(null)}
        />
      ) : null}
    </>
  )
}

function OnboardingDetailModal({
  application,
  actions,
  onAction,
  onClose,
}: {
  application: OnboardingApplication
  actions: ConsoleAction[]
  onAction: (action: ConsoleAction) => void
  onClose: () => void
}) {
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
                  <th>Статус</th>
                  <td>{application.status}</td>
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
                  <th>ИНН</th>
                  <td>{application.taxId}</td>
                </tr>
                <tr>
                  <th>Город</th>
                  <td>{application.city}</td>
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
          </section>
        </div>

        <footer className="onboarding-modal-actions">
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              className={action.tone === 'danger' ? 'danger-action' : 'secondary-action'}
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </footer>
      </section>
    </div>
  )
}
