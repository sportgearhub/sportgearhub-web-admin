import { Card } from './ui/card'

export function MetricsGrid() {
  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка операционных очередей">
      <Card className="p-4">
        <strong className="block text-3xl font-semibold leading-none">0</strong>
        <span className="mt-2 block text-sm text-muted-foreground">Активных задач нет</span>
      </Card>
    </section>
  )
}
