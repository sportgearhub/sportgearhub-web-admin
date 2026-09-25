import { getFreshAuthorizationHeader, refreshStoredAuthTokens } from '../auth/authApi'
import { keysToCamel, keysToSnake } from '../../lib/case-convert'
import { getStoredAuthTokens } from '../auth/authTokenStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

type ApiErrorBody = {
  message?: string
  title?: string
}

export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}


export type PaginationResponse = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
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


export type EquipmentCategoryResponse = {
  categoryId: string
  slug: string
  label: string
  labels?: Record<string, string> | null
  resourceType: string
  capacityMode: string
  status: string
  sortOrder: number
}

export type EquipmentAttributeResponse = {
  attributeId: string
  key: string
  label: string
  labels?: Record<string, string> | null
  valueType: string
  unit?: string | null
  unitLabel?: string | null
  referenceType?: string | null
  requiredOn?: string[] | null
  appliesTo?: string[] | null
  visibleWhen?: unknown[] | null
  filterable?: boolean
  comparable?: boolean
  searchable?: boolean
  sortOrder: number
  allowedValues?: Array<{
    valueKey?: string
    label?: string
    labels?: Record<string, string> | null
    sortOrder?: number
  }> | null
}

export type EquipmentAttributeSchemaResponse = {
  category: EquipmentCategoryResponse
  attributes: EquipmentAttributeResponse[]
}

export type EquipmentBrandReviewStatus = 'approved' | 'pending_review' | 'merged' | 'rejected' | 'archived' | string
export type EquipmentBrandReviewAction = 'approve' | 'reject' | 'archive' | 'merge' | string

export type EquipmentBrandOption = {
  value: string
  label: string
}

export type EquipmentBrandActionOption = EquipmentBrandOption & {
  requiresReasonCode: boolean
  requiresTargetBrandId: boolean
  allowedSourceStatuses: string[]
}

export type EquipmentBrandReasonOption = EquipmentBrandOption & {
  appliesToActions: string[]
}

export type EquipmentBrandFieldOption = {
  key: string
  label: string
  filterable: boolean
  searchable: boolean
  sortable: boolean
}

export type EquipmentBrandOptionsResponse = {
  statuses: EquipmentBrandOption[]
  actions: EquipmentBrandActionOption[]
  reasonCodes: EquipmentBrandReasonOption[]
  fields: EquipmentBrandFieldOption[]
  pagination: {
    defaultPage: number
    defaultPageSize: number
    maxPageSize: number
  }
}

export type EquipmentBrandAliasResponse = {
  aliasId: string
  alias: string
  normalizedAlias: string
  locale?: string | null
  source: string
  status: string
  createdAt: string
  updatedAt: string
}

export type EquipmentBrandResponse = {
  brandId: string
  canonicalName: string
  normalizedName: string
  status: EquipmentBrandReviewStatus
  website?: string | null
  countryCode?: string | null
  createdByProviderId?: string | null
  mergedIntoBrandId?: string | null
  reviewedByUserId?: string | null
  reviewReasonCode?: string | null
  reviewComments?: string | null
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
  aliases: EquipmentBrandAliasResponse[]
}

export type EquipmentBrandListResponse = {
  items: EquipmentBrandResponse[]
  summary?: {
    total: number
    byStatus: Record<string, number>
  }
  pagination: PaginationResponse
}

export type EquipmentBrandPatchRequest = {
  canonicalName: string
  website: string | null
  countryCode: string | null
  comments: string | null
}

export type EquipmentBrandCommandResponse = {
  status?: string
  action?: string
  brand: EquipmentBrandResponse
}

export type EquipmentBrandActionRequest = {
  action: EquipmentBrandReviewAction
  reasonCode: string | null
  comments: string | null
  targetBrandId?: string | null
}

export type EquipmentBrandMergeCandidateResponse = {
  brandId: string
  canonicalName: string
  normalizedName: string
  status: string
  confidence?: number | null
  matchKind?: string | null
  aliases?: string[] | null
}

export type EquipmentBrandMergeCandidatesResponse = {
  items: EquipmentBrandMergeCandidateResponse[]
}

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

export type InternalProviderMembershipResponse = {
  providerMembershipId: string
  userId: string
  providerId: string
  role: string
  createdAt: string
  updatedAt: string
}

export type InternalUserDetailResponse = InternalUserSummaryResponse & {
  providerMemberships: InternalProviderMembershipResponse[]
}

