import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input, Textarea } from '../../../components/ui/input'
import { useNotifications } from '../../../components/ui/notifications-context'
import {
  getProviderCard,
  getProviderPayout,
  postProviderAction,
  postProviderPayoutRegister,
  postProviderPayoutSyncBankAccount,
  type ProviderAction,
  type ProviderCard,
  type ProviderPayout,
  type ProviderPayoutOverrides,
} from '../adminApi'
import { formatDateTime } from '../shared/format'
import { missingFieldLabels, personName, providerStatusLabel, providerStatusVariant, readinessLabels, sellerKindLabel, taxationLabels, vatLabels } from './providerLabels'

type Tab = 'summary' | 'payout' | 'members'

const ACTIONS: Array<{ action: ProviderAction; label: string; from: string[]; needsMessage: boolean; tone?: 'default' | 'destructive' | 'outline' }> = [
  { action: 'approve', label: 'Одобрить', from: ['pending_review'], needsMessage: false },
  { action: 'request_changes', label: 'Запросить изменения', from: ['pending_review', 'active'], needsMessage: true, tone: 'outline' },
  { action: 'reject', label: 'Отклонить', from: ['pending_review'], needsMessage: true, tone: 'destructive' },
  { action: 'reopen', label: 'Вернуть в черновик', from: ['rejected'], needsMessage: false, tone: 'outline' },
  { action: 'suspend', label: 'Приостановить', from: ['active'], needsMessage: false, tone: 'destructive' },
  { action: 'activate', label: 'Возобновить', from: ['suspended'], needsMessage: false },
  { action: 'archive', label: 'В архив', from: ['active', 'suspended'], needsMessage: false, tone: 'outline' },
]

const ACTION_DONE: Record<ProviderAction, string> = {
  approve: 'Кабинет одобрен',
  request_changes: 'Изменения запрошены',
  reject: 'Кабинет отклонён',
  reopen: 'Кабинет возвращён в черновик',
  suspend: 'Кабинет приостановлен',
  activate: 'Кабинет возобновлён',
  archive: 'Кабинет отправлен в архив',
}

type ProviderCardPageProps = {
  providerId: string
  onBack: () => void
  onTopBarContentChange?: (content: React.ReactNode | null) => void
}

/**
 * The cabinet as the reviewer sees it — what the seller sees, plus who is behind it — with the
 * decision in the header and the bank on its own tab.
 */
