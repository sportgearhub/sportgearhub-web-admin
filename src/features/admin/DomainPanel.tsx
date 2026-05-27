import { useState } from 'react'
import { FactTable } from '../../components/FactTable'
import { Panel } from '../../components/Panel'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../components/ui/table'
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
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запись</TableHead>
                <TableHead>Владелец</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Обновлено</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length ? (
                records.map((record) => (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => openRecord(record)}
                    onKeyDown={(event) => openRecordFromKeyboard(event, record)}
                  >
                    <TableCell>
                      <strong className="block font-medium">{record.title}</strong>
                      <small className="text-xs text-muted-foreground">{record.id}</small>
                    </TableCell>
                    <TableCell>{record.owner}</TableCell>
                    <TableCell><Badge variant={record.severity === 'critical' ? 'destructive' : record.severity === 'warning' ? 'warning' : 'info'}>{record.status}</Badge></TableCell>
                    <TableCell>{record.updatedAt}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    В этом разделе пока нет записей.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableFrame>
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
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <div>
            <DialogTitle className="text-xl font-semibold">{record.title}</DialogTitle>
            <span className="text-sm text-muted-foreground">{record.id}</span>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DialogHeader>

        <DialogBody>
          <FactTable rows={record.details} />
        </DialogBody>

        <DialogFooter>
          {actions.map((action) => (
            <Button
              type="button"
              key={action.label}
              variant={action.tone === 'danger' ? 'destructive' : 'outline'}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
