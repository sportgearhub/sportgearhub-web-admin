import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { useNotifications } from '../../../components/ui/notifications-context'
import { Select } from '../../../components/ui/select'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import {
  getInternalProviderMemberships,
  getInternalProviderProfile,
  getInternalUsers,
  getProviderGovernanceQueue,
  getProviderPayoutContractOptions,
  getProviderPayoutContracts,
  getProviderPayoutSetupDraft,
  getProviderTBankShop,
  getSbpMembers,
  patchProviderTBankShopBankAccount,
  postPublicBankByBic,
  postPublicAddressSuggestions,
  postProviderPayoutContract,
  postProviderPayoutSbpRecipientRegister,
  postProviderPayoutTBankShopRegister,
  putProviderPayoutContract,
  NotFoundError,
  type InternalProviderMembershipResponse,
  type PublicAddressSuggestion,
  type PublicBankByBicResponse,
  type InternalUserSummaryResponse,
  type ProviderPayoutBankRequisites,
  type ProviderPayoutContractRequest,
  type ProviderPayoutContractResponse,
  type ProviderPayoutContractOptionsResponse,
  type ProviderPayoutSetupDraftResponse,
  type ProviderSbpPayout,
  type ProviderTBankShopResponse,
  type SbpMemberResponse,
  type ProviderGovernanceSummaryResponse,
  type ProviderProfileResponse,
} from '../adminApi'
import { BooleanBadge } from '../shared/RsqlDataTable'
import { formatDateTime } from '../shared/format'
import { getOperationalStatusVariant } from '../shared/status'
import { getUserDisplayName } from '../users/userUtils'

type ProviderDetailTab = 'summary' | 'profile' | 'memberships' | 'payouts' | 'acquiring'
type PayoutContractTab = 'contract' | 'registration'
type PayoutFormMode = 't_bank_bank_account' | 't_bank_sbp_individual'
type BankRequisitesForm = Record<'account' | 'bankName' | 'bik' | 'correspondentAccount', string>
type SbpPayoutForm = Record<'beneficiaryName' | 'phone' | 'sbpMemberId' | 'displayBankName', string>
type BankLookupFieldValues = BankRequisitesForm & {
  details?: string
}

type ProviderDetailPageProps = {
  providerId: string
  payoutContractId?: string
  onBack: () => void
  onOpenPayoutContract: (contractId: string) => void
  onNewPayoutContract: () => void
  onClosePayoutContract: () => void
  onTopBarContentChange?: (content: React.ReactNode | null) => void
}

const FALLBACK_PAYOUT_CONTRACT_OPTIONS: ProviderPayoutContractOptionsResponse = {
  payoutModes: [
    { key: 't_bank_bank_account', value: 'Bank requisites payout for company or sole proprietor' },
    { key: 't_bank_sbp_individual', value: 'SBP payout for self-employed individual' },
  ],
  statuses: [
    { key: 'review', value: 'Admin must review or complete payout setup data' },
    { key: 'setting_up', value: 'Admin is registering payout details in T-Bank' },
    { key: 'active', value: 'Payout target is registered and routeable' },
    { key: 'rejected', value: 'Payout setup cannot be accepted in the current form' },
    { key: 'blocked', value: 'Payout contract is administratively blocked' },
  ],
  setupActions: [
    { key: 'register_sbp_payout', value: 'Use for t_bank_sbp_individual' },
    { key: 'register_bank_requisites_payout', value: 'Use for t_bank_bank_account' },
  ],
}

type PayoutContractFormState = {
  payoutMode: PayoutFormMode
  contractNumber: number | null
  currency: string
  startsOn: string
  status: string
  bankRequisites: BankRequisitesForm
  sbpPayout: SbpPayoutForm
}

type ShopRegistrationFormState = {
  legalEntityName: string
  taxpayerNumber: string
  branchNumber: string
  registrationNumber: string
  registeredAddress: string
  email: string
  phone: string
  billingDescriptor: string
  shortName: string
  siteUrl: string
  legalAddressZip: string
  legalAddressCountry: string
  legalAddressCity: string
  legalAddressStreet: string
  chiefFirstName: string
  chiefLastName: string
  chiefPhone: string
  chiefCountry: string
  bankName: string
  bankAccount: string
  correspondentAccount: string
  bik: string
  details: string
}

function buildStreetAddress(suggestion: PublicAddressSuggestion) {
  return [suggestion.street, suggestion.house ? `д ${suggestion.house}` : '', suggestion.flat ? `кв ${suggestion.flat}` : '']
    .filter(Boolean)
    .join(', ')
}

function toThreeLetterCountryCode(suggestion: PublicAddressSuggestion) {
  if (suggestion.countryIsoCode === 'RU' || suggestion.country === 'Россия') {
    return 'RUS'
  }

  return (suggestion.countryIsoCode || suggestion.country || '').slice(0, 3).toUpperCase()
}

function normalizeBic(value: string) {
  return value.replace(/\D/g, '').slice(0, 9)
}

function getShortBankName(bank: PublicBankByBicResponse) {
  return (bank.shortName || bank.paymentName || bank.value || '').slice(0, 40)
}

function quietValue(value?: React.ReactNode | null) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>
  }

  return value
}

function getTabClassName(active: boolean) {
  return active
    ? '-mb-px inline-flex h-10 items-center border-b-2 border-primary px-0 text-sm font-medium text-foreground'
    : '-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground'
}

function getUserLookup(users: InternalUserSummaryResponse[]) {
  return new Map(users.map((user) => [user.userId, user]))
}

