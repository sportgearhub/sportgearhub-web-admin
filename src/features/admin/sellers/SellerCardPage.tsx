import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input, Textarea } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { useNotifications } from '../../../components/ui/notifications-context'
import {
  getSeller,
  getSellerPayout,
  postSellerAction,
  postSellerDealBinding,
  postSellerDealBindingAction,
  postSellerPayoutDestinationAction,
  postSellerPayoutRegister,
  postSellerPayoutSyncBankAccount,
  type DealBinding,
  type DealBindingMode,
  type SellerAction,
  type SellerCard,
  type SellerPayout,
  type SellerPayoutOverrides,
} from '../adminApi'
import { formatDateTime } from '../shared/format'
import { DetailScreen } from '../shared/detail'
import {
  memberRoleLabel,
  missingFieldLabels,
  personName,
  readinessLabels,
  readinessStatusLabel,
  readinessStatusVariant,
  sellerKindLabel,
  sellerStatusLabel,
  sellerStatusVariant,
  taxationLabels,
  vatLabels,
} from './sellerLabels'

type Tab = 'summary' | 'payout' | 'acquiring' | 'members'

// The transition table from docs/admin-api-integration.md — anything else answers 409, so a button
// that would 409 is simply not shown. `archive` is terminal, so it is confirmed before it fires.
const ACTIONS: Array<{ action: SellerAction; label: string; from: string[]; needsMessage: boolean; needsConfirm?: boolean; tone?: 'default' | 'destructive' | 'outline' }> = [
  { action: 'approve', label: 'Одобрить', from: ['pending_review'], needsMessage: false },
  { action: 'request_changes', label: 'Запросить изменения', from: ['pending_review', 'active'], needsMessage: true, tone: 'outline' },
  { action: 'reject', label: 'Отклонить', from: ['pending_review'], needsMessage: true, tone: 'destructive' },
  { action: 'reopen', label: 'Вернуть в черновик', from: ['rejected'], needsMessage: false, tone: 'outline' },
  { action: 'suspend', label: 'Приостановить', from: ['active'], needsMessage: false, tone: 'destructive' },
  { action: 'activate', label: 'Возобновить', from: ['suspended'], needsMessage: false },
  { action: 'archive', label: 'В архив', from: ['active', 'suspended'], needsMessage: false, needsConfirm: true, tone: 'outline' },
]

const ACTION_DONE: Record<SellerAction, string> = {
  approve: 'Кабинет одобрен',
  request_changes: 'Изменения запрошены',
  reject: 'Кабинет отклонён',
  reopen: 'Кабинет возвращён в черновик',
  suspend: 'Кабинет приостановлен',
  activate: 'Кабинет возобновлён',
  archive: 'Кабинет отправлен в архив',
}

type SellerCardPageProps = {
  sellerId: string
  onBack: () => void
}

/**
 * The cabinet as the reviewer sees it — what the seller sees, plus who is behind it — with the
 * decision in the header, the bank on its own tab, and the acquirer bindings on theirs.
 */
