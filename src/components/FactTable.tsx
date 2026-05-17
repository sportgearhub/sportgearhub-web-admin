import type { FactRow } from '../types/admin'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableRow } from './ui/table'

type FactTableProps = {
  rows: readonly FactRow[]
}

export function FactTable({ rows }: FactTableProps) {
  return (
    <TableFrame>
      <Table className="table-fixed">
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableHead className="w-52 normal-case tracking-normal text-foreground">{label}</TableHead>
              <TableCell>{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  )
}