function buildProviderFilter(providerId: string) {
  return `providerId=="${providerId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function toRequiredBankRequisites(value?: ProviderPayoutBankRequisites | null): BankRequisitesForm {
  return {
    account: value?.account ?? '',
    bankName: value?.bankName ?? '',
    bik: value?.bik ?? '',
    correspondentAccount: value?.correspondentAccount ?? '',
  }
}

function toRequiredSbpPayout(value?: ProviderSbpPayout | null, profile?: ProviderProfileResponse | null): SbpPayoutForm {
  return {
    beneficiaryName: value?.beneficiaryName ?? profile?.legalName ?? profile?.displayName ?? '',
    phone: value?.phone ?? profile?.contactPhone ?? '',
    sbpMemberId: value?.sbpMemberId ?? '',
    displayBankName: value?.displayBankName ?? 'T-Bank',
  }
}

function buildDefaultForm(profile: ProviderProfileResponse, payoutMode: PayoutFormMode): PayoutContractFormState {
  return {
    payoutMode,
    contractNumber: null,
    currency: 'RUB',
    startsOn: getToday(),
    status: 'review',
    bankRequisites: toRequiredBankRequisites(null),
    sbpPayout: toRequiredSbpPayout(null, profile),
  }
}

function mapContractToForm(contract: ProviderPayoutContractResponse, profile: ProviderProfileResponse): PayoutContractFormState {
  const payoutMode = contract.payoutMode === 't_bank_sbp_individual' ? 't_bank_sbp_individual' : 't_bank_bank_account'

  return {
    payoutMode,
    contractNumber: contract.contractNumber,
    currency: contract.currency,
    startsOn: contract.startsOn,
    status: contract.status,
    bankRequisites: toRequiredBankRequisites(contract.bankRequisites),
    sbpPayout: toRequiredSbpPayout(contract.sbpPayout, profile),
  }
}

function mapFormToRequest(form: PayoutContractFormState): ProviderPayoutContractRequest {
  return {
    payoutMode: form.payoutMode,
    currency: form.currency,
    startsOn: form.startsOn,
    status: form.status,
    bankRequisites: form.payoutMode === 't_bank_bank_account' ? form.bankRequisites : null,
    sbpPayout: form.payoutMode === 't_bank_sbp_individual' ? form.sbpPayout : null,
  }
}

function readString(source: unknown, key: string) {
  if (!source || typeof source !== 'object') {
    return ''
  }

  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

/**
 * The payment purpose T-Bank puts on each payout, in the wording their spec requires.
 *
 * `${date}`, `${rub}` and `${kop}` are T-Bank's own placeholders — they substitute the register
 * date and the commission at payout time — so they must survive verbatim into the string we send.
 * Note this is deliberately not a template literal: backticks would make JavaScript try to
 * interpolate them here and produce an empty purpose line.
 *
 * The API builds the same sentence for the suggested draft (BuildPaymentDetails); this mirrors it
 * for the case where no draft came back, so the two cannot drift.
 */
function buildPaymentDetails(contractNumber: number | null, startsOn: string) {
  const number = contractNumber ?? ''
  const date = formatContractDate(startsOn)

  return 'Перевод средств по договору № ' + number + ' от ' + date
    + ' по Реестру Операций от ${date}. Сумма комиссии ${rub} руб. ${kop} коп.'
}

/** dd.MM.yyyy, matching the API's formatting of the same field. */
function formatContractDate(startsOn: string) {
  const parsed = new Date(startsOn)

  if (Number.isNaN(parsed.getTime())) {
    return startsOn
  }

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${parsed.getFullYear()}`
}

function buildShopRegistrationForm(draft: ProviderPayoutSetupDraftResponse | null, profile: ProviderProfileResponse, form: PayoutContractFormState): ShopRegistrationFormState {
  const suggested = draft?.suggestedBankRequisitesRegistration
  const legalProfile = suggested && typeof suggested === 'object' ? (suggested as { legalProfile?: unknown }).legalProfile : null
  const contactProfile = suggested && typeof suggested === 'object' ? (suggested as { contactProfile?: unknown }).contactProfile : null
  const businessProfile = suggested && typeof suggested === 'object' ? (suggested as { businessProfile?: unknown }).businessProfile : null
  const chiefExecutive = suggested && typeof suggested === 'object' ? (suggested as { chiefExecutive?: unknown }).chiefExecutive : null
  const settlementProfile = suggested && typeof suggested === 'object' ? (suggested as { settlementProfile?: unknown }).settlementProfile : null
  const legalAddress = businessProfile && typeof businessProfile === 'object' ? (businessProfile as { legalAddress?: unknown }).legalAddress : null

  return {
    legalEntityName: readString(legalProfile, 'legalEntityName') || profile.legalName || profile.displayName,
    taxpayerNumber: readString(legalProfile, 'taxpayerNumber') || profile.taxNumber || '',
    branchNumber: readString(legalProfile, 'branchNumber') || profile.branchNumber || '',
    registrationNumber: readString(legalProfile, 'registrationNumber') || profile.registrationNumber || '',
    registeredAddress: readString(legalProfile, 'registeredAddress') || profile.address || '',
    email: readString(contactProfile, 'email') || profile.contactEmail || '',
    phone: readString(contactProfile, 'phone') || profile.contactPhone || '',
    billingDescriptor: readString(businessProfile, 'billingDescriptor') || profile.displayName.slice(0, 14).toUpperCase(),
    shortName: readString(businessProfile, 'shortName') || profile.legalName || profile.displayName,
    siteUrl: readString(businessProfile, 'siteUrl'),
    legalAddressZip: readString(legalAddress, 'zip'),
    legalAddressCountry: readString(legalAddress, 'country') || profile.legalCountryCode || 'RUS',
    legalAddressCity: readString(legalAddress, 'city'),
    legalAddressStreet: readString(legalAddress, 'street') || profile.address || '',
    chiefFirstName: readString(chiefExecutive, 'firstName'),
    chiefLastName: readString(chiefExecutive, 'lastName'),
    chiefPhone: readString(chiefExecutive, 'phone') || profile.contactPhone || '',
    chiefCountry: readString(chiefExecutive, 'country') || 'RUS',
    bankName: readString(settlementProfile, 'bankName') || form.bankRequisites.bankName,
    bankAccount: readString(settlementProfile, 'bankAccount') || form.bankRequisites.account,
    correspondentAccount: readString(settlementProfile, 'correspondentAccount') || form.bankRequisites.correspondentAccount,
    bik: readString(settlementProfile, 'bik') || form.bankRequisites.bik,
    details: readString(settlementProfile, 'details') || buildPaymentDetails(form.contractNumber, form.startsOn),
  }
}

