import { useEffect, useState } from 'react'
import { ArrowRight, Banknote, ChevronRight, PackageCheck, Store, UserRound } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { getProductReviewQueue, getSellers, type ProductReviewQueueItem, type SellerListItem } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { sellerKindLabel } from '../sellers/sellerLabels'

type OverviewPageProps = {
  onOpenOnboarding: () => void
  onOpenSellers: () => void
  onOpenProducts: () => void
  onOpenSeller: (sellerId: string) => void
}

type Stat = { key: string; label: string; value: number | null; hint: string; icon: typeof Store; onClick: () => void }

export function OverviewPage({ onOpenOnboarding, onOpenSellers, onOpenProducts, onOpenSeller }: OverviewPageProps) {
  const [sellers, setSellers] = useState<SellerListItem[] | null>(null)
  const [products, setProducts] = useState<ProductReviewQueueItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getSellers()
      .then(setSellers)
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сводку'))
    getProductReviewQueue('pending_review').then(setProducts).catch(() => setProducts([]))
  }, [])

  const pendingSellers = (sellers ?? [])
    .filter((row) => row.status === 'pending_review')
    .sort((a, b) => (a.reviewOpenedAt ?? a.createdAt).localeCompare(b.reviewOpenedAt ?? b.createdAt))
  const awaitingBank = (sellers ?? []).filter((row) => row.status === 'active' && row.payoutDetailsPresent && !row.payoutRegistered)
  const active = (sellers ?? []).filter((row) => row.status === 'active')
  const payable = (sellers ?? []).filter((row) => row.canBePaid)

  const stats: Stat[] = [
    { key: 'sellers', label: 'Продавцы на проверке', value: sellers ? pendingSellers.length : null, hint: 'ждут решения', icon: UserRound, onClick: onOpenOnboarding },
    { key: 'products', label: 'Товары на проверке', value: products ? products.length : null, hint: 'карточек на модерации', icon: PackageCheck, onClick: onOpenProducts },
    { key: 'bank', label: 'Ждут регистрации в банке', value: sellers ? awaitingBank.length : null, hint: 'реквизиты есть, точка — нет', icon: Banknote, onClick: onOpenSellers },
    { key: 'active', label: 'Активных кабинетов', value: sellers ? active.length : null, hint: `${payable.length} могут получать выплаты`, icon: Store, onClick: onOpenSellers },
  ]

  return (
    <section className="space-y-4 p-3 sm:p-4 lg:p-6">
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <button
              key={stat.key}
              type="button"
              onClick={stat.onClick}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={18} /></span>
                <ArrowRight size={16} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div>
                <div className="text-3xl font-semibold tabular-nums leading-none">{stat.value ?? '—'}</div>
                <div className="mt-1.5 text-sm font-medium">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.hint}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QueueCard
          title="Заявки продавцов"
          subtitle="Старые — сверху"
          icon={UserRound}
          count={sellers ? pendingSellers.length : null}
          onOpenAll={onOpenOnboarding}
          loading={sellers === null}
          emptyText="Нет заявок на проверке."
          items={pendingSellers.slice(0, 6).map((seller) => ({
            id: seller.sellerId,
            onClick: () => onOpenSeller(seller.sellerId),
            title: seller.displayName,
            meta: [sellerKindLabel(seller.sellerKind), seller.legalName ?? seller.inn ?? ''].filter(Boolean).join(' · '),
            aside: seller.reviewOpenedAt ? `с ${formatDateTime(seller.reviewOpenedAt)}` : '',
          }))}
        />
        <QueueCard
          title="Товары на проверке"
          subtitle="Старые — сверху"
          icon={PackageCheck}
          count={products ? products.length : null}
          onOpenAll={onOpenProducts}
          loading={products === null}
          emptyText="Нет карточек на модерации."
          items={(products ?? []).slice(0, 6).map((product) => ({
            id: product.productId,
            onClick: onOpenProducts,
            title: product.title,
            meta: product.sellerDisplayName,
            aside: formatDateTime(product.submittedAt),
          }))}
        />
      </div>
    </section>
  )
}

type QueueItem = { id: string; onClick: () => void; title: string; meta: string; aside: string }

function QueueCard({ title, subtitle, icon: Icon, count, items, loading, emptyText, onOpenAll }: {
  title: string
  subtitle: string
  icon: typeof Store
  count: number | null
  items: QueueItem[]
  loading: boolean
  emptyText: string
  onOpenAll: () => void
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {count !== null ? <Badge variant={count ? 'warning' : 'secondary'}>{count}</Badge> : null}
        <button type="button" onClick={onOpenAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Все <ArrowRight size={13} />
        </button>
      </header>
      {loading ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Загружаем…</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={item.onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-medium">{item.title}</strong>
                  {item.meta ? <span className="block truncate text-xs text-muted-foreground">{item.meta}</span> : null}
                </div>
                {item.aside ? <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{item.aside}</span> : null}
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
