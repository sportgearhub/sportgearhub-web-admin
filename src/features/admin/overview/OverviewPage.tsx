import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { getProviders, type ProviderListItem } from '../adminApi'

type Tile = { label: string; value: number; hint: string; onClick?: () => void }

/** Three numbers that say what needs a human today, and nothing that does not. */
export function OverviewPage({ onOpenOnboarding, onOpenProviders }: { onOpenOnboarding: () => void; onOpenProviders: () => void }) {
  const [rows, setRows] = useState<ProviderListItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getProviders()
      .then(setRows)
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сводку'))
  }, [])

  const pending = rows?.filter((row) => row.status === 'pending_review').length ?? 0
  const awaitingBank = rows?.filter((row) => row.status === 'active' && row.payoutDetailsPresent && !row.payoutRegistered).length ?? 0
  const active = rows?.filter((row) => row.status === 'active').length ?? 0
  const payable = rows?.filter((row) => row.canBePaid).length ?? 0

  const tiles: Tile[] = [
    { label: 'На проверке', value: pending, hint: 'кабинетов ждут решения', onClick: onOpenOnboarding },
    { label: 'Ждут регистрации в банке', value: awaitingBank, hint: 'реквизиты есть, точка не зарегистрирована', onClick: onOpenProviders },
    { label: 'Активных кабинетов', value: active, hint: `${payable} могут получать выплаты`, onClick: onOpenProviders },
  ]

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-background p-4">
      {error ? <p className="mb-3 text-sm font-medium text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className={tile.onClick ? 'cursor-pointer transition hover:border-primary/40' : undefined} onClick={tile.onClick}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{tile.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{rows ? tile.value : '…'}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