function mapShopRegistrationForm(form: ShopRegistrationFormState) {
  return {
    legalProfile: {
      legalEntityName: form.legalEntityName,
      taxpayerNumber: form.taxpayerNumber,
      branchNumber: form.branchNumber,
      registrationNumber: form.registrationNumber,
      registeredAddress: form.registeredAddress,
    },
    contactProfile: {
      email: form.email,
      phone: form.phone,
    },
    businessProfile: {
      billingDescriptor: form.billingDescriptor,
      shortName: form.shortName,
      siteUrl: form.siteUrl,
      legalAddress: {
        type: 'legal',
        zip: form.legalAddressZip,
        country: form.legalAddressCountry,
        city: form.legalAddressCity,
        street: form.legalAddressStreet,
      },
    },
    chiefExecutive: {
      firstName: form.chiefFirstName,
      lastName: form.chiefLastName,
      phone: form.chiefPhone,
      country: form.chiefCountry,
    },
    founders: [],
    settlementProfile: {
      bankName: form.bankName,
      bankAccount: form.bankAccount,
      correspondentAccount: form.correspondentAccount,
      bik: form.bik,
      details: form.details,
    },
  }
}

export function ProviderDetailPage({
  providerId,
  payoutContractId,
  onBack,
  onOpenPayoutContract,
  onNewPayoutContract,
  onClosePayoutContract,
  onTopBarContentChange,
}: ProviderDetailPageProps) {
  const [profile, setProfile] = useState<ProviderProfileResponse | null>(null)
  const [governance, setGovernance] = useState<ProviderGovernanceSummaryResponse | null>(null)
  const [memberships, setMemberships] = useState<InternalProviderMembershipResponse[]>([])
  const [users, setUsers] = useState<InternalUserSummaryResponse[]>([])
  const [payoutContracts, setPayoutContracts] = useState<ProviderPayoutContractResponse[]>([])
  const [payoutContractOptions, setPayoutContractOptions] = useState<ProviderPayoutContractOptionsResponse>(FALLBACK_PAYOUT_CONTRACT_OPTIONS)
  const [activeTab, setActiveTab] = useState<ProviderDetailTab>(() => payoutContractId ? 'payouts' : 'summary')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const userLookup = useMemo(() => getUserLookup(users), [users])

  const loadProvider = useCallback(async () => {
    try {
      setIsLoading(true)
      const [profileResponse, governanceResponse, membershipResponse, userResponse, payoutContractResponse, payoutContractOptionsResponse] = await Promise.all([
        getInternalProviderProfile(providerId),
        getProviderGovernanceQueue({ filter: buildProviderFilter(providerId), page: 1, pageSize: 1 }),
        getInternalProviderMemberships(providerId),
        getInternalUsers({ page: 1, pageSize: 100 }),
        getProviderPayoutContracts(providerId),
        getProviderPayoutContractOptions(),
      ])

      setProfile(profileResponse)
      setGovernance(governanceResponse.items[0] ?? null)
      setMemberships(membershipResponse)
      setUsers(userResponse.items)
      setPayoutContracts(payoutContractResponse)
      setPayoutContractOptions(payoutContractOptionsResponse)
      setError('')
    } catch (loadError) {
      setProfile(null)
      setGovernance(null)
      setMemberships([])
      setUsers([])
      setPayoutContracts([])
      setPayoutContractOptions(FALLBACK_PAYOUT_CONTRACT_OPTIONS)
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить поставщика')
    } finally {
      setIsLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProvider()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadProvider])

  useEffect(() => {
    onTopBarContentChange?.(
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={payoutContractId ? onClosePayoutContract : onBack}>
          <ChevronLeft size={16} aria-hidden="true" />
          Назад
        </Button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">Поставщики</span>
          <span className="shrink-0 text-muted-foreground">&gt;</span>
          <strong className="truncate font-semibold">{profile?.displayName ?? 'Поставщик'}</strong>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadProvider()}
          disabled={isLoading}
          aria-label="Обновить поставщика"
          title="Обновить поставщика"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
        </Button>
      </div>,
    )

    return () => onTopBarContentChange?.(null)
  }, [isLoading, loadProvider, onBack, onClosePayoutContract, onTopBarContentChange, payoutContractId, profile?.displayName])

  function openProviderTab(tab: ProviderDetailTab) {
    setActiveTab(tab)

    if (payoutContractId && tab !== 'payouts') {
      onClosePayoutContract()
    }
  }

  if (isLoading) {
    return (
      <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-card p-4">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Загружаем поставщика...
        </span>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="grid min-h-[calc(100vh-3.5rem)] place-items-center bg-card p-4">
        <div className="grid max-w-md gap-3 text-center">
          <h2 className="text-lg font-semibold">Поставщик недоступен</h2>
          <p className="text-sm text-muted-foreground">{error || 'Не удалось открыть поставщика.'}</p>
          <Button type="button" variant="outline" className="justify-self-center" onClick={onBack}>
            <ChevronLeft size={16} aria-hidden="true" />
            Вернуться к списку
          </Button>
        </div>
      </section>
    )
  }

  const payoutContract = payoutContractId && payoutContractId !== 'new'
    ? payoutContracts.find((contract) => contract.contractId === payoutContractId) ?? null
    : null
  const isPayoutContractMissing = Boolean(payoutContractId && payoutContractId !== 'new' && !payoutContract)

  return (
    <section className="min-h-[calc(100vh-3.5rem)] bg-card">
      <div className="border-b bg-card px-3 pt-2">
        <div className="flex flex-wrap items-end gap-5" role="tablist" aria-label="Разделы поставщика">
          <ProviderTab active={activeTab === 'summary'} onClick={() => openProviderTab('summary')}>Сводка</ProviderTab>
          <ProviderTab active={activeTab === 'profile'} onClick={() => openProviderTab('profile')}>Профиль</ProviderTab>
          <ProviderTab active={activeTab === 'memberships'} onClick={() => openProviderTab('memberships')}>Участники</ProviderTab>
          <ProviderTab active={activeTab === 'payouts'} onClick={() => openProviderTab('payouts')}>Выплаты</ProviderTab>
          <ProviderTab active={activeTab === 'acquiring'} onClick={() => openProviderTab('acquiring')}>Эквайринг</ProviderTab>
        </div>
      </div>

      <div className="p-4">
        {error ? <p className="mb-3 text-sm font-medium text-destructive">{error}</p> : null}

        {activeTab === 'summary' ? (
          <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Контроль</h3>
              <DetailFieldList
                rows={[
                  { label: 'Сводно', value: governance?.overallStatus ?? profile.operatingState },
                  { label: 'Контроль', value: governance?.governanceStatus },
                  { label: 'Возможности', value: governance?.capabilityStatus },
                  { label: 'Расчеты', value: governance?.settlementStatus },
                  { label: 'Обновлено', value: formatDateTime(governance?.updatedAt ?? profile.updatedAt) },
                ]}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Диагностика</h3>
              <DetailFieldList
                rows={[
                  { label: 'Контакт профиля', value: governance ? <BooleanBadge value={governance.diagnostics.hasProfileContact} /> : null },
                  { label: 'Ресурсы', value: governance ? `${governance.diagnostics.activeResources}/${governance.diagnostics.totalResources}` : null },
                  { label: 'Офферы', value: governance ? `${governance.diagnostics.activeOffers}/${governance.diagnostics.totalOffers}` : null },
                  { label: 'Маршруты', value: governance?.diagnostics.activeRoutes },
                  { label: 'Привязки', value: governance?.diagnostics.activeBindings },
                ]}
              />
            </section>
          </div>
        ) : null}

        {activeTab === 'profile' ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Профиль</h3>
            <DetailFieldList
              rows={[
                { label: 'Название', value: profile.displayName },
                { label: 'Provider ID', value: profile.providerId },
                { label: 'Юрлицо', value: profile.legalName },
                { label: 'Страна', value: profile.legalCountryCode },
                { label: 'Форма', value: profile.legalForm },
                { label: 'ИНН', value: profile.taxNumber },
                { label: 'ОГРН', value: profile.registrationNumber },
                { label: 'КПП', value: profile.branchNumber },
                { label: 'Юр. адрес', value: profile.registeredAddress },
                { label: 'Почта', value: profile.contactEmail },
                { label: 'Телефон', value: profile.contactPhone },
                { label: 'Адрес', value: profile.address },
                { label: 'Описание', value: profile.description },
              ]}
            />
          </section>
        ) : null}

        {activeTab === 'memberships' ? (
          <MembershipsTable memberships={memberships} userLookup={userLookup} />
        ) : null}

        {activeTab === 'payouts' ? (
          payoutContractId ? (
            isPayoutContractMissing ? (
              <section className="grid min-h-[320px] place-items-center">
                <div className="grid max-w-md gap-3 text-center">
                  <h3 className="text-lg font-semibold">Договор недоступен</h3>
                  <p className="text-sm text-muted-foreground">Договор выплат не найден в списке поставщика.</p>
                  <Button type="button" variant="outline" className="justify-self-center" onClick={onClosePayoutContract}>
                    <ChevronLeft size={16} aria-hidden="true" />
                    Вернуться к договорам
                  </Button>
                </div>
              </section>
            ) : (
              <PayoutContractFormPage
                key={payoutContractId}
                providerId={providerId}
                profile={profile}
                contract={payoutContract}
                options={payoutContractOptions}
                onSaved={(contractId) => {
                  void loadProvider()
                  onOpenPayoutContract(contractId)
                }}
                onBack={onClosePayoutContract}
              />
            )
          ) : (
            <PayoutContractsTable contracts={payoutContracts} onCreate={onNewPayoutContract} onEdit={onOpenPayoutContract} />
          )
        ) : null}

        {activeTab === 'acquiring' ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Эквайринг и маршрутизация</h3>
            <DetailFieldList
              rows={[
                { label: 'Эквайринг', value: governance?.diagnostics.acquiringStatus },
                { label: 'Онбординг', value: governance?.diagnostics.acquiringOnboardingStatus },
                { label: 'Подключение', value: governance?.diagnostics.acquiringConnectionId },
                { label: 'Маршруты', value: governance?.diagnostics.activeRoutes },
                { label: 'Привязки', value: governance?.diagnostics.activeBindings },
              ]}
            />
          </section>
        ) : null}
      </div>
    </section>
  )
}