export type InternalUsersListResponse = {
  items: InternalUserSummaryResponse[]
  pagination: PaginationResponse
}

export type InternalUserManagementOptionsResponse = InternalListOptionsResponse


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

function normalizeInternalListResponse<TItem>(response: TItem[] | { items: TItem[]; pagination: PaginationResponse }, query?: InternalListQuery) {
  if (Array.isArray(response)) {
    const page = query?.page ?? 1
    const pageSize = query?.pageSize ?? response.length
    const totalItems = response.length
    const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(pageSize, 1)))

    return {
      items: response,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    }
  }

  return response
}

async function parseError(response: Response) {
  try {
    const errorBody = keysToCamel<ApiErrorBody>(await response.json())
    return errorBody.message ?? errorBody.title ?? `Сервис вернул ${response.status}`
  } catch {
    return `Сервис вернул ${response.status}`
  }
}

async function requestJson<TResponse>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const authorizationHeader = await getFreshAuthorizationHeader()

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  // Call sites build camelCase bodies; the wire format is snake_case. Converting here keeps a single
  // translation point instead of hand-editing every request literal.
  const requestInit: RequestInit = { ...init }
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
    const errorMessage = await parseError(response)
    if (response.status === 404) {
      throw new NotFoundError(errorMessage)
    }
    throw new Error(errorMessage)
  }

  return keysToCamel<TResponse>(await response.json())
}


export function getEquipmentCategories(locale = 'ru-RU') {
  const searchParams = new URLSearchParams()
  searchParams.set('locale', locale)

  return requestJson<EquipmentCategoryResponse[]>(`/internal/equipment-categories?${searchParams.toString()}`)
}

export function getEquipmentCategoryAttributes(categorySlug: string, locale = 'ru-RU') {
  const searchParams = new URLSearchParams()
  searchParams.set('locale', locale)

  return requestJson<EquipmentAttributeSchemaResponse>(
    `/internal/equipment-categories/${encodeURIComponent(categorySlug)}/attributes?${searchParams.toString()}`,
  )
}

export function getEquipmentBrandOptions() {
  return requestJson<EquipmentBrandOptionsResponse>('/internal/equipment-brands/options')
}

export function getEquipmentBrands({
  status,
  query,
  page,
  pageSize,
}: {
  status?: string
  query?: string
  page: number
  pageSize: number
}) {
  const searchParams = new URLSearchParams()

  if (status) {
    searchParams.set('status', status)
  }

  if (query) {
    searchParams.set('query', query)
  }

  searchParams.set('page', String(page))
  searchParams.set('pageSize', String(pageSize))

  return requestJson<EquipmentBrandListResponse>(`/internal/equipment-brands?${searchParams.toString()}`)
}

export function getEquipmentBrand(brandId: string) {
  return requestJson<EquipmentBrandResponse>(`/internal/equipment-brands/${encodeURIComponent(brandId)}`)
}