export function ProviderCardPage({ providerId, onBack, onTopBarContentChange }: ProviderCardPageProps) {
  const { notify } = useNotifications()
  const [card, setCard] = useState<ProviderCard | null>(null)
  const [payout, setPayout] = useState<ProviderPayout | null>(null)
  const [payoutError, setPayoutError] = useState('')
  const [tab, setTab] = useState<Tab>('summary')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<ProviderAction | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextCard, nextPayout] = await Promise.all([
        getProviderCard(providerId),
        getProviderPayout(providerId).then((value) => ({ value, error: '' })).catch((failure: unknown) => ({ value: null, error: failure instanceof Error ? failure.message : 'Не удалось загрузить выплаты' })),
      ])
      setCard(nextCard)
      setPayout(nextPayout.value)
      setPayoutError(nextPayout.error)
      setError('')
    } catch (failure) {
      setCard(null)
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить кабинет')
    } finally {
      setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    onTopBarContentChange?.(
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> Назад
        </Button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">Поставщики</span>
          <span className="shrink-0 text-muted-foreground">›</span>
          <strong className="truncate font-semibold">{card?.profile.displayName ?? 'Кабинет'}</strong>
          {card ? <Badge variant={providerStatusVariant(card.profile.status)}>{providerStatusLabel(card.profile.status)}</Badge> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить" title="Обновить">
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
        </Button>
      </div>,
    )
    return () => onTopBarContentChange?.(null)
  }, [card, loading, load, onBack, onTopBarContentChange])

  async function apply(action: ProviderAction, text?: string) {
    setBusy(true)
    try {
      await postProviderAction(providerId, action, text)
      notify({ tone: 'success', title: ACTION_DONE[action] })
      setPending(null)
      setMessage('')
      await load()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось применить решение', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  async function runPayout(work: () => Promise<ProviderPayout>, done: string) {
    setBusy(true)
    try {
      setPayout(await work())
      setPayoutError('')
      notify({ tone: 'success', title: done })
      const nextCard = await getProviderCard(providerId).catch(() => null)
      if (nextCard) setCard(nextCard)
    } catch (failure) {
      notify({ tone: 'error', title: 'Банк не принял запрос', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !card) {
    return <section className="p-6 text-sm text-muted-foreground">Загружаем кабинет…</section>
  }
  if (!card) {
    return (
      <section className="p-6">
        <h2 className="text-lg font-semibold">Кабинет недоступен</h2>
        <p className="mt-1 text-sm text-destructive">{error}</p>
      </section>
    )
  }

  const status = card.profile.status
  const available = ACTIONS.filter((item) => item.from.includes(status))
  const pendingAction = ACTIONS.find((item) => item.action === pending)

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <div className="flex gap-1" role="tablist">
          {([['summary', 'Обзор'], ['payout', 'Выплаты'], ['members', 'Доступы']] as Array<[Tab, string]>).map(([id, label]) => (
            <Button key={id} type="button" size="sm" variant={tab === id ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</Button>
          ))}
        </div>
        {available.length > 0 ? (
          <div className="ml-auto flex flex-wrap gap-2">
            {available.map((item) => (
              <Button
                key={item.action}
                type="button"
                size="sm"
                variant={item.tone ?? 'default'}
                disabled={busy}
                onClick={() => (item.needsMessage ? setPending(item.action) : void apply(item.action))}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === 'summary' ? <SummaryTab card={card} /> : null}
      {tab === 'payout' ? (
        <PayoutTab
          card={card}
          payout={payout}
          error={payoutError}
          busy={busy}
          onRegister={(overrides) => runPayout(() => postProviderPayoutRegister(providerId, overrides), payout?.registration.method === 'sbp' ? 'Получатель СБП активирован' : 'Точка зарегистрирована в Т-Банке')}
          onSync={() => runPayout(() => postProviderPayoutSyncBankAccount(providerId), 'Счёт обновлён в Т-Банке')}
        />
      ) : null}
      {tab === 'members' ? <MembersTab card={card} /> : null}

      {pendingAction ? (
        <Dialog open onOpenChange={(open) => { if (!open) setPending(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{pendingAction.label}</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid gap-3">
              <p className="text-sm text-muted-foreground">Сообщение увидит продавец в кабинете. Напишите, что именно нужно исправить.</p>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} autoFocus placeholder="Например: укажите адрес пункта проката и добавьте хотя бы одно фото" />
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
    </section>
  )
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b py-2 text-sm last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value ?? '—'}</dd>
    </div>
  )
}

function readinessVariant(status: string) {
  if (status === 'ready') return 'success'
  if (status === 'missing') return 'destructive'
  return 'warning'
}

function SummaryTab({ card }: { card: ProviderCard }) {
  const seller = card.seller
  const business = seller?.business
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <Section title="Кабинет">
        <dl>
          <Row label="Название" value={card.profile.displayName} />
          <Row label="Описание" value={card.profile.description} />
          <Row label="Адрес" value={card.profile.address} />
          <Row label="Создан" value={formatDateTime(card.profile.createdAt)} />
          <Row label="Владелец" value={card.owner ? <>{personName(card.owner)} · {card.owner.phone ?? '—'}{card.owner.email ? <> · {card.owner.email}{card.owner.emailVerified ? ' ✓' : ' (не подтверждена)'}</> : null}</> : '—'} />
        </dl>
      </Section>

      <Section title="Готовность" aside={<Badge variant={card.readiness.canBePaid ? 'success' : card.readiness.isPublic ? 'info' : 'secondary'}>{card.readiness.canBePaid ? 'Может получать выплаты' : card.readiness.isPublic ? 'Виден клиентам' : 'Не опубликован'}</Badge>}>
        <ul className="divide-y text-sm">
          {card.readiness.items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2">
              <span>{readinessLabels[item.key] ?? item.key}{item.hint ? <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span> : null}</span>
              <Badge variant={readinessVariant(item.status)}>{item.status === 'ready' ? 'Готово' : item.status === 'missing' ? 'Нет' : item.status === 'awaiting_registration' ? 'Ждёт банк' : item.status}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Продавец">
        {seller ? (
          <dl>
            <Row label="Форма собственности" value={sellerKindLabel(seller.kind)} />
            <Row label="ИНН" value={seller.inn} />
            {seller.person ? <Row label="ФИО" value={personName(seller.person)} /> : null}
            {business ? (
              <>
                <Row label="Наименование" value={business.legalName} />
                <Row label={seller.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={business.registrationNumber} />
                {seller.company ? <Row label="КПП" value={seller.company.kpp} /> : null}
                <Row label="Адрес регистрации" value={business.legalAddress} />
                <Row label={business.director.position} value={personName(business.director)} />
                <Row label="Налогообложение" value={`${taxationLabels[business.taxationSystem] ?? business.taxationSystem}, ${vatLabels[business.vatRate] ?? business.vatRate}`} />
              </>
            ) : <Row label="Налогообложение" value="НПД" />}
          </dl>
        ) : <p className="text-sm text-muted-foreground">Данные продавца не заполнены.</p>}
      </Section>

      <Section title="Договор и проверки">
        <dl>
          <Row label="Договор" value={card.agreement ? `№ ${card.agreement.number} от ${formatDateTime(card.agreement.acceptedAt)} · ${card.agreement.status === 'active' ? 'действует' : card.agreement.status === 'terminated' ? 'расторгнут' : 'принят, ждёт одобрения'}` : 'не принят'} />
        </dl>
        <h3 className="mt-4 mb-1 text-sm font-semibold">Решения</h3>
        {card.reviews.length === 0 ? <p className="text-sm text-muted-foreground">Проверок ещё не было.</p> : (
          <ul className="divide-y text-sm">
            {card.reviews.map((review, index) => (
              <li key={review.reviewId ?? index} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{review.verdict === 'approved' ? 'Одобрено' : review.verdict === 'changes_requested' ? 'Запрошены изменения' : review.verdict === 'rejected' ? 'Отклонено' : review.verdict ?? 'На проверке'}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(review.decidedAt ?? review.openedAt)}</span>
                </div>
                {review.message ? <p className="mt-1 text-muted-foreground">{review.message}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function PayoutTab({
  card,
  payout,
  error,
  busy,
  onRegister,
  onSync,
}: {
  card: ProviderCard
  payout: ProviderPayout | null
  error: string
  busy: boolean
  onRegister: (overrides: ProviderPayoutOverrides) => Promise<void>
  onSync: () => Promise<void>
}) {
  const [overrides, setOverrides] = useState<ProviderPayoutOverrides>({})
  if (!payout) {
    return <div className="p-4"><p className="text-sm text-destructive">{error || 'Данные о выплатах недоступны.'}</p></div>
  }

  const { details, registration } = payout
  const isSbp = registration.method === 'sbp'
  const preview = registration.preview

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <Section title="Реквизиты продавца" aside={<Badge variant={details.hasDetails ? 'success' : 'secondary'}>{details.hasDetails ? 'Указаны' : 'Не указаны'}</Badge>}>
        <dl>
          <Row label="Способ" value={isSbp ? 'СБП на телефон' : 'Расчётный счёт'} />
          <Row label="Получатель" value={details.beneficiaryName} />
          {isSbp ? (
            <>
              <Row label="Телефон" value={details.phone} />
              <Row label="Банк" value={details.bankName ? `${details.bankName} (${details.sbpMemberId})` : details.sbpMemberId} />
            </>
          ) : (
            <>
              <Row label="Счёт" value={details.account} />
              <Row label="БИК" value={details.bik} />
              <Row label="Банк" value={details.bankName} />
              <Row label="Корр. счёт" value={details.correspondentAccount} />
            </>
          )}
          <Row label="Обновлены" value={formatDateTime(details.updatedAt)} />
        </dl>
      </Section>

      {isSbp ? (
        <Section title="Получатель СБП" aside={<Badge variant={registration.registered ? 'success' : 'secondary'}>{registration.registered ? 'Активен' : 'Не активен'}</Badge>}>
          <p className="text-sm text-muted-foreground">
            Самозанятому в банке ничего регистрировать не нужно: каждая выплата уходит по СБП на телефон и банк из реквизитов. Получатель включается сам, как только реквизиты сохранены и кабинет одобрен.
          </p>
          {!registration.registered && details.hasDetails && card.profile.status === 'active' ? (
            <Button type="button" className="mt-3" disabled={busy} onClick={() => void onRegister({})}>Активировать получателя</Button>
          ) : null}
        </Section>
      ) : registration.registered && registration.shop ? (
        <Section title="Точка в Т-Банке" aside={<Badge variant="success">Зарегистрирована</Badge>}>
          <dl>
            <Row label="Код точки" value={registration.shop.shopCode} />
            <Row label="Название в SMS" value={registration.shop.billingDescriptor} />
            <Row label="Название" value={registration.shop.shortName} />
            <Row label="Руководитель" value={`${registration.shop.ceoName} · ${registration.shop.ceoPhone}`} />
            <Row label="Почта" value={registration.shop.email} />
            <Row label="Юр. адрес" value={registration.shop.legalAddress} />
            <Row label="Счёт в банке" value={`${registration.shop.bankAccount} · БИК ${registration.shop.bik} · ${registration.shop.bankName}`} />
            <Row label="Обновлена" value={formatDateTime(registration.shop.updatedAt)} />
          </dl>
          {registration.bankAccountOutOfSync ? (
            <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>Продавец изменил счёт. В банке зарегистрирован другой — выплаты пойдут на старый, пока не обновить.</p>
              <Button type="button" size="sm" className="mt-2" disabled={busy} onClick={() => void onSync()}>Обновить счёт в Т-Банке</Button>
            </div>
          ) : null}
        </Section>
      ) : (
        <Section title="Регистрация точки в Т-Банке" aside={<Badge variant="warning">Не зарегистрирована</Badge>}>
          {preview ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">Запрос собран из данных продавца, владельца и договора. Проверьте и отправьте.</p>
              <dl>
                <Row label="Название в SMS" value={preview.billingDescriptor} />
                <Row label="Полное наименование" value={preview.fullName} />
                <Row label="Краткое название" value={<Input value={overrides.shortName ?? preview.shortName} onChange={(event) => setOverrides({ ...overrides, shortName: event.target.value })} />} />
                <Row label="ИНН · ОГРН" value={`${preview.inn}${preview.kpp ? ` · КПП ${preview.kpp}` : ''} · ${preview.ogrn}`} />
                <Row label="Юр. адрес" value={[preview.legalAddressZip, preview.legalAddressCity, preview.legalAddressStreet].filter(Boolean).join(', ') || '—'} />
                <Row label="Руководитель" value={`${preview.ceoLastName} ${preview.ceoFirstName}`.trim()} />
                <Row label="Телефон руководителя" value={<Input value={overrides.ceoPhone ?? preview.ceoPhone} onChange={(event) => setOverrides({ ...overrides, ceoPhone: event.target.value })} />} />
                <Row label="Дата рождения" value={<Input type="date" value={overrides.ceoBirthDate ?? preview.ceoBirthDate ?? ''} onChange={(event) => setOverrides({ ...overrides, ceoBirthDate: event.target.value || undefined })} />} />
                <Row label="Почта" value={<Input value={overrides.email ?? preview.email} onChange={(event) => setOverrides({ ...overrides, email: event.target.value })} />} />
                <Row label="Счёт в банке" value={preview.bankAccount ? `${preview.bankAccount} · БИК ${preview.bik} · ${preview.bankName}` : '—'} />
                <Row label="Назначение платежа" value={preview.paymentDetails} />
              </dl>
              {registration.missing.length > 0 ? (
                <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium">Не хватает:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {registration.missing.map((key) => <li key={key}>{missingFieldLabels[key] ?? key}</li>)}
                  </ul>
                </div>
              ) : null}
              <Button type="button" className="mt-3" disabled={busy} onClick={() => void onRegister(overrides)}>Зарегистрировать в Т-Банке</Button>
            </>
          ) : <p className="text-sm text-muted-foreground">Продавец ещё не заполнил данные.</p>}
        </Section>
      )}
    </div>
  )
}

function MembersTab({ card }: { card: ProviderCard }) {
  return (
    <div className="p-4">
      <Section title="Доступы к кабинету">
        {card.members.length === 0 ? <p className="text-sm text-muted-foreground">Никого нет.</p> : (
          <ul className="divide-y text-sm">
            {card.members.map((member) => (
              <li key={member.membershipId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <strong className="block truncate">{personName(member)}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{member.phone ?? '—'}{member.email ? ` · ${member.email}` : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role === 'owner' ? 'Владелец' : member.role === 'manager' ? 'Менеджер' : member.role === 'finance' ? 'Финансы' : 'Сотрудник'}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(member.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
