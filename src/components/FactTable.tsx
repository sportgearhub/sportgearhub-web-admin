import type { FactRow } from '../types/admin'

type FactTableProps = {
  rows: readonly FactRow[]
}

export function FactTable({ rows }: FactTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table key-value-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
