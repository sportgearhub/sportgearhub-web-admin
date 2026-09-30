import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed, RefreshCw, X } from 'lucide-react'
import { Badge, type BadgeProps } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Textarea } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { useNotifications } from '../../../components/ui/notifications-context'
import {
  getProductReviewCard,
  getProductReviewQueue,
  postProductAction,
  type ProductAction,
  type ProductReviewCard,
  type ProductReviewQueueItem,
  type ProductStatus,
} from '../adminApi'
import { formatDateTime } from '../shared/format'

const TABS: Array<{ status: ProductStatus; label: string }> = [
  { status: 'pending_review', label: 'На проверке' },
  { status: 'changes_requested', label: 'Нужны изменения' },
  { status: 'rejected', label: 'Отклонённые' },
  { status: 'active', label: 'Активные' },
]

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  changes_requested: 'Нужны изменения',
  rejected: 'Отклонён',
  active: 'Активен',
  paused: 'На паузе',
  suspended: 'Снят',
  archived: 'В архиве',
}

function productStatusLabel(status: ProductStatus) {
  return PRODUCT_STATUS_LABELS[status] ?? status
}

function productStatusVariant(status: ProductStatus): BadgeProps['variant'] {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending_review':
    case 'changes_requested':
      return 'warning'
    case 'rejected':
    case 'suspended':
      return 'destructive'
    case 'archived':
    case 'paused':
      return 'outline'
    default:
      return 'secondary'
  }
}

export function ProductReviewPage() {
  const [status, setStatus] = useState<ProductStatus>('pending_review')
  const [rows, setRows] = useState<ProductReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openProductId, setOpenProductId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProductReviewQueue(status))
      setError('')
    } catch (failure) {
      setRows([])
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить очередь')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        <div className="flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <Button key={tab.status} type="button" size="sm" variant={status === tab.status ? 'secondary' : 'ghost'} role="tab" aria-selected={status === tab.status} onClick={() => setStatus(tab.status)}>
              {tab.label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить">
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Карточка</TableHead>
              <TableHead className="w-[28%]">Продавец</TableHead>
              <TableHead className="w-[16%]">Статус</TableHead>
              <TableHead className="w-[16%]">Подана</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Загружаем…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Карточек нет.</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.productId} className="cursor-pointer" onClick={() => setOpenProductId(row.productId)}>
                <TableCell>
                  <strong className="block truncate text-sm font-medium">{row.title}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{row.productId}</small>
                </TableCell>
                <TableCell className="text-sm">{row.sellerDisplayName}</TableCell>
                <TableCell><Badge variant={productStatusVariant(row.status)}>{productStatusLabel(row.status)}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.submittedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      {openProductId ? (
        <ProductReviewModal
          productId={openProductId}
          onClose={() => setOpenProductId(null)}
          onDecided={() => { setOpenProductId(null); void load() }}
        />
      ) : null}
    </section>
  )
}

const ACTIONS: Array<{ action: ProductAction; label: string; from: string[]; needsMessage: boolean; tone?: 'default' | 'destructive' | 'outline' }> = [
  { action: 'approve', label: 'Одобрить', from: ['pending_review'], needsMessage: false },
  { action: 'request_changes', label: 'Запросить изменения', from: ['pending_review'], needsMessage: true, tone: 'outline' },
  { action: 'reject', label: 'Отклонить', from: ['pending_review'], needsMessage: true, tone: 'destructive' },
  { action: 'suspend', label: 'Снять с витрины', from: ['active'], needsMessage: false, tone: 'destructive' },
]

const ACTION_DONE: Record<ProductAction, string> = {
  approve: 'Карточка одобрена',
  request_changes: 'Изменения запрошены',
  reject: 'Карточка отклонена',
  suspend: 'Карточка снята с витрины',
}

function ProductReviewModal({ productId, onClose, onDecided }: { productId: string; onClose: () => void; onDecided: () => void }) {
  const { notify } = useNotifications()
  const [card, setCard] = useState<ProductReviewCard | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ProductAction | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    getProductReviewCard(productId)
      .then((value) => { if (mounted) { setCard(value); setError('') } })
      .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить карточку') })
    return () => { mounted = false }
  }, [productId])

  async function apply(action: ProductAction, text?: string) {
    setBusy(true)
    try {
      await postProductAction(productId, action, text)
      notify({ tone: 'success', title: ACTION_DONE[action] })
      onDecided()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось применить решение', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const available = card ? ACTIONS.filter((item) => item.from.includes(card.status)) : []
  const pendingAction = ACTIONS.find((item) => item.action === pending)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[860px]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl font-semibold">{card?.title ?? 'Карточка'}</DialogTitle>
            <span className="block truncate text-sm text-muted-foreground">{card ? card.sellerDisplayName : productId}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></Button>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          {card ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant={productStatusVariant(card.status)}>{productStatusLabel(card.status)}</Badge>
                <span className="text-muted-foreground">Количество: {card.quantity}</span>
              </div>
              {card.description ? <p className="text-sm">{card.description}</p> : null}

              <section>
                <h3 className="mb-2 text-sm font-semibold">Разделы карточки</h3>
                <ul className="divide-y rounded-sm border text-sm">
                  {card.sections.map((section) => (
                    <li key={section.key} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <span className="flex items-center gap-2">
                          {section.isComplete
                            ? <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                            : <CircleDashed size={15} className="shrink-0 text-amber-500" aria-hidden="true" />}
                          {section.title}
                        </span>
                        {section.missing ? <span className="mt-0.5 block pl-6 text-xs text-muted-foreground">{section.missing}</span> : null}
                      </div>
                      <Badge variant={section.isComplete ? 'success' : 'warning'}>{section.isComplete ? 'Готово' : 'Неполно'}</Badge>
                    </li>
                  ))}
                </ul>
              </section>

              {card.history.length ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Решения</h3>
                  <ul className="divide-y text-sm">
                    {card.history.map((review, index) => (
                      <li key={index} className="py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{review.verdict === 'approved' ? 'Одобрено' : review.verdict === 'changes_requested' ? 'Запрошены изменения' : review.verdict === 'rejected' ? 'Отклонено' : review.verdict ?? 'На проверке'}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(review.decidedAt ?? review.openedAt)}</span>
                        </div>
                        {review.message ? <p className="mt-1 text-muted-foreground">{review.message}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : !error ? <p className="text-sm text-muted-foreground">Загружаем карточку…</p> : null}
        </DialogBody>
        {available.length ? (
          <DialogFooter>
            {available.map((item) => (
              <Button
                key={item.action}
                type="button"
                variant={item.tone === 'destructive' ? 'destructive' : item.tone === 'outline' ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => (item.needsMessage ? setPending(item.action) : void apply(item.action))}
              >
                {item.label}
              </Button>
            ))}
          </DialogFooter>
        ) : null}

        {pendingAction ? (
          <Dialog open onOpenChange={(open) => { if (!open) setPending(null) }}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{pendingAction.label}</DialogTitle></DialogHeader>
              <DialogBody className="grid gap-3">
                <p className="text-sm text-muted-foreground">Сообщение увидит продавец. Напишите, что именно не так с карточкой.</p>
                <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} autoFocus placeholder="Например: на фотографии другой велосипед" />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>Отмена</Button>
                <Button type="button" variant={pendingAction.tone === 'destructive' ? 'destructive' : 'default'} disabled={busy || !message.trim()} onClick={() => void apply(pendingAction.action, message.trim())}>
                  {pendingAction.label}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
