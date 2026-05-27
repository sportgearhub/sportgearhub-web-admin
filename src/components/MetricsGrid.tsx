import { Card } from './ui/card'

export function MetricsGrid() {
  return (
    <section className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка операционных очередей">
      <Card className="p-3">
        <strong className="block text-2xl font-semibold leading-none">0</strong>
        <span className="mt-1 block text-sm text-muted-foreground">Активных задач нет</span>
      </Card>
    </section>
  )
}
