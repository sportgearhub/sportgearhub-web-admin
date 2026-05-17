import { Button } from './ui/button'
import { DialogBackdrop, DialogBody, DialogContent, DialogFooter, DialogHeader } from './ui/dialog'
import type { ConsoleAction } from '../types/admin'

type ConsentModalProps = {
  action: ConsoleAction
  operatorEmail: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConsentModal({ action, operatorEmail, onCancel, onConfirm }: ConsentModalProps) {
  return (
    <DialogBackdrop role="presentation" onMouseDown={onCancel}>
      <DialogContent
        className="max-w-[420px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <h2 id="consent-title" className="text-lg font-semibold">Подтвердите действие</h2>
        </DialogHeader>
        <DialogBody>
          <dl className="grid gap-2 text-sm">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b py-2">
              <dt className="text-muted-foreground">Действие</dt>
              <dd>{action.label}</dd>
            </div>
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2">
              <dt className="text-muted-foreground">Оператор</dt>
              <dd className="truncate">{operatorEmail}</dd>
            </div>
          </dl>
        </DialogBody>
        <DialogFooter className="grid grid-cols-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="button" variant={action.tone === 'danger' ? 'destructive' : 'default'} onClick={onConfirm} autoFocus>
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogBackdrop>
  )
}