export function SellerCardPage({ sellerId, onBack }: SellerCardPageProps) {
  const { notify } = useNotifications()
  const [card, setCard] = useState<SellerCard | null>(null)
  const [payout, setPayout] = useState<SellerPayout | null>(null)
  const [payoutError, setPayoutError] = useState('')
  const [tab, setTab] = useState<Tab>('summary')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<SellerAction | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextCard, nextPayout] = await Promise.all([
        getSeller(sellerId),
        getSellerPayout(sellerId).then((value) => ({ value, error: '' })).catch((failure: unknown) => ({ value: null, error: failure instanceof Error ? failure.message : 'Не удалось загрузить выплаты' })),
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
  }, [sellerId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function apply(action: SellerAction, text?: string) {
    setBusy(true)
    try {
      await postSellerAction(sellerId, action, text)
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

  async function runPayout(work: () => Promise<SellerPayout>, done: string) {
    setBusy(true)
    try {
      setPayout(await work())
      setPayoutError('')
      notify({ tone: 'success', title: done })
      const nextCard = await getSeller(sellerId).catch(() => null)
      if (nextCard) setCard(nextCard)
    } catch (failure) {
      notify({ tone: 'error', title: 'Банк не принял запрос', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const available = card ? ACTIONS.filter((item) => item.from.includes(card.profile.status)) : []
  const pendingAction = ACTIONS.find((item) => item.action === pending)

  return (
    <DetailScreen
      onBack={onBack}
      title={card?.profile.displayName ?? 'Кабинет'}
      subtitle={card ? sellerKindLabel(card.seller?.kind) : undefined}
      badges={card ? <Badge variant={sellerStatusVariant(card.profile.status)}>{sellerStatusLabel(card.profile.status)}</Badge> : null}
      loading={loading && !card}
      error={!card ? error : undefined}
      actions={card ? (
        <>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void load()} aria-label="Обновить" title="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
          {available.map((item) => (
            <Button key={item.action} type="button" size="sm" variant={item.tone ?? 'default'} disabled={busy} onClick={() => (item.needsMessage || item.needsConfirm ? setPending(item.action) : void apply(item.action))}>{item.label}</Button>
          ))}
        </>
      ) : null}
    >
      {card ? (
        <>
          <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1" role="tablist">
            {([['summary', 'Обзор'], ['payout', 'Выплаты'], ['acquiring', 'Эквайринг'], ['members', 'Доступы']] as Array<[Tab, string]>).map(([id, label]) => (
              <Button key={id} type="button" size="sm" variant={tab === id ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="shrink-0">{label}</Button>
            ))}
          </div>

          {tab === 'summary' ? <SummaryTab card={card} /> : null}
          {tab === 'payout' ? (
            <PayoutTab
              card={card}
              payout={payout}
              error={payoutError}
              busy={busy}
              onRegister={(overrides) => runPayout(() => postSellerPayoutRegister(sellerId, overrides), payout?.registration.method === 'sbp' ? 'Получатель СБП активирован' : 'Точка зарегистрирована в Т-Банке')}
              onSync={() => runPayout(() => postSellerPayoutSyncBankAccount(sellerId), 'Счёт обновлён в Т-Банке')}
            />
          ) : null}
          {tab === 'acquiring' ? <AcquiringTab sellerId={sellerId} /> : null}
          {tab === 'members' ? <MembersTab card={card} /> : null}
        </>
      ) : null}

      {pendingAction ? (
        <Dialog open onOpenChange={(open) => { if (!open) setPending(null) }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{pendingAction.label}</DialogTitle>
            </DialogHeader>
            <DialogBody className="grid gap-3">
              {pendingAction.needsMessage ? (
                <>
                  <p className="text-sm text-muted-foreground">Сообщение увидит продавец в кабинете. Напишите, что именно нужно исправить.</p>
                  <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} autoFocus placeholder="Например: укажите адрес пункта проката и добавьте хотя бы одно фото" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">В архив — это навсегда. Кабинет и все его карточки скрываются с витрины, и вернуть из архива нельзя.</p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>Отмена</Button>
              <Button type="button" variant={pendingAction.tone === 'destructive' ? 'destructive' : 'default'} disabled={busy || (pendingAction.needsMessage && !message.trim())} onClick={() => void apply(pendingAction.action, pendingAction.needsMessage ? message.trim() : undefined)}>
                {pendingAction.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </DetailScreen>
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
      <dd className="min-w-0 whitespace-pre-line break-words">{value ?? '—'}</dd>
    </div>
  )
}

function SummaryTab({ card }: { card: SellerCard }) {
  const seller = card.seller
  const isBusiness = seller ? seller.kind === 'sole_proprietor' || seller.kind === 'company' : false
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Кабинет">
        <dl>
          <Row label="Название" value={card.profile.displayName} />
          <Row label="Описание" value={card.profile.description} />
          <Row label="Адрес" value={card.profile.address} />
          <Row label="Создан" value={formatDateTime(card.profile.createdAt)} />
          <Row label="Владелец" value={card.owner ? <>{personName({ surname: card.owner.surname, name: card.owner.name })} · {card.owner.phone ?? '—'}{card.owner.email ? <> · {card.owner.email}{card.owner.emailVerified ? ' ✓' : ' (не подтверждена)'}</> : null}</> : '—'} />
        </dl>
      </Section>

      <Section title="Готовность" aside={<Badge variant={card.readiness.canBePaid ? 'success' : card.readiness.isPublic ? 'info' : 'secondary'}>{card.readiness.canBePaid ? 'Может получать выплаты' : card.readiness.isPublic ? 'Виден клиентам' : 'Не опубликован'}</Badge>}>
        <ul className="divide-y text-sm">
          {card.readiness.items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2">
              <span>{readinessLabels[item.key] ?? item.key}{item.hint ? <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span> : null}</span>
              <Badge variant={readinessStatusVariant(item.status)}>{readinessStatusLabel(item.status)}</Badge>
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
            {isBusiness ? (
              <>
                <Row label="Наименование" value={seller.legalName} />
                <Row label={seller.kind === 'company' ? 'ОГРН' : 'ОГРНИП'} value={seller.registrationNumber} />
                {seller.kpp ? <Row label="КПП" value={seller.kpp} /> : null}
                <Row label="Адрес регистрации" value={seller.legalAddress} />
                {seller.director ? <Row label={seller.director.position} value={personName(seller.director)} /> : null}
                <Row label="Налогообложение" value={`${taxationLabels[seller.taxationSystem ?? ''] ?? seller.taxationSystem ?? '—'}, ${vatLabels[seller.vatRate ?? ''] ?? seller.vatRate ?? '—'}`} />
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
                {review.message ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{review.message}</p> : null}
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
  card: SellerCard
  payout: SellerPayout | null
  error: string
  busy: boolean
  onRegister: (overrides: SellerPayoutOverrides) => Promise<void>
  onSync: () => Promise<void>
}) {
  const [overrides, setOverrides] = useState<SellerPayoutOverrides>({})
  if (!payout) {
    return <div><p className="text-sm text-destructive">{error || 'Данные о выплатах недоступны.'}</p></div>
  }

  const { details, registration } = payout
  const isSbp = registration.method === 'sbp'
  const preview = registration.preview

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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

/**
 * The acquirer bindings. The API exposes no way to list existing bindings or destinations, so the
 * console can only create a binding (which returns its id) and then act on an id it already holds.
 * Nothing here is reversible from the console — a wrong binding needs the acquirer.
 */
function AcquiringTab({ sellerId }: { sellerId: string }) {
  const { notify } = useNotifications()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<DealBindingMode>('use_existing_deal')
  const [dealId, setDealId] = useState('')
  const [createDealWithType, setCreateDealWithType] = useState('')
  const [binding, setBinding] = useState<DealBinding | null>(null)

  const [destinationId, setDestinationId] = useState('')
  const [destinationAction, setDestinationAction] = useState<'activate' | 'reject' | 'block'>('activate')
  const [destinationReason, setDestinationReason] = useState('')

  async function run(label: string, work: () => Promise<unknown>) {
    setBusy(true)
    try {
      await work()
      notify({ tone: 'success', title: label })
    } catch (failure) {
      notify({ tone: 'error', title: 'Эквайринг отклонил запрос', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Привязка сделки">
        <p className="mb-3 text-sm text-muted-foreground">
          Сделка связывает продавца с мультисплит-договором эквайера. Необратимо из консоли — ошибку исправляет эквайер.
        </p>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Режим</span>
            <Select
              value={mode}
              onValueChange={(value) => setMode(value)}
              options={[
                { value: 'use_existing_deal', label: 'Использовать существующую сделку' },
                { value: 'create_on_init', label: 'Создать сделку при инициализации' },
              ]}
            />
          </label>
          {mode === 'use_existing_deal' ? (
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">ID сделки</span>
              <Input value={dealId} onChange={(event) => setDealId(event.target.value)} placeholder="deal id" />
            </label>
          ) : (
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Тип создаваемой сделки</span>
              <Input value={createDealWithType} onChange={(event) => setCreateDealWithType(event.target.value)} placeholder="deal type" />
            </label>
          )}
          <Button
            type="button"
            disabled={busy || (mode === 'use_existing_deal' ? !dealId.trim() : !createDealWithType.trim())}
            onClick={() => void run('Привязка создана', async () => {
              const command = await postSellerDealBinding(sellerId, {
                mode,
                dealId: mode === 'use_existing_deal' ? dealId.trim() : undefined,
                createDealWithType: mode === 'create_on_init' ? createDealWithType.trim() : undefined,
              })
              setBinding(command.dealBinding)
            })}
          >
            Создать привязку
          </Button>
        </div>

        {binding ? (
          <div className="mt-4 border-t pt-3">
            <dl>
              <Row label="ID привязки" value={binding.bindingId} />
              <Row label="Статус" value={binding.status} />
              <Row label="Сделка" value={binding.dealId ?? '—'} />
            </dl>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={() => void run('Привязка активирована', async () => {
                const command = await postSellerDealBindingAction(sellerId, binding.bindingId, { action: 'activate' })
                setBinding(command.dealBinding)
              })}>
                Активировать
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void run('Привязка заблокирована', async () => {
                const command = await postSellerDealBindingAction(sellerId, binding.bindingId, { action: 'block', reasonCode: 'manual_block' })
                setBinding(command.dealBinding)
              })}>
                Заблокировать
              </Button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Действие над точкой выплат">
        <p className="mb-3 text-sm text-muted-foreground">
          Требует ID точки выплат. «Отклонить» и «Заблокировать» требуют причину. Необратимо из консоли.
        </p>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">ID точки выплат</span>
            <Input value={destinationId} onChange={(event) => setDestinationId(event.target.value)} placeholder="destination id" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Действие</span>
            <Select
              value={destinationAction}
              onValueChange={(value) => setDestinationAction(value as 'activate' | 'reject' | 'block')}
              options={[
                { value: 'activate', label: 'Активировать' },
                { value: 'reject', label: 'Отклонить' },
                { value: 'block', label: 'Заблокировать' },
              ]}
            />
          </label>
          {destinationAction !== 'activate' ? (
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Причина</span>
              <Input value={destinationReason} onChange={(event) => setDestinationReason(event.target.value)} placeholder="причина" />
            </label>
          ) : null}
          <Button
            type="button"
            disabled={busy || !destinationId.trim() || (destinationAction !== 'activate' && !destinationReason.trim())}
            onClick={() => void run('Готово', () => postSellerPayoutDestinationAction(sellerId, destinationId.trim(), {
              action: destinationAction,
              reasonCode: destinationAction !== 'activate' ? destinationReason.trim() : undefined,
            }))}
          >
            Применить
          </Button>
        </div>
      </Section>
    </div>
  )
}

function MembersTab({ card }: { card: SellerCard }) {
  return (
    <div>
      <Section title="Доступы к кабинету">
        {card.members.length === 0 ? <p className="text-sm text-muted-foreground">Никого нет.</p> : (
          <ul className="divide-y text-sm">
            {card.members.map((member) => (
              <li key={member.membershipId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <strong className="block truncate">{personName({ surname: member.surname, name: member.name })}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{member.phone ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{memberRoleLabel(member.role)}</Badge>
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
