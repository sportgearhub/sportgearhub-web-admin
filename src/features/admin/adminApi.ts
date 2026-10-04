import { getFreshAuthorizationHeader, refreshStoredAuthTokens } from '../auth/authApi'
import { keysToCamel, keysToSnake } from '../../lib/case-convert'
import { getStoredAuthTokens } from '../auth/authTokenStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

// Every error is an RFC-7807 ProblemDetails with a stable `code` to branch on; field-validation
// failures come as 400 with an `errors` object instead of a `code`. We keep both around so a caller
// can react to a specific code (`seller.transition_not_allowed`, `payout.already_registered`, …)
// while still having a human message to show.
type ProblemDetails = {
  title?: string
  detail?: string
  status?: number
  code?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly fieldErrors: Record<string, string[]>

  constructor(message: string, status: number, code: string | null, fieldErrors: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, code: string | null = 'not_found') {
    super(message, 404, code)
    this.name = 'NotFoundError'
  }
}


// ─── List envelope ──────────────────────────────────────────────────────────────────────────────

export type PaginationResponse = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type PagedResult<TItem> = {
  items: TItem[]
  pagination: PaginationResponse
}

export type InternalListQuery = {
  filter?: string
  sort?: string
  page: number
  pageSize: number
}

export type InternalListFilterFieldResponse = {
  name: string
  type: string
  operators?: string[] | null
  values?: string[] | null
}

export type InternalListSortFieldResponse = {
  name: string
  type: string
}

export type InternalListFilterExampleResponse = {
  label: string
  filter?: string | null
  queryString?: string | null
}

export type InternalListOptionsResponse = {
  filterFields: InternalListFilterFieldResponse[]
  sortFields: InternalListSortFieldResponse[]
  filterExamples: InternalListFilterExampleResponse[]
  sortExamples: string[]
  defaultSort: string
  pagination: {
    defaultPage: number
    defaultPageSize: number
    maxPageSize: number
  }
}


// ─── Request core ─────────────────────────────────────────────────────────────────────────────

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

function buildInternalListUrl(path: string, query?: InternalListQuery) {
  if (!query) {
    return path
  }

  const searchParams = new URLSearchParams()

  if (query.filter) {
    searchParams.set('filter', query.filter)
  }

  if (query.sort) {
    searchParams.set('sort', query.sort)
  }

  searchParams.set('page', String(query.page))
  searchParams.set('pageSize', String(query.pageSize))

  return `${path}?${searchParams.toString()}`
}

async function readProblem(response: Response): Promise<ApiError> {
  try {
    const body = keysToCamel<ProblemDetails & { errors?: Record<string, string[]> }>(await response.json())
    // keysToCamel lower-cases the wire `errors` keys too; that only changes the field names we echo,
    // never the messages, and we mostly surface the joined message anyway.
    const fieldErrors = body.errors ?? {}
    const firstFieldMessage = Object.values(fieldErrors).flat().find(Boolean)
    const message = body.detail || body.title || firstFieldMessage || `Сервис вернул ${response.status}`
    return new ApiError(message, response.status, body.code ?? null, fieldErrors)
  } catch {
    return new ApiError(`Сервис вернул ${response.status}`, response.status, null)
  }
}

type RequestOptions = RequestInit & { body?: BodyInit | null }

async function requestJson<TResponse>(path: string, init?: RequestOptions): Promise<TResponse> {
  const headers = new Headers(init?.headers)
  const authorizationHeader = await getFreshAuthorizationHeader()

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  // Call sites build camelCase bodies; the wire format is snake_case. Converting here keeps a single
  // translation point instead of hand-editing every request literal.
  const requestInit: RequestOptions = { ...init }
  if (typeof requestInit.body === 'string') {
    try {
      requestInit.body = JSON.stringify(keysToSnake(JSON.parse(requestInit.body)))
    } catch {
      // Not a JSON object literal — send it through unchanged.
    }
  }

  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader)
  }

  let response = await fetch(buildApiUrl(path), {
    ...requestInit,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && getStoredAuthTokens()?.refreshToken) {
    const refreshedTokens = await refreshStoredAuthTokens()

    headers.set('Authorization', `${refreshedTokens.tokenType || 'Bearer'} ${refreshedTokens.accessToken}`)
    response = await fetch(buildApiUrl(path), {
      ...requestInit,
      credentials: 'include',
      headers,
    })
  }

  if (!response.ok) {
    const error = await readProblem(response)
    if (response.status === 404) {
      throw new NotFoundError(error.message, error.code)
    }
    throw error
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return keysToCamel<TResponse>(await response.json())
}

/** These endpoints take no body — the path carries everything. Send no payload and no Content-Type. */
function postNoBody<TResponse>(path: string) {
  return requestJson<TResponse>(path, { method: 'POST' })
}

function jsonBody<TResponse>(method: 'POST' | 'PATCH' | 'PUT', path: string, payload: unknown) {
  return requestJson<TResponse>(path, { method, body: JSON.stringify(payload) })
}

/** filter/sort/page/pageSize for the RSQL list endpoints; `extra` carries non-RSQL params like `status`. */
export type ListQueryParams = { filter?: string; sort?: string; page?: number; pageSize?: number }

function listQuery(params: ListQueryParams = {}, extra?: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams()
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) searchParams.set(key, value)
    }
  }
  if (params.filter) searchParams.set('filter', params.filter)
  if (params.sort) searchParams.set('sort', params.sort)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize))
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

