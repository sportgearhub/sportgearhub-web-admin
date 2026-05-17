import { Panel } from './Panel'
import { Badge } from './ui/badge'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from './ui/table'
import type { QueueItem } from '../types/admin'

type OperationalQueuesProps = {
  items: QueueItem[]
}

export function OperationalQueues({ items }: OperationalQueuesProps) {
  return (
    <Panel className="wide">
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Владелец</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Обновлено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length ? (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <strong className="block font-medium">{item.title}</strong>
                    <small className="text-xs text-muted-foreground">{item.id}</small>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell><Badge variant={item.severity === 'critical' ? 'destructive' : item.severity === 'warning' ? 'warning' : 'info'}>{item.status}</Badge></TableCell>
                  <TableCell>{item.updatedAt}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Активных задач нет.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>
    </Panel>
  )
}