function MembershipsTable({ memberships, userLookup }: { memberships: InternalProviderMembershipResponse[]; userLookup: Map<string, InternalUserSummaryResponse> }) {
  return (
    <section className="-mx-4">
      <TableFrame className="border-0">
        <Table>
          <colgroup>
            <col className="w-[48%]" />
            <col className="w-[22%]" />
            <col className="w-[30%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Обновлено</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.length ? memberships.map((membership) => {
              const user = userLookup.get(membership.userId)

              return (
                <TableRow key={membership.providerMembershipId}>
                  <TableCell>
                    <strong className="block truncate text-sm font-medium">{user ? getUserDisplayName(user) : 'Пользователь не найден'}</strong>
                    <small className="text-xs text-muted-foreground">{user?.email ?? user?.phone ?? membership.userId}</small>
                  </TableCell>
                  <TableCell><Badge variant="outline">{membership.role}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(membership.updatedAt)}</TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Доступов нет.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>
    </section>
  )
}

function PayoutContractsTable({
  contracts,
  onCreate,
  onEdit,
}: {
  contracts: ProviderPayoutContractResponse[]
  onCreate: () => void
  onEdit: (contractId: string) => void
}) {
  return (
    <section className="-mx-4 grid gap-4">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b px-4">
        <div>
          <h3 className="text-sm font-semibold">Договоры выплат</h3>
          <p className="text-xs text-muted-foreground">Создайте или обновите договор, затем зарегистрируйте выплатные реквизиты.</p>
        </div>
        <Button type="button" size="sm" onClick={onCreate}>Новый договор</Button>
      </div>
      <TableFrame className="border-0">
        <Table>
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[22%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Договор</TableHead>
              <TableHead>Режим</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Реквизиты</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length ? contracts.map((contract) => (
              <TableRow
                key={contract.contractId}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onEdit(contract.contractId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onEdit(contract.contractId)
                  }
                }}
              >
                <TableCell>
                  <strong className="block truncate text-sm font-medium">#{contract.contractNumber}</strong>
                  <small className="text-xs text-muted-foreground">{contract.contractId}</small>
                </TableCell>
                <TableCell>{contract.payoutMode}</TableCell>
                <TableCell><Badge variant={getOperationalStatusVariant(contract.status)}>{contract.status}</Badge></TableCell>
                <TableCell>{contract.startsOn}</TableCell>
                <TableCell>{quietValue(contract.bankRequisites?.bankName ?? contract.sbpPayout?.beneficiaryName)}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(contract.contractId)
                    }}
                  >
                    Редактировать
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Договоров выплат нет.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>
    </section>
  )
}

