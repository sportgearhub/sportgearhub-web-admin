import type { Severity } from '../types/admin'

const metrics: Array<{ value: string; label: string; status: Severity }> = [
  { value: '7', label: 'Онбординг ждет проверки', status: 'warning' },
  { value: '3', label: 'Блокеры запуска', status: 'critical' },
  { value: '5', label: 'Инциденты сверки', status: 'critical' },
  { value: '2', label: 'Предупреждения ледгера', status: 'warning' },
]

export function MetricsGrid() {
  return (
    <section className="metrics-grid" aria-label="Сводка операционных очередей">
      {metrics.map((metric) => (
        <article className="metric" key={metric.label}>
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
          <i className={`severity ${metric.status}`} aria-hidden="true"></i>
        </article>
      ))}
    </section>
  )
}
