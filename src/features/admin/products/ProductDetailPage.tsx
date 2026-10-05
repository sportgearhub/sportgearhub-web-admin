import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Textarea } from '../../../components/ui/input'
import { useNotifications } from '../../../components/ui/notifications-context'
import { getProductReviewCard, postProductAction, type ProductAction, type ProductReviewCard } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'
import { productStatusLabel, productStatusVariant } from './productLabels'

// Driven by the product transition table in docs/admin-api-integration.md.
const ACTIONS: Array<{ action: ProductAction; label: string; from: string[]; needsMessage: boolean; tone?: 'default' | 'destructive' | 'outline' }> = [
  { action: 'approve', label: 'Одобрить', from: ['pending_review'], needsMessage: false },
  { action: 'request_changes', label: 'Запросить изменения', from: ['pending_review', 'active'], needsMessage: true, tone: 'outline' },
  { action: 'reject', label: 'Отклонить', from: ['pending_review', 'active'], needsMessage: true, tone: 'destructive' },
  { action: 'restore', label: 'Вернуть из снятых', from: ['suspended'], needsMessage: false },
  { action: 'revert', label: 'Отменить решение', from: ['changes_requested', 'rejected'], needsMessage: false, tone: 'outline' },
  { action: 'suspend', label: 'Снять с витрины', from: ['pending_review', 'active', 'paused', 'changes_requested', 'rejected'], needsMessage: false, tone: 'destructive' },
]

const ACTION_DONE: Record<ProductAction, string> = {
  approve: 'Карточка одобрена',
  request_changes: 'Изменения запрошены',
  reject: 'Карточка отклонена',
  suspend: 'Карточка снята с витрины',
  restore: 'Карточка возвращена из снятых',
  revert: 'Решение отменено',
}

export function ProductDetailPage({ productId, onBack, onOpenSeller }: { productId: string; onBack: () => void; onOpenSeller: (sellerId: string) => void }) {
  const { notify } = useNotifications()
  const [card, setCard] = useState<ProductReviewCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ProductAction | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getProductReviewCard(productId)
        .then((value) => { if (mounted) { setCard(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить карточку') })
        .finally(() => { if (mounted) setLoading(false) })
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [productId])

  async function apply(action: ProductAction, text?: string) {
    setBusy(true)
    try {
      const next = await postProductAction(productId, action, text)
      setCard(next)
      notify({ tone: 'success', title: ACTION_DONE[action] })
      setPending(null)
      setMessage('')
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось применить решение', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const available = card ? ACTIONS.filter((item) => item.from.includes(card.status)) : []
  const pendingAction = ACTIONS.find((item) => item.action === pending)

  return (
    <DetailScreen
      onBack={onBack}
      title={card?.title ?? 'Карточка'}
      subtitle={card?.sellerDisplayName}
      badges={card ? <Badge variant={productStatusVariant(card.status)}>{productStatusLabel(card.status)}</Badge> : null}
      loading={loading}
      error={error}
      actions={card ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenSeller(card.sellerId)}>Продавец</Button>
          {available.map((item) => (
            <Button
              key={item.action}
              type="button"
              size="sm"
              variant={item.tone === 'destructive' ? 'destructive' : item.tone === 'outline' ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => (item.needsMessage ? setPending(item.action) : void apply(item.action))}
            >
              {item.label}
            </Button>
          ))}
        </>
      ) : null}
    >
      {card ? (
        <PanelGrid>
          <Panel title="Карточка">
            <dl>
              <Field label="Статус" value={<Badge variant={productStatusVariant(card.status)}>{productStatusLabel(card.status)}</Badge>} />
              <Field label="Количество" value={card.quantity} />
              <Field label="Описание" value={card.description} />
            </dl>
          </Panel>

          <Panel title="Текущий запрос">
            {card.review ? (
              <dl>
                <Field label="Сообщение продавцу" value={card.review.message} />
                <Field label="Отправлен" value={formatDateTime(card.review.decidedAt)} />
              </dl>
            ) : <p className="text-sm text-muted-foreground">Открытых запросов к продавцу нет. Статус карточки и есть решение.</p>}
          </Panel>

          <Panel title="Разделы карточки" className="lg:col-span-2">
            <ul className="divide-y text-sm">
              {card.sections.map((section) => (
                <li key={section.key} className="flex items-start justify-between gap-3 py-2.5">
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
          </Panel>
        </PanelGrid>
      ) : null}

      {pendingAction ? (
        <Dialog open onOpenChange={(open) => { if (!open) setPending(null) }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{pendingAction.label}</DialogTitle></DialogHeader>
            <DialogBody className="grid gap-3">
              <p className="text-sm text-muted-foreground">Сообщение увидит продавец. Напишите, что именно не так с карточкой.</p>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} autoFocus placeholder="Например: на фотографии другой велосипед" />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>Отмена</Button>
              <Button type="button" variant={pendingAction.tone === 'destructive' ? 'destructive' : 'default'} disabled={busy || !message.trim()} onClick={() => void apply(pendingAction.action, message.trim())}>{pendingAction.label}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </DetailScreen>
  )
}