const id = (value: string) => encodeURIComponent(value)


// ═══ Sellers ══════════════════════════════════════════════════════════════════════════════════

export type SellerStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'suspended'
  | 'archived'
  | (string & {})

export type SellerKind = 'self_employed' | 'sole_proprietor' | 'company' | (string & {})

/** The whole rulebook is the transition table in docs/admin-api-integration.md — drive buttons from it. */
export type SellerAction = 'approve' | 'request_changes' | 'reject' | 'reopen' | 'suspend' | 'activate' | 'archive'

export type SellerListItem = {
  sellerId: string
  displayName: string
  status: SellerStatus
  sellerKind: SellerKind | null
  inn: string | null
  legalName: string | null
  agreementNumber: number | null
  payoutDetailsPresent: boolean
  payoutRegistered: boolean
  canBePaid: boolean
  reviewOpenedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SellerReviewQueueItem = {
  sellerId: string
  displayName: string
  status: SellerStatus
  sellerKind: SellerKind | null
  inn: string | null
  legalName: string | null
  openedAt: string
  updatedAt: string
}

export type SellerReviewSummary = {
  reviewId?: string
  openedAt: string
  decidedAt: string | null
  decidedByUserId?: string | null
  verdict: string | null
  message: string | null
}

export type SellerProfileInfo = {
  sellerId: string
  displayName: string
  description: string | null
  address: string | null
  slug: string | null
  contactEmail: string | null
  contactPhone: string | null
  status: SellerStatus
  latestReview: SellerReviewSummary | null
  createdAt: string
  updatedAt: string
}

export type SellerPerson = { surname: string; name: string; patronymic: string | null }
export type SellerDirector = SellerPerson & { position: string }

/**
 * The legal identity is a discriminated union on `kind`, flattened onto one object by the API:
 * `self_employed` carries `person`; `sole_proprietor` and `company` carry the business block, and a
 * company adds `kpp`.
 */
export type SellerLegalIdentity = {
  legalIdentityId: string
  inn: string
  kind: SellerKind
  person?: SellerPerson | null
  legalName?: string | null
  registrationNumber?: string | null
  legalAddress?: string | null
  taxationSystem?: string | null
  vatRate?: string | null
  director?: SellerDirector | null
  kpp?: string | null
}

export type SellerAgreement = {
  number: number
  acceptedAt: string
  status: 'accepted' | 'active' | 'terminated' | (string & {})
  activatedAt: string | null
  terminatedAt: string | null
}

export type SellerReadinessItem = {
  key: 'profile' | 'seller_profile' | 'payout' | (string & {})
  status: 'ready' | 'missing' | 'awaiting_registration' | (string & {})
  hint: string | null
}

export type SellerReadiness = {
  sellerId: string
  status: SellerStatus
  canSubmit: boolean
  isPublic: boolean
  canBePaid: boolean
  items: SellerReadinessItem[]
  latestReview: SellerReviewSummary | null
}

export type SellerOwner = {
  userId: string
  name: string
  surname: string
  phone: string | null
  email: string | null
  emailVerified: boolean
}

export type SellerMember = {
  membershipId: string
  userId: string
  name: string
  surname: string
  phone: string | null
  role: string
  createdAt: string
}

export type SellerCard = {
  profile: SellerProfileInfo
  seller: SellerLegalIdentity | null
  agreement: SellerAgreement | null
  readiness: SellerReadiness
  reviews: SellerReviewSummary[]
  owner: SellerOwner | null
  members: SellerMember[]
}

export type SellerMembership = {
  membershipId: string
  userId: string
  sellerId: string
  role: string
  createdAt: string
}

/**
 * The seller list is paged and RSQL-filtered — there is no `status` query param any more. Filter by
 * status through `filter`, e.g. `rsqlStatus('pending_review')` or `status=in=(draft,changes_requested)`.
 */
export function getSellers(params: ListQueryParams = {}) {
  return requestJson<PagedResult<SellerListItem>>(`/internal/sellers${listQuery(params)}`)
}

/** The same waiting queue as `status==pending_review`, with leaner rows and oldest-first by default. */
export function getSellerReviewQueue(status?: SellerStatus, params: ListQueryParams = {}) {
  return requestJson<PagedResult<SellerReviewQueueItem>>(`/internal/sellers/review-queue${listQuery(params, status ? { status } : undefined)}`)
}

/** RSQL equality for a single status, e.g. `status==pending_review`. */
export function rsqlStatus(status: string) {
  return `status==${status}`
}

export function getSeller(sellerId: string) {
  return requestJson<SellerCard>(`/internal/sellers/${id(sellerId)}`)
}

export function getSellerMemberships(sellerId: string) {
  return requestJson<SellerMembership[]>(`/internal/sellers/${id(sellerId)}/memberships`)
}

export function postSellerAction(sellerId: string, action: SellerAction, message?: string) {
  return jsonBody<SellerProfileInfo>('POST', `/internal/sellers/${id(sellerId)}/actions`, { action, message: message || undefined })
}


// ─── Payouts and bank binding ─────────────────────────────────────────────────────────────────

export type SellerPayoutDetails = {
  method: 'sbp' | 'bank_account' | (string & {})
  hasDetails: boolean
  status: string | null
  registered: boolean
  beneficiaryName: string | null
  phone: string | null
  sbpMemberId: string | null
  bankName: string | null
  account: string | null
  bik: string | null
  correspondentAccount: string | null
}

export type SellerPayoutShop = {
  shopCode: string
  billingDescriptor: string
  shortName: string
  email: string
  ceoName: string
  ceoPhone: string
  legalAddress: string
  bankAccount: string
  bik: string
  bankName: string
  updatedAt: string
}

export type SellerPayoutShopPreview = {
  billingDescriptor: string
  fullName: string
  shortName: string
  inn: string
  kpp: string | null
  ogrn: string
  legalAddressZip: string
  legalAddressCity: string
  legalAddressStreet: string
  email: string
  ceoFirstName: string
  ceoLastName: string
  ceoPhone: string
  ceoBirthDate: string | null
  bankAccount: string
  bik: string
  bankName: string
  correspondentAccount: string | null
  paymentDetails: string
}

export type SellerPayoutRegistration = {
  kind: SellerKind
  method: string
  registered: boolean
  sbpRecipientStatus: string | null
  shop: SellerPayoutShop | null
  preview: SellerPayoutShopPreview | null
  missing: string[]
  bankAccountOutOfSync: boolean
}

export type SellerPayout = {
  details: SellerPayoutDetails
  registration: SellerPayoutRegistration
}

/** Overrides fill the `missing[]` fields the preview could not assemble from stored facts. */
export type SellerPayoutOverrides = {
  shortName?: string
  email?: string
  ceoPhone?: string
  ceoBirthDate?: string
}

export function getSellerPayout(sellerId: string) {
  return requestJson<SellerPayout>(`/internal/sellers/${id(sellerId)}/payout`)
}

export function postSellerPayoutRegister(sellerId: string, overrides: SellerPayoutOverrides = {}) {
  return jsonBody<SellerPayout>('POST', `/internal/sellers/${id(sellerId)}/payout/register`, overrides)
}

export function postSellerPayoutSyncBankAccount(sellerId: string) {
  return postNoBody<SellerPayout>(`/internal/sellers/${id(sellerId)}/payout/sync-bank-account`)
}

export type AcquiringCommandResult = {
  status: string
  actionCode: string
  reasonCode: string | null
}

export type DealBindingMode = 'use_existing_deal' | 'create_on_init' | (string & {})

export type DealBinding = {
  bindingId: string
  sellerId: string
  status: 'draft' | 'active' | 'superseded' | 'blocked' | (string & {})
  mode: string
  dealId: string | null
  createDealWithType: string | null
  diagnostics: { existingDealIdPresent: boolean; createDealWithType: string | null } | null
  createdAt: string
  updatedAt: string
}

export type DealBindingCommand = { dealBinding: DealBinding; result: AcquiringCommandResult }

export type PayoutDestination = {
  destinationId: string
  sellerId: string
  kind: string
  status: 'draft' | 'active' | 'retired' | 'rejected' | 'blocked' | (string & {})
  beneficiaryName: string | null
  shopCode: string | null
  phone: string | null
  sbpMemberId: string | null
  displayBankName: string | null
  createdAt: string
  updatedAt: string
}

export type PayoutDestinationCommand = { destination: PayoutDestination; result: AcquiringCommandResult }

export function postSellerDealBinding(sellerId: string, request: { mode: DealBindingMode; dealId?: string; createDealWithType?: string }) {
  return jsonBody<DealBindingCommand>('POST', `/internal/sellers/${id(sellerId)}/deal-binding`, request)
}

export type DealBindingAction = 'activate' | 'block'

export function postSellerDealBindingAction(sellerId: string, bindingId: string, request: { action: DealBindingAction; reasonCode?: string; comments?: string }) {
  return jsonBody<DealBindingCommand>('POST', `/internal/sellers/${id(sellerId)}/deal-bindings/${id(bindingId)}/actions`, request)
}

export type PayoutDestinationAction = 'activate' | 'reject' | 'block'

export function postSellerPayoutDestinationAction(sellerId: string, destinationId: string, request: { action: PayoutDestinationAction; reasonCode?: string; comments?: string }) {
  return jsonBody<PayoutDestinationCommand>('POST', `/internal/sellers/${id(sellerId)}/payout-destinations/${id(destinationId)}/actions`, request)
}

export type SbpMember = { sbpMemberId: string; displayBankName: string; bankName: string }

export function getSbpMembers() {
  return requestJson<{ source: string; items: SbpMember[] }>('/api/v1/payment-reference/sbp-members')
}


// ═══ Product review ══════════════════════════════════════════════════════════════════════════

export type ProductStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'paused'
  | 'suspended'
  | 'archived'
  | (string & {})

export type ProductAction = 'approve' | 'request_changes' | 'reject' | 'suspend'

export type ProductReviewQueueItem = {
  productId: string
  sellerId: string
  sellerDisplayName: string
  title: string
  status: ProductStatus
  submittedAt: string
}

export type ProductSection = {
  key: string
  title: string
  isComplete: boolean
  missing: string | null
}

export type ProductReview = {
  openedAt: string
  decidedAt: string | null
  verdict: string | null
  message: string | null
}

export type ProductReviewCard = {
  productId: string
  sellerId: string
  sellerDisplayName: string
  title: string
  description: string | null
  quantity: number
  status: ProductStatus
  sections: ProductSection[]
  history: ProductReview[]
}

/** Paged, oldest-first; `status` defaults to `pending_review` server-side when omitted. */
export function getProductReviewQueue(status?: ProductStatus, params: ListQueryParams = {}) {
  return requestJson<PagedResult<ProductReviewQueueItem>>(`/internal/products/review-queue${listQuery(params, status ? { status } : undefined)}`)
}

export function getProductReviewCard(productId: string) {
  return requestJson<ProductReviewCard>(`/internal/products/${id(productId)}`)
}

export function postProductAction(productId: string, action: ProductAction, message?: string) {
  return jsonBody<ProductReviewCard>('POST', `/internal/products/${id(productId)}/actions`, { action, message: message || undefined })
}


// ═══ Payments, refunds, settlements, ledger ═══════════════════════════════════════════════════

export type LedgerCoverage = {
  expectsCollection: boolean
  hasCollection: boolean
  expectsRefund: boolean
  hasRefund: boolean
  expectsSettlement: boolean
  hasSettlementProjection: boolean
  expectsPayoutExecution: boolean
  hasPayoutExecution: boolean
}

export type LedgerStatus = {
  status: string
  hasMissingFacts: boolean
  entryCount: number
  postedEntryCount: number
  pendingRecoveryEntryCount: number
  debitAmount: number
  creditAmount: number
  coverage: LedgerCoverage
}

export type PaymentRoutingSnapshot = {
  dealId: string | null
  payoutMode: string | null
  recipientId: string | null
  payoutDestinationId: string | null
}

export type InternalPaymentDetail = {
  paymentIntentId: string
  bookingId: string
  collectionStatus: string
  settlementStatus: string
  refundStatus: string
  totalChargeAmount: number
  prepaidServiceAmount: number
  depositAmount: number
  retentionDeadlineAt: string | null
  settlementPlanId: string | null
  ledgerStatus: LedgerStatus | null
  routingSnapshot: PaymentRoutingSnapshot | null
  updatedAt: string
}

export type PaymentStatus = {
  bookingId: string
  paymentId: string
  providerCode: string
  paymentMethod: string
  paymentStatus: string
  externalStatus: string
  amountMinorUnits: number
  refundedAmountMinorUnits: number
  paymentUrl: string | null
  redirectDueDate: string | null
  paidAt: string | null
  refundedAt: string | null
  updatedAt: string
}

export type PaymentCancel = {
  bookingId: string
  paymentId: string
  paymentStatus: string
  externalStatus: string
  updatedAt: string
}

export type PaymentRefund = {
  bookingId: string
  paymentId: string
  paymentStatus: string
  externalStatus: string
  refundedAmountMinorUnits: number
  updatedAt: string
}

export type RefundSnapshot = {
  refundedAt: string | null
  externalStatus: string | null
  collectionStatus: string | null
  refundableAmount: number
  sellerPayoutAmount: number
  platformCommissionAmount: number
}

export type InternalRefundCase = {
  paymentId: string
  bookingId: string
  refundStatus: string
  collectedAmountMinorUnits: number
  refundedAmountMinorUnits: number
  remainingRefundableAmountMinorUnits: number
  settlementPlanId: string | null
  settlementStatus: string | null
  settlementImpactReviewRequired: boolean
  snapshot: RefundSnapshot | null
  updatedAt: string
}

export type SettlementCommandResult = { status: string; actionCode: string; reasonCode: string | null }
export type RefundCommand = { refundCase: InternalRefundCase; result: SettlementCommandResult }

export type PayoutRecipientSnapshot = {
  snapshotId: string
  mode: string
  payoutDestinationId: string | null
  recipientId: string | null
  beneficiaryName: string | null
  bankName: string | null
  bik: string | null
  maskedBankAccount: string | null
  correspondentAccount: string | null
  phone: string | null
  sbpMemberId: string | null
  displayBankName: string | null
  capturedAt: string
}

export type PayoutExecution = {
  payoutExecutionId: string
  settlementPlanId: string
  dealId: string | null
  recipientSnapshotId: string | null
  amount: number
  status: string
  externalPayoutRef: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  paidAt: string | null
  failedAt: string | null
}

export type SettlementPlan = {
  settlementPlanId: string
  bookingId: string
  paymentIntentId: string
  sellerId: string
  dealId: string | null
  outcomeType: string
  grossCollectedAmount: number
  refundableAmount: number
  sellerPayoutAmount: number
  platformCommissionAmount: number
  status: string
  recipientSnapshot: PayoutRecipientSnapshot | null
  payoutExecution: PayoutExecution | null
  createdAt: string
  updatedAt: string
  executedAt: string | null
}

export type LedgerEntryMetadata = {
  paymentStatus: string | null
  externalStatus: string | null
  orderId: string | null
  refundedAt: string | null
  settlementStatus: string | null
  outcomeType: string | null
  payoutStatus: string | null
  dealId: string | null
  bookingStatus: string | null
}

export type LedgerEntry = {
  ledgerEntryId: string
  entryKey: string
  bookingId: string | null
  paymentId: string | null
  settlementPlanId: string | null
  payoutExecutionId: string | null
  sellerId: string | null
  entryType: string
  direction: string
  amount: number
  status: string
  sourceAuthority: string
  correlationRef: string | null
  externalRef: string | null
  metadata: LedgerEntryMetadata | null
  occurredAt: string
  createdAt: string
  updatedAt: string
}

export type LedgerView = {
  bookingId: string | null
  paymentId: string | null
  settlementPlanId: string | null
  payoutExecutionId: string | null
  sellerId: string | null
  status: LedgerStatus
  entries: LedgerEntry[]
  updatedAt: string
}

export function getPayment(paymentId: string) {
  return requestJson<InternalPaymentDetail>(`/internal/payments/${id(paymentId)}`)
}

export function getPaymentStatus(paymentId: string) {
  return requestJson<PaymentStatus>(`/internal/payments/${id(paymentId)}/status`)
}

export function postPaymentSync(paymentId: string) {
  return postNoBody<PaymentStatus>(`/internal/payments/${id(paymentId)}/sync`)
}

export function postPaymentCancel(paymentId: string) {
  return postNoBody<PaymentCancel>(`/internal/payments/${id(paymentId)}/cancel`)
}

export function getPaymentRefundCase(paymentId: string) {
  return requestJson<InternalRefundCase>(`/internal/payments/${id(paymentId)}/refund`)
}

/** `amountMinorUnits` is in kopecks, not roubles — this endpoint talks to the acquirer. Omit for a full refund. */
export function postPaymentRefund(paymentId: string, request: { amountMinorUnits?: number; reasonCode?: string }) {
  return jsonBody<PaymentRefund>('POST', `/internal/payments/${id(paymentId)}/refund`, request)
}

export function postPaymentRefundReviewSettlementImpact(paymentId: string, request: { reasonCode?: string; comments?: string }) {
  return jsonBody<RefundCommand>('POST', `/internal/payments/${id(paymentId)}/refund-case/review-settlement-impact`, request)
}

export function getBookingPayment(bookingId: string) {
  return requestJson<InternalPaymentDetail>(`/internal/bookings/${id(bookingId)}/payment`)
}

export function getBookingRefundCase(bookingId: string) {
  return requestJson<InternalRefundCase>(`/internal/bookings/${id(bookingId)}/refund`)
}

/** Pay a single booking out by hand — for one the scheduled worker missed. Takes no body; check the ledger after. */
export function postBookingPayout(bookingId: string) {
  return postNoBody<SettlementPlan>(`/internal/bookings/${id(bookingId)}/payout`)
}

export function getSettlementPlan(settlementPlanId: string) {
  return requestJson<SettlementPlan>(`/internal/settlements/${id(settlementPlanId)}`)
}

export function getLedgerForBooking(bookingId: string) {
  return requestJson<LedgerView>(`/internal/ledger/bookings/${id(bookingId)}`)
}

export function getLedgerForPayment(paymentId: string) {
  return requestJson<LedgerView>(`/internal/ledger/payments/${id(paymentId)}`)
}


// ═══ Catalogue schema (equipment categories, attributes, bindings) ════════════════════════════

export type TaxonomyStatus = 'active' | 'archived' | (string & {})
export type EquipmentValueType = 'string' | 'integer' | 'decimal' | 'boolean' | 'enum' | 'reference' | (string & {})

export type EquipmentCategoryResponse = {
  categoryId: string
  slug: string
  name: string
  status: TaxonomyStatus
  sortOrder: number
}

export type EquipmentCategoryAdminResponse = EquipmentCategoryResponse & { createdAt: string }

export type EquipmentAttributeAdminResponse = {
  attributeId: string
  key: string
  valueType: EquipmentValueType
  name: string
  hint: string | null
  unitLabel: string | null
  unit: string | null
  status: TaxonomyStatus
  createdAt: string
}

export type EquipmentAttributeAdminPagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type EquipmentAttributeAdminListResponse = {
  items: EquipmentAttributeAdminResponse[]
  pagination: EquipmentAttributeAdminPagination
}

export type EquipmentAttributeAllowedValueResponse = {
  valueKey: string
  name: string
  sortOrder: number
}

/** The attribute as bound to a category — carries the category-specific rules (required, bounds, group). */
export type EquipmentAttributeResponse = {
  attributeId: string
  key: string
  name: string
  hint: string | null
  valueType: EquipmentValueType
  unit: string | null
  unitLabel: string | null
  filterable: boolean
  isRequired: boolean
  groupKey: string | null
  groupName: string | null
  minValue: number | null
  maxValue: number | null
  minLength: number | null
  maxLength: number | null
  sortOrder: number
  allowedValues: EquipmentAttributeAllowedValueResponse[]
}

export type EquipmentAttributeSchemaResponse = {
  category: EquipmentCategoryResponse
  attributes: EquipmentAttributeResponse[]
}

export type EquipmentCategoryBindingResponse = {
  bindingId: string
  categoryId: string
  attributeId: string
  filterable: boolean
  sortOrder: number
  createdAt: string
}

export type EquipmentAllowedValueAdminResponse = {
  attributeDefinitionId: string
  valueKey: string
  name: string
  sortOrder: number
}

export function getEquipmentCategories(locale = 'ru-RU') {
  return requestJson<EquipmentCategoryResponse[]>(`/internal/equipment-categories?locale=${id(locale)}`)
}

export function getEquipmentCategoryAttributes(categorySlug: string, locale = 'ru-RU') {
  return requestJson<EquipmentAttributeSchemaResponse>(`/internal/equipment-categories/${id(categorySlug)}/attributes?locale=${id(locale)}`)
}

export function createEquipmentCategory(request: { slug: string; name: string; status: TaxonomyStatus; sortOrder: number }) {
  return jsonBody<EquipmentCategoryAdminResponse>('POST', '/internal/equipment-categories', request)
}

export function patchEquipmentCategory(categoryId: string, request: { slug?: string; name?: string; status?: TaxonomyStatus; sortOrder?: number }) {
  return jsonBody<EquipmentCategoryAdminResponse>('PATCH', `/internal/equipment-categories/${id(categoryId)}`, request)
}

export function getEquipmentAttributes(query?: { status?: string; query?: string; page?: number; pageSize?: number }) {
  const searchParams = new URLSearchParams()
  if (query?.status) searchParams.set('status', query.status)
  if (query?.query) searchParams.set('query', query.query)
  searchParams.set('page', String(query?.page ?? 1))
  searchParams.set('pageSize', String(query?.pageSize ?? 50))
  return requestJson<EquipmentAttributeAdminListResponse>(`/internal/equipment-attributes?${searchParams.toString()}`)
}

export function getEquipmentAttribute(attributeId: string) {
  return requestJson<EquipmentAttributeAdminResponse>(`/internal/equipment-attributes/${id(attributeId)}`)
}

export function createEquipmentAttribute(request: { key: string; valueType: EquipmentValueType; unit?: string; name: string; hint?: string; unitLabel?: string; status: TaxonomyStatus }) {
  return jsonBody<EquipmentAttributeAdminResponse>('POST', '/internal/equipment-attributes', request)
}

export function patchEquipmentAttribute(attributeId: string, request: { key?: string; valueType?: EquipmentValueType; unit?: string; name?: string; hint?: string; unitLabel?: string; status?: TaxonomyStatus }) {
  return jsonBody<EquipmentAttributeAdminResponse>('PATCH', `/internal/equipment-attributes/${id(attributeId)}`, request)
}

/** Replaces the whole allowed-value list for an `enum` attribute. */
export function putEquipmentAllowedValues(attributeId: string, values: Array<{ valueKey: string; name: string; sortOrder?: number }>) {
  return jsonBody<EquipmentAllowedValueAdminResponse[]>('PUT', `/internal/equipment-attributes/${id(attributeId)}/allowed-values`, { values })
}

export function bindEquipmentAttributeToCategory(categoryId: string, request: { attributeId: string; filterable?: boolean; sortOrder?: number }) {
  return jsonBody<EquipmentCategoryBindingResponse>('POST', `/internal/equipment-categories/${id(categoryId)}/attributes`, request)
}

export function patchEquipmentCategoryBinding(categoryId: string, attributeId: string, request: { filterable?: boolean; sortOrder?: number }) {
  return jsonBody<EquipmentCategoryBindingResponse>('PATCH', `/internal/equipment-categories/${id(categoryId)}/attributes/${id(attributeId)}`, request)
}


// ═══ Users ════════════════════════════════════════════════════════════════════════════════════

export type InternalUserSummaryResponse = {
  userId: string
  name: string
  surname: string
  email?: string | null
  phone?: string | null
  emailVerified: boolean
  phoneVerified: boolean
  createdAt: string
  updatedAt: string
}

export type InternalUserDetailResponse = InternalUserSummaryResponse & {
  platformRole: string | null
  memberships: SellerMembership[]
}

export type InternalUsersListResponse = PagedResult<InternalUserSummaryResponse>
export type InternalUserManagementOptionsResponse = InternalListOptionsResponse

export async function getInternalUsers(query?: InternalListQuery) {
  return requestJson<InternalUsersListResponse>(buildInternalListUrl('/internal/users', query))
}

export function getInternalUserManagementOptions() {
  return requestJson<InternalUserManagementOptionsResponse>('/internal/users/options')
}

export function getInternalUser(userId: string) {
  return requestJson<InternalUserDetailResponse>(`/internal/users/${id(userId)}`)
}