function PayoutContractFormPage({
  providerId,
  profile,
  contract,
  options,
  onSaved,
  onBack,
}: {
  providerId: string
  profile: ProviderProfileResponse
  contract: ProviderPayoutContractResponse | null
  options: ProviderPayoutContractOptionsResponse
  onSaved: (contractId: string) => void
  onBack: () => void
}) {
  const [form, setForm] = useState<PayoutContractFormState>(() => contract ? mapContractToForm(contract, profile) : buildDefaultForm(profile, 't_bank_bank_account'))
  const [shopForm, setShopForm] = useState<ShopRegistrationFormState>(() => buildShopRegistrationForm(null, profile, form))
  const [activeTab, setActiveTab] = useState<PayoutContractTab>('contract')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sbpMembers, setSbpMembers] = useState<SbpMemberResponse[]>([])
  const sbpMembersFetchedRef = useRef(false)
  const [tBankShop, setTBankShop] = useState<ProviderTBankShopResponse | null>(null)
  const [tBankShopStatus, setTBankShopStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle')
  const [bankAccountForm, setBankAccountForm] = useState<BankLookupFieldValues>({ account: '', bankName: '', bik: '', correspondentAccount: '', details: '' })
  const { notify } = useNotifications()

  useEffect(() => {
    if (form.payoutMode !== 't_bank_sbp_individual') return
    if (sbpMembersFetchedRef.current) return
    sbpMembersFetchedRef.current = true
    getSbpMembers()
      .then((response) => setSbpMembers(response.items))
      .catch(() => {})
  }, [form.payoutMode])

  useEffect(() => {
    if (activeTab !== 'registration' || form.payoutMode !== 't_bank_bank_account' || tBankShopStatus !== 'idle') return
    setTBankShopStatus('loading')
    getProviderTBankShop(providerId)
      .then((shop) => {
        setTBankShop(shop)
        setBankAccountForm({
          account: shop.settlementProfile.bankAccount,
          bankName: shop.settlementProfile.bankName,
          bik: shop.settlementProfile.bik,
          correspondentAccount: shop.settlementProfile.correspondentAccount,
          details: shop.settlementProfile.details,
        })
        setTBankShopStatus('found')
      })
      .catch((error) => {
        setTBankShopStatus(error instanceof NotFoundError ? 'not_found' : 'error')
      })
  }, [activeTab, form.payoutMode, tBankShopStatus, providerId])

  function updateForm(partial: Partial<PayoutContractFormState>) {
    setForm((current) => ({ ...current, ...partial }))
  }

  function updateBankRequisites(partial: Partial<BankRequisitesForm>) {
    setForm((current) => ({ ...current, bankRequisites: { ...current.bankRequisites, ...partial } }))
  }

  function updateSbpPayout(partial: Partial<SbpPayoutForm>) {
    setForm((current) => ({ ...current, sbpPayout: { ...current.sbpPayout, ...partial } }))
  }

  async function saveContract() {
    try {
      setIsSubmitting(true)
      const request = mapFormToRequest(form)
      const response = contract
        ? await putProviderPayoutContract(providerId, contract.contractId, request)
        : await postProviderPayoutContract(providerId, request)

      notify({ tone: 'success', title: contract ? 'Договор обновлен' : 'Договор создан', description: response.result?.actionCode })
      onSaved(response.contract.contractId)
    } catch (saveError) {
      notify({ tone: 'error', title: 'Не удалось сохранить договор', description: saveError instanceof Error ? saveError.message : undefined })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function loadSetupDraft() {
    if (!contract) {
      notify({ tone: 'error', title: 'Сначала сохраните договор' })
      return
    }

    try {
      setIsSubmitting(true)
      const draft = await getProviderPayoutSetupDraft(providerId, contract.contractId)

      setForm(mapContractToForm(draft.contract, profile))
      setShopForm(buildShopRegistrationForm(draft, profile, mapContractToForm(draft.contract, profile)))
      notify({ tone: 'success', title: 'Данные регистрации обновлены' })
    } catch (draftError) {
      notify({ tone: 'error', title: 'Не удалось открыть черновик настройки', description: draftError instanceof Error ? draftError.message : undefined })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function registerSbpPayout() {
    if (!contract) {
      notify({ tone: 'error', title: 'Сначала сохраните договор' })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await postProviderPayoutSbpRecipientRegister(providerId, contract.contractId, form.sbpPayout)

      notify({ tone: 'success', title: 'СБП-выплата зарегистрирована', description: response.result?.actionCode })
    } catch (registerError) {
      notify({ tone: 'error', title: 'Не удалось зарегистрировать СБП-выплату', description: registerError instanceof Error ? registerError.message : undefined })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function registerTBankShop() {
    if (!contract) {
      notify({ tone: 'error', title: 'Сначала сохраните договор' })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await postProviderPayoutTBankShopRegister(providerId, contract.contractId, mapShopRegistrationForm(shopForm))

      notify({ tone: 'success', title: 'T-Bank Shop зарегистрирован', description: response.result?.actionCode })
    } catch (registerError) {
      notify({ tone: 'error', title: 'Не удалось зарегистрировать T-Bank Shop', description: registerError instanceof Error ? registerError.message : undefined })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateBankAccount() {
    try {
      setIsSubmitting(true)
      const response = await patchProviderTBankShopBankAccount(providerId, {
        bankAccount: bankAccountForm.account || undefined,
        bankName: bankAccountForm.bankName || undefined,
        bik: bankAccountForm.bik || undefined,
        correspondentAccount: bankAccountForm.correspondentAccount || undefined,
        paymentDetails: bankAccountForm.details || undefined,
      })
      setTBankShop(response.shop)
      notify({ tone: 'success', title: 'Расчетный счет обновлен', description: response.result?.actionCode })
    } catch (updateError) {
      notify({ tone: 'error', title: 'Не удалось обновить расчетный счет', description: updateError instanceof Error ? updateError.message : undefined })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="-mx-4 -mb-4 bg-card">
      <div className="border-b bg-card px-4 pt-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{contract ? 'Редактирование договора выплат' : 'Новый договор выплат'}</h3>
            <span className="block text-sm text-muted-foreground">{profile.displayName}</span>
          </div>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>Отмена</Button>
            <Button type="button" size="sm" onClick={() => void saveContract()} disabled={isSubmitting}>
              {contract ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-5" role="tablist" aria-label="Разделы договора выплат">
          <ProviderTab active={activeTab === 'contract'} onClick={() => setActiveTab('contract')}>Договор</ProviderTab>
          <ProviderTab active={activeTab === 'registration'} onClick={() => setActiveTab('registration')}>Регистрация</ProviderTab>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'contract' ? (
          <section className="grid content-start gap-4">
            <div>
              <h3 className="text-sm font-semibold">Поля договора</h3>
              <p className="text-xs text-muted-foreground">Создание и обновление договора через структурированные поля.</p>
            </div>

            <div className="grid gap-3">
              <label className="grid max-w-lg gap-1 text-sm">
                <span className="font-medium">Режим</span>
                <Select
                  value={form.payoutMode}
                  onValueChange={(value) => updateForm({ payoutMode: value as PayoutFormMode })}
                  options={options.payoutModes.map((option) => ({ value: option.key, label: option.key }))}
                />
              </label>
              <div className="grid gap-3">
                <Field className="max-w-[96px]" label="Номер" value={form.contractNumber === null ? 'Авто' : String(form.contractNumber)} readOnly maxLength={4} />
                <Field className="max-w-[88px]" label="Валюта" value={form.currency} readOnly maxLength={3} />
                <Field className="max-w-[160px]" label="Дата начала" type="date" value={form.startsOn} onChange={(value) => updateForm({ startsOn: value })} />
                <label className="grid max-w-[180px] gap-1 text-sm">
                  <span className="font-medium">Статус</span>
                  <Select
                    value={form.status}
                    onValueChange={(value) => updateForm({ status: value })}
                    options={options.statuses.map((option) => ({ value: option.key, label: option.key }))}
                  />
                </label>
              </div>
            </div>

            {form.payoutMode === 't_bank_bank_account' ? (
              <section className="grid gap-3 border-t pt-3">
                <h4 className="text-sm font-semibold">Банковские реквизиты</h4>
                <BankLookupFields values={form.bankRequisites} onChange={updateBankRequisites} />
              </section>
            ) : (
              <section className="grid gap-3 border-t pt-3">
                <h4 className="text-sm font-semibold">СБП-выплата</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field className="sm:col-span-2" label="Получатель" value={form.sbpPayout.beneficiaryName} onChange={(value) => updateSbpPayout({ beneficiaryName: value })} />
                  <Field label="Телефон" value={form.sbpPayout.phone} onChange={(value) => updateSbpPayout({ phone: value })} />
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Банк СБП</span>
                    <Select
                      value={form.sbpPayout.sbpMemberId}
                      onValueChange={(value) => {
                        const member = sbpMembers.find((m) => m.sbpMemberId === value)
                        updateSbpPayout({ sbpMemberId: value, displayBankName: member?.displayBankName ?? form.sbpPayout.displayBankName })
                      }}
                      options={sbpMembers.map((m) => ({ value: m.sbpMemberId, label: m.displayBankName }))}
                    />
                  </label>
                  <Field className="sm:col-span-2" label="Название банка" value={form.sbpPayout.displayBankName} onChange={(value) => updateSbpPayout({ displayBankName: value })} />
                </div>
              </section>
            )}
          </section>
        ) : null}

        {activeTab === 'registration' ? (
          <section className="grid max-w-5xl content-start gap-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Регистрация</h3>
                <p className="text-xs text-muted-foreground">Зарегистрируйте выплатные реквизиты в T-Bank.</p>
              </div>
              {(form.payoutMode === 't_bank_sbp_individual' || tBankShopStatus === 'not_found') ? (
                <Button type="button" variant="outline" size="sm" onClick={() => void loadSetupDraft()} disabled={isSubmitting || !contract}>
                  Загрузить черновик
                </Button>
              ) : null}
            </div>

            {!contract ? <p className="text-sm text-muted-foreground">Сначала сохраните договор, затем откройте регистрацию.</p> : null}

            {form.payoutMode === 't_bank_sbp_individual' ? (
              <section className="grid max-w-3xl gap-3">
                <Field label="Получатель" value={form.sbpPayout.beneficiaryName} onChange={(value) => updateSbpPayout({ beneficiaryName: value })} />
                <Field label="Телефон" value={form.sbpPayout.phone} onChange={(value) => updateSbpPayout({ phone: value })} />
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Банк СБП</span>
                  <Select
                    value={form.sbpPayout.sbpMemberId}
                    onValueChange={(value) => {
                      const member = sbpMembers.find((m) => m.sbpMemberId === value)
                      updateSbpPayout({ sbpMemberId: value, displayBankName: member?.displayBankName ?? form.sbpPayout.displayBankName })
                    }}
                    options={sbpMembers.map((m) => ({ value: m.sbpMemberId, label: m.displayBankName }))}
                  />
                </label>
                <Field label="Название банка" value={form.sbpPayout.displayBankName} onChange={(value) => updateSbpPayout({ displayBankName: value })} />
                <Button type="button" className="justify-self-start" onClick={() => void registerSbpPayout()} disabled={isSubmitting || !contract}>
                  Зарегистрировать СБП-выплату
                </Button>
              </section>
            ) : tBankShopStatus === 'idle' || tBankShopStatus === 'loading' ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Загружаем магазин...
              </span>
            ) : tBankShopStatus === 'found' && tBankShop ? (
              <section className="grid gap-4">
                <section className="grid gap-2 rounded-sm bg-muted/30 p-3">
                  <h4 className="text-sm font-semibold">T-Bank Shop</h4>
                  <DetailFieldList
                    rows={[
                      { label: 'Код магазина', value: tBankShop.shopCode },
                      { label: 'Дескриптор', value: tBankShop.billingDescriptor },
                      { label: 'Наименование', value: tBankShop.shortName },
                      { label: 'ИНН', value: tBankShop.inn },
                      { label: 'КПП', value: tBankShop.kpp },
                      { label: 'ОГРН', value: tBankShop.ogrn },
                    ]}
                  />
                </section>
                <section className="grid gap-3 rounded-sm bg-muted/30 p-3">
                  <h4 className="text-sm font-semibold">Расчетный счет</h4>
                  <BankLookupFields
                    showDetails
                    values={bankAccountForm}
                    onChange={(partial) => setBankAccountForm((prev) => ({ ...prev, ...partial }))}
                  />
                  <Button type="button" className="justify-self-start" onClick={() => void updateBankAccount()} disabled={isSubmitting}>
                    Обновить расчетный счет
                  </Button>
                </section>
              </section>
            ) : tBankShopStatus === 'not_found' ? (
              <ShopRegistrationFields form={shopForm} onChange={setShopForm} onRegister={() => void registerTBankShop()} disabled={isSubmitting || !contract} />
            ) : (
              <div className="grid gap-2">
                <p className="text-sm text-destructive">Не удалось загрузить данные магазина.</p>
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setTBankShopStatus('idle')} disabled={isSubmitting}>
                  Повторить
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  className = '',
  maxLength,
}: {
  label: string
  value: string
  onChange?: (value: string) => void
  type?: string
  readOnly?: boolean
  className?: string
  maxLength?: number
}) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      <Input
        className={readOnly ? 'bg-muted/60 text-muted-foreground' : undefined}
        type={type}
        value={value}
        readOnly={readOnly}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  )
}

function BankLookupFields({
  values,
  onChange,
  showDetails = false,
}: {
  values: BankLookupFieldValues
  onChange: (partial: Partial<BankLookupFieldValues>) => void
  showDetails?: boolean
}) {
  const [bicError, setBicError] = useState('')
  const [isBicLoading, setIsBicLoading] = useState(false)
  const bicAbortControllerRef = useRef<AbortController | null>(null)

  function clearBicRequest() {
    bicAbortControllerRef.current?.abort()
    bicAbortControllerRef.current = null
  }

  function applyBank(bank: PublicBankByBicResponse) {
    onChange({
      bankName: getShortBankName(bank),
      bik: bank.bic,
      correspondentAccount: bank.correspondentAccount || '',
    })
    setBicError('')
  }

  function lookupBankByBic(bic: string) {
    clearBicRequest()

    if (bic.length !== 9) {
      setBicError('')
      setIsBicLoading(false)
      return
    }

    const abortController = new AbortController()
    bicAbortControllerRef.current = abortController
    setIsBicLoading(true)

    postPublicBankByBic(bic, abortController.signal)
      .then(applyBank)
      .catch((error) => {
        if (abortController.signal.aborted) {
          return
        }

        onChange({ bankName: '', correspondentAccount: '' })
        setBicError(error instanceof Error ? error.message : 'Банк не найден')
      })
      .finally(() => {
        if (bicAbortControllerRef.current === abortController) {
          bicAbortControllerRef.current = null
        }

        if (!abortController.signal.aborted) {
          setIsBicLoading(false)
        }
      })
  }

  function handleBicChange(value: string) {
    const bic = normalizeBic(value)

    onChange({ bik: bic })
    lookupBankByBic(bic)
  }

  useEffect(() => {
    return () => clearBicRequest()
  }, [])

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,24rem)]">
        <label className="relative grid gap-1 text-sm">
          <span className="font-medium">БИК</span>
          <Input value={values.bik} inputMode="numeric" maxLength={9} onChange={(event) => handleBicChange(event.target.value)} />
          {isBicLoading ? <span className="absolute right-2 top-8 text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden="true" /></span> : null}
          {bicError ? <span className="text-xs text-destructive">{bicError}</span> : null}
        </label>
        <Field label="Банк" value={values.bankName} readOnly />
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)]">
        <Field label="Расчетный счет" value={values.account} maxLength={20} onChange={(value) => onChange({ account: value.replace(/\D/g, '').slice(0, 20) })} />
        <Field label="Корр. счет" value={values.correspondentAccount} readOnly maxLength={20} />
      </div>
      {showDetails ? <Field className="max-w-3xl" label="Назначение платежа" value={values.details || ''} onChange={(value) => onChange({ details: value })} /> : null}
    </div>
  )
}

function ShopRegistrationFields({
  form,
  onChange,
  onRegister,
  disabled,
}: {
  form: ShopRegistrationFormState
  onChange: (form: ShopRegistrationFormState) => void
  onRegister: () => void
  disabled: boolean
}) {
  const [addressQuery, setAddressQuery] = useState(form.registeredAddress || form.legalAddressStreet)
  const [addressSuggestions, setAddressSuggestions] = useState<PublicAddressSuggestion[]>([])
  const [addressError, setAddressError] = useState('')
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const addressRequestTimeoutRef = useRef<number | null>(null)
  const addressAbortControllerRef = useRef<AbortController | null>(null)

  function update(partial: Partial<ShopRegistrationFormState>) {
    onChange({ ...form, ...partial })
  }

  function applyAddressSuggestion(suggestion: PublicAddressSuggestion) {
    const streetAddress = buildStreetAddress(suggestion) || suggestion.value

    update({
      registeredAddress: suggestion.unrestrictedValue || suggestion.value,
      legalAddressZip: (suggestion.postalCode || '').slice(0, 6),
      legalAddressCountry: toThreeLetterCountryCode(suggestion),
      legalAddressCity: (suggestion.city || suggestion.region || '').slice(0, 64),
      legalAddressStreet: streetAddress.slice(0, 128),
    })
    setAddressQuery(suggestion.value)
    setAddressSuggestions([])
    setAddressError('')
  }

  function clearAddressRequest() {
    if (addressRequestTimeoutRef.current !== null) {
      window.clearTimeout(addressRequestTimeoutRef.current)
      addressRequestTimeoutRef.current = null
    }

    addressAbortControllerRef.current?.abort()
    addressAbortControllerRef.current = null
  }

  function queueAddressSuggestions(query: string) {
    clearAddressRequest()

    if (query.length < 3) {
      setAddressSuggestions([])
      setAddressError('')
      setIsAddressLoading(false)
      return
    }

    addressRequestTimeoutRef.current = window.setTimeout(() => {
      const abortController = new AbortController()
      addressAbortControllerRef.current = abortController
      setIsAddressLoading(true)

      postPublicAddressSuggestions(query, 10, abortController.signal)
        .then((response) => {
          setAddressSuggestions(response.suggestions)
          setAddressError('')
        })
        .catch((error) => {
          if (abortController.signal.aborted) {
            return
          }

          setAddressSuggestions([])
          setAddressError(error instanceof Error ? error.message : 'Не удалось загрузить адреса')
        })
        .finally(() => {
          if (addressAbortControllerRef.current === abortController) {
            addressAbortControllerRef.current = null
          }

          if (!abortController.signal.aborted) {
            setIsAddressLoading(false)
          }
        })
    }, 250)
  }

  function handleAddressQueryChange(value: string) {
    const query = value.trim()

    setAddressQuery(value)
    queueAddressSuggestions(query)
  }

  useEffect(() => {
    return () => {
      clearAddressRequest()
    }
  }, [])

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="grid min-w-0 gap-3 rounded-sm bg-muted/30 p-3">
        <h4 className="text-sm font-semibold">Юридический профиль</h4>
        <div className="grid gap-3">
          <Field className="max-w-md" label="Наименование" value={form.shortName} onChange={(value) => update({ shortName: value })} />
          <Field className="max-w-xl" label="Полное наименование" value={form.legalEntityName} onChange={(value) => update({ legalEntityName: value })} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,140px)_minmax(0,120px)_minmax(0,160px)]">
            <Field label="ИНН" value={form.taxpayerNumber} onChange={(value) => update({ taxpayerNumber: value })} />
            <Field label="КПП" value={form.branchNumber} onChange={(value) => update({ branchNumber: value })} />
            <Field label="ОГРН" value={form.registrationNumber} onChange={(value) => update({ registrationNumber: value })} />
          </div>
        </div>

        <div className="relative grid max-w-xl gap-1 text-sm">
          <span className="font-medium">Поиск юр. адреса</span>
          <Input
            value={addressQuery}
            placeholder="Уфа Ленина 1"
            autoComplete="off"
            onFocus={() => setIsAddressFocused(true)}
            onBlur={() => setIsAddressFocused(false)}
            onChange={(event) => handleAddressQueryChange(event.target.value)}
          />
          {isAddressLoading ? <span className="absolute right-2 top-8 text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden="true" /></span> : null}
          {addressError ? <span className="text-xs text-destructive">{addressError}</span> : null}
          {isAddressFocused && addressSuggestions.length ? (
            <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border bg-popover shadow-lg">
              {addressSuggestions.map((suggestion) => (
                <button
                  key={`${suggestion.value}-${suggestion.postalCode ?? ''}`}
                  type="button"
                  className="grid w-full gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyAddressSuggestion(suggestion)}
                >
                  <span>{suggestion.value}</span>
                  <span className="text-xs text-muted-foreground">{suggestion.unrestrictedValue || suggestion.postalCode || suggestion.source}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 xl:grid-cols-[92px_110px_minmax(0,150px)_minmax(0,1fr)]">
          <Field label="Страна" value={form.legalAddressCountry} readOnly maxLength={3} />
          <Field label="Индекс" value={form.legalAddressZip} maxLength={6} onChange={(value) => update({ legalAddressZip: value.replace(/\D/g, '').slice(0, 6) })} />
          <Field label="Город" value={form.legalAddressCity} maxLength={64} onChange={(value) => update({ legalAddressCity: value.slice(0, 64) })} />
          <Field label="Адрес" value={form.legalAddressStreet} maxLength={128} onChange={(value) => update({ legalAddressStreet: value.slice(0, 128) })} />
        </div>
      </section>

      <section className="grid min-w-0 content-start gap-3 rounded-sm bg-muted/30 p-3">
        <h4 className="text-sm font-semibold">Контакты и бизнес</h4>
        <div className="grid gap-3">
          <Field className="max-w-sm" label="Эл. почта" value={form.email} onChange={(value) => update({ email: value })} />
          <Field className="max-w-[180px]" label="Телефон" value={form.phone} onChange={(value) => update({ phone: value })} />
          <Field className="max-w-[220px]" label="Slug латиницей" value={form.billingDescriptor} onChange={(value) => update({ billingDescriptor: value })} />
          <Field className="max-w-md" label="Сайт" value={form.siteUrl} onChange={(value) => update({ siteUrl: value })} />
        </div>
      </section>

      <section className="grid min-w-0 content-start gap-3 rounded-sm bg-muted/30 p-3">
        <h4 className="text-sm font-semibold">Руководитель</h4>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)]">
            <Field label="Имя" value={form.chiefFirstName} onChange={(value) => update({ chiefFirstName: value })} />
            <Field label="Фамилия" value={form.chiefLastName} onChange={(value) => update({ chiefLastName: value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[92px_minmax(0,180px)]">
            <Field label="Страна" value={form.chiefCountry} onChange={(value) => update({ chiefCountry: value })} />
            <Field label="Телефон" value={form.chiefPhone} onChange={(value) => update({ chiefPhone: value })} />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 content-start gap-3 rounded-sm bg-muted/30 p-3">
        <h4 className="text-sm font-semibold">Расчетный профиль</h4>
        <BankLookupFields
          showDetails
          values={{
            account: form.bankAccount,
            bankName: form.bankName,
            bik: form.bik,
            correspondentAccount: form.correspondentAccount,
            details: form.details,
          }}
          onChange={(partial) => update({
            bankAccount: partial.account ?? form.bankAccount,
            bankName: partial.bankName ?? form.bankName,
            bik: partial.bik ?? form.bik,
            correspondentAccount: partial.correspondentAccount ?? form.correspondentAccount,
            details: partial.details ?? form.details,
          })}
        />
      </section>

      <Button type="button" className="justify-self-start lg:col-span-2" onClick={onRegister} disabled={disabled}>
        Зарегистрировать T-Bank Shop
      </Button>
    </section>
  )
}

function ProviderTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={getTabClassName(active)} onClick={onClick} role="tab" aria-selected={active}>
      {children}
    </button>
  )
}

function DetailFieldList({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="max-w-3xl divide-y text-sm">
      {rows.map((row) => (
        <div className="grid gap-1 py-2 sm:grid-cols-[180px_minmax(0,1fr)]" key={row.label}>
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words">{quietValue(row.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