export function patchEquipmentBrand(brandId: string, request: EquipmentBrandPatchRequest) {
  return requestJson<EquipmentBrandCommandResponse>(`/internal/equipment-brands/${encodeURIComponent(brandId)}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  })
}

export function getEquipmentBrandMergeCandidates(brandId: string, query?: string, limit = 10) {
  const searchParams = new URLSearchParams()

  if (query) {
    searchParams.set('query', query)
  }

  searchParams.set('limit', String(limit))

  return requestJson<EquipmentBrandMergeCandidatesResponse>(
    `/internal/equipment-brands/${encodeURIComponent(brandId)}/merge-candidates?${searchParams.toString()}`,
  )
}

export function postEquipmentBrandAction(brandId: string, request: EquipmentBrandActionRequest) {
  return requestJson<EquipmentBrandCommandResponse>(`/internal/equipment-brands/${encodeURIComponent(brandId)}/actions`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function getInternalUsers(query?: InternalListQuery) {
  const response = await requestJson<InternalUserSummaryResponse[] | InternalUsersListResponse>(buildInternalListUrl('/internal/users', query))

  return normalizeInternalListResponse(response, query)
}

export function getInternalUserManagementOptions() {
  return requestJson<InternalUserManagementOptionsResponse>('/internal/users/options')
}

export function getInternalUser(userId: string) {
  return requestJson<InternalUserDetailResponse>(`/internal/users/${encodeURIComponent(userId)}`)
}


// ─── Providers: review and payout registration ─────────────────────────────────────────────────

export type ProviderStatus = 'draft' | 'pending_review' | 'changes_requested' | 'rejected' | 'active' | 'suspended' | 'archived' | string
export type SellerKind = 'self_employed' | 'sole_proprietor' | 'company' | string
export type ProviderAction = 'approve' | 'request_changes' | 'reject' | 'reopen' | 'suspend' | 'activate' | 'archive'

export type ProviderListItem = {
  providerId: string
  displayName: string
  status: ProviderStatus
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

export type ProviderReviewSummary = {
  reviewId?: string
  openedAt: string
  decidedAt: string | null
  decidedByUserId: string | null
  verdict: string | null
  message: string | null
}

export type ProviderProfile = {
  providerId: string
  displayName: string
  description: string | null
  address: string | null
  slug: string | null
  contactEmail: string | null
  contactPhone: string | null
  status: ProviderStatus
  latestReview: ProviderReviewSummary | null
  createdAt: string
  updatedAt: string
}

export type SellerProfile = {
  sellerProfileId: string
  kind: SellerKind
  inn: string
  person: { lastName: string; firstName: string; middleName: string | null } | null
  business: {
    legalName: string
    registrationNumber: string
    legalAddress: string
    taxationSystem: string
    vatRate: string
    director: { lastName: string; firstName: string; middleName: string | null; position: string }
  } | null
  company: { kpp: string } | null
  updatedAt: string
}

export type ProviderAgreement = {
  number: number
  acceptedAt: string
  status: 'accepted' | 'active' | 'terminated' | string
  activatedAt: string | null
  terminatedAt: string | null
}

export type ProviderReadiness = {
  providerId: string
  status: ProviderStatus
  canSubmit: boolean
  isPublic: boolean
  canBePaid: boolean
  items: Array<{ key: string; status: string; hint: string | null }>
  latestReview: ProviderReviewSummary | null
}

export type ProviderPerson = {
  userId: string
  name: string
  surname: string
  phone: string | null
  email: string | null
  emailVerified?: boolean
}

export type ProviderMember = ProviderPerson & {
  membershipId: string
  role: string
  createdAt: string
}

export type ProviderCard = {
  profile: ProviderProfile
  seller: SellerProfile | null
  agreement: ProviderAgreement | null
  readiness: ProviderReadiness
  reviews: ProviderReviewSummary[]
  owner: ProviderPerson | null
  members: ProviderMember[]
}

export type ProviderPayoutDetails = {
  method: 'sbp' | 'bank_account' | string
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
  updatedAt: string | null
}

export type ProviderPayoutShopPreview = {
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

export type ProviderPayoutShop = {
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

export type ProviderPayout = {
  details: ProviderPayoutDetails
  registration: {
    kind: SellerKind
    method: string
    registered: boolean
    sbpRecipientStatus: string | null
    shop: ProviderPayoutShop | null
    preview: ProviderPayoutShopPreview | null
    missing: string[]
    bankAccountOutOfSync: boolean
  }
}

export type ProviderPayoutOverrides = {
  shortName?: string
  email?: string
  ceoPhone?: string
  ceoBirthDate?: string
}

export function getProviders(status?: ProviderStatus) {
  return requestJson<ProviderListItem[]>(status ? `/internal/providers?status=${encodeURIComponent(status)}` : '/internal/providers')
}

export function getProviderCard(providerId: string) {
  return requestJson<ProviderCard>(`/internal/providers/${encodeURIComponent(providerId)}`)
}

export function getInternalProviderMemberships(providerId: string) {
  return requestJson<InternalProviderMembershipResponse[]>(`/internal/providers/${encodeURIComponent(providerId)}/memberships`)
}

export function postProviderAction(providerId: string, action: ProviderAction, message?: string) {
  return requestJson<ProviderProfile>(`/internal/providers/${encodeURIComponent(providerId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action, message: message || undefined }),
  })
}

export function getProviderPayout(providerId: string) {
  return requestJson<ProviderPayout>(`/internal/providers/${encodeURIComponent(providerId)}/payout`)
}

export function postProviderPayoutRegister(providerId: string, overrides: ProviderPayoutOverrides) {
  return requestJson<ProviderPayout>(`/internal/providers/${encodeURIComponent(providerId)}/payout/register`, {
    method: 'POST',
    body: JSON.stringify(overrides),
  })
}

export function postProviderPayoutSyncBankAccount(providerId: string) {
  return requestJson<ProviderPayout>(`/internal/providers/${encodeURIComponent(providerId)}/payout/sync-bank-account`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
