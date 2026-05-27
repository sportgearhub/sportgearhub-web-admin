import { Button } from './ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import type { ConsoleAction } from '../types/admin'

type ConsentModalProps = {
  action: ConsoleAction
  operatorEmail: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConsentModal({ action, operatorEmail, onCancel, onConfirm }: ConsentModalProps) {
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        onCancel()
      }
    }}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Подтвердите действие</DialogTitle>
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
    </Dialog>
  )
}
