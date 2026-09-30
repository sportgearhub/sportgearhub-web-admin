import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { getProductReviewQueue, getSellers, type SellerListItem } from '../adminApi'

type Tile = { label: string; value: number | null; hint: string; onClick?: () => void }

/** A few numbers that say what needs a human today, and nothing that does not. */
export function OverviewPage({ onOpenOnboarding, onOpenSellers, onOpenProducts }: { onOpenOnboarding: () => void; onOpenSellers: () => void; onOpenProducts: () => void }) {
  const [rows, setRows] = useState<SellerListItem[] | null>(null)
  const [productsPending, setProductsPending] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getSellers()
      .then(setRows)
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сводку'))
    getProductReviewQueue('pending_review')
      .then((items) => setProductsPending(items.length))
      .catch(() => setProductsPending(null))
  }, [])

  const pending = rows?.filter((row) => row.status === 'pending_review').length ?? 0
  const awaitingBank = rows?.filter((row) => row.status === 'active' && row.payoutDetailsPresent && !row.payoutRegistered).length ?? 0
  const active = rows?.filter((row) => row.status === 'active').length ?? 0
  const payable = rows?.filter((row) => row.canBePaid).length ?? 0

  const tiles: Tile[] = [
    { label: 'Продавцы на проверке', value: rows ? pending : null, hint: 'кабинетов ждут решения', onClick: onOpenOnboarding },
    { label: 'Товары на проверке', value: productsPending, hint: 'карточек ждут модерации', onClick: onOpenProducts },
    { label: 'Ждут регистрации в банке', value: rows ? awaitingBank : null, hint: 'реквизиты есть, точка не зарегистрирована', onClick: onOpenSellers },
    { label: 'Активных кабинетов', value: rows ? active : null, hint: `${payable} могут получать выплаты`, onClick: onOpenSellers },
  ]

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-background p-4">
      {error ? <p className="mb-3 text-sm font-medium text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className={tile.onClick ? 'cursor-pointer transition hover:border-primary/40' : undefined} onClick={tile.onClick}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{tile.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{tile.value ?? '…'}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
