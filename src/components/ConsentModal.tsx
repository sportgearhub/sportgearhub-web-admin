import type { ConsoleAction } from '../types/admin'

type ConsentModalProps = {
  action: ConsoleAction
  operatorEmail: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConsentModal({ action, operatorEmail, onCancel, onConfirm }: ConsentModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="consent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="consent-title">Подтвердите действие</h2>
        <dl>
          <div>
            <dt>Действие</dt>
            <dd>{action.label}</dd>
          </div>
          <div>
            <dt>Оператор</dt>
            <dd>{operatorEmail}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={action.tone === 'danger' ? 'danger-action' : 'primary-action'} onClick={onConfirm} autoFocus>
            Подтвердить
          </button>
        </div>
      </section>
    </div>
  )
}
