import { Panel } from './Panel'
import type { QueueItem } from '../types/admin'

type OperationalQueuesProps = {
  items: QueueItem[]
}

export function OperationalQueues({ items }: OperationalQueuesProps) {
  return (
    <Panel className="wide">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Владелец</th>
              <th>Статус</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className={`severity ${item.severity}`}></span>
                  <strong>{item.title}</strong>
                  <small>{item.id}</small>
                </td>
                <td>{item.owner}</td>
                <td>{item.status}</td>
                <td>{item.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
