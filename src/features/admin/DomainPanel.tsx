import { useState } from 'react'
import { FactTable } from '../../components/FactTable'
import { Panel } from '../../components/Panel'
import type { ConsoleAction, SectionRecord } from '../../types/admin'

type DomainPanelProps = {
  actions: ConsoleAction[]
  onAction: (action: ConsoleAction) => void
}

export function DomainPanel({ actions, onAction }: DomainPanelProps) {
  const [selectedRecord, setSelectedRecord] = useState<SectionRecord | null>(null)
  const records: SectionRecord[] = []

  function openRecord(record: SectionRecord) {
    setSelectedRecord(record)
  }

  function openRecordFromKeyboard(event: React.KeyboardEvent<HTMLTableRowElement>, record: SectionRecord) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openRecord(record)
    }
  }

  return (
    <>
      <Panel className="wide">
        <div className="table-scroll">
          <table className="data-table section-record-table">
            <thead>
              <tr>
                <th>Запись</th>
                <th>Владелец</th>
                <th>Статус</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className="clickable-row"
                    tabIndex={0}
                    onClick={() => openRecord(record)}
                    onKeyDown={(event) => openRecordFromKeyboard(event, record)}
                  >
                    <td>
                      {record.severity ? <span className={`severity ${record.severity}`} aria-hidden="true"></span> : null}
                      <strong>{record.title}</strong>
                      <small>{record.id}</small>
                    </td>
                    <td>{record.owner}</td>
                    <td>{record.status}</td>
                    <td>{record.updatedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-table-cell">
                    В этом разделе пока нет записей.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selectedRecord ? (
        <SectionDetailModal
          record={selectedRecord}
          actions={actions}
          onAction={onAction}
          onClose={() => setSelectedRecord(null)}
        />
      ) : null}
    </>
  )
}

function SectionDetailModal({
  record,
  actions,
  onAction,
  onClose,
}: {
  record: SectionRecord
  actions: ConsoleAction[]
  onAction: (action: ConsoleAction) => void
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-modal-header">
          <div>
            <h2 id="detail-title">{record.title}</h2>
            <span>{record.id}</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="detail-modal-body">
          <FactTable rows={record.details} />
        </div>

        <footer className="detail-modal-actions">
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
