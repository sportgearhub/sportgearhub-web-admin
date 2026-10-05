import { useEffect, useState } from 'react'
import { ArrowRight, ChevronRight, ClipboardList, PackageCheck, Store, UserRound } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import {
  getProductReviewQueue,
  getSellers,
  getSellerReviewQueue,
  rsqlStatus,
  type ProductReviewQueueItem,
  type SellerReviewQueueItem,
} from '../adminApi'
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
  const [pendingSellers, setPendingSellers] = useState<SellerReviewQueueItem[] | null>(null)
  const [pendingSellersTotal, setPendingSellersTotal] = useState<number | null>(null)
  const [products, setProducts] = useState<ProductReviewQueueItem[] | null>(null)
  const [productsTotal, setProductsTotal] = useState<number | null>(null)
  const [changesTotal, setChangesTotal] = useState<number | null>(null)
  const [activeTotal, setActiveTotal] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // The pending queue previews double as the count source via pagination.totalItems.
    getSellerReviewQueue('pending_review', { pageSize: 6 })
      .then((result) => { setPendingSellers(result.items); setPendingSellersTotal(result.pagination.totalItems) })
      .catch((failure) => setError(failure instanceof Error ? failure.message : 'Не удалось загрузить сводку'))
    getProductReviewQueue('pending_review', { pageSize: 6 })
      .then((result) => { setProducts(result.items); setProductsTotal(result.pagination.totalItems) })
      .catch(() => { setProducts([]); setProductsTotal(null) })
    // Status-only counts: one cheap page each, read the total.
    getSellers({ filter: rsqlStatus('changes_requested'), pageSize: 1 }).then((r) => setChangesTotal(r.pagination.totalItems)).catch(() => setChangesTotal(null))
    getSellers({ filter: rsqlStatus('active'), pageSize: 1 }).then((r) => setActiveTotal(r.pagination.totalItems)).catch(() => setActiveTotal(null))
  }, [])

  const stats: Stat[] = [
    { key: 'pending', label: 'Продавцы на проверке', value: pendingSellersTotal, hint: 'ждут решения', icon: UserRound, onClick: onOpenOnboarding },
    { key: 'products', label: 'Товары на проверке', value: productsTotal, hint: 'карточек на модерации', icon: PackageCheck, onClick: onOpenProducts },
    { key: 'changes', label: 'Ждут доработки', value: changesTotal, hint: 'вернули продавцу', icon: ClipboardList, onClick: onOpenOnboarding },
    { key: 'active', label: 'Активные кабинеты', value: activeTotal, hint: 'на витрине', icon: Store, onClick: onOpenSellers },
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
              className="group flex flex-col gap-3 border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
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
          count={pendingSellersTotal}
          onOpenAll={onOpenOnboarding}
          loading={pendingSellers === null}
          emptyText="Нет заявок на проверке."
          items={(pendingSellers ?? []).map((seller) => ({
            id: seller.sellerId,
            onClick: () => onOpenSeller(seller.sellerId),
            title: seller.displayName,
            meta: [sellerKindLabel(seller.sellerKind), seller.legalName ?? seller.inn ?? ''].filter(Boolean).join(' · '),
            aside: seller.openedAt ? `с ${formatDateTime(seller.openedAt)}` : '',
          }))}
        />
        <QueueCard
          title="Товары на проверке"
          subtitle="Старые — сверху"
          icon={PackageCheck}
          count={productsTotal}
          onOpenAll={onOpenProducts}
          loading={products === null}
          emptyText="Нет карточек на модерации."
          items={(products ?? []).map((product) => ({
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
    <section className="flex flex-col border bg-card">
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
