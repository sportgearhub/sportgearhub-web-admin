import { getFreshAuthorizationHeader, refreshStoredAuthTokens } from '../auth/authApi'
import { getStoredAuthTokens } from '../auth/authTokenStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

type ApiErrorBody = {
  message?: string
  title?: string
}

export type ProviderOnboardingChecklistStatus = 0 | 1

export type ProviderOnboardingResponse = {
  applicationId?: string | null
  providerId?: string | null
  status: string
  checklist?: {
    profile?: ProviderOnboardingChecklistStatus
    legal?: ProviderOnboardingChecklistStatus
  } | null
  draft?: {
    displayName?: string | null
    legalName?: string | null
    legalCountryCode?: string | null
    legalForm?: string | null
    taxNumber?: string | null
    registrationNumber?: string | null
    branchNumber?: string | null
    registeredAddress?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    cityId?: string | null
    address?: string | null
    description?: string | null
  } | null
  updatedAt: string
}

export type ProviderOnboardingSummaryResponse = {
  applicationId: string
  applicantUserId?: string | null
  providerId?: string | null
  status: string
  displayName?: string | null
  legalName?: string | null
  legalCountryCode?: string | null
  legalForm?: string | null
  taxNumber?: string | null
  contactEmail?: string | null
  submittedAt?: string | null
  updatedAt: string
}

export type ProviderOnboardingFilterFieldResponse = {
  name: string
  type: string
  operators: string[]
  values?: string[] | null
}

export type ProviderOnboardingSortFieldResponse = {
  name: string
  type: string
}

export type ProviderOnboardingFilterExampleResponse = {
  label: string
  filter: string
}

export type ProviderOnboardingListOptionsResponse = {
  filterFields: ProviderOnboardingFilterFieldResponse[]
  sortFields: ProviderOnboardingSortFieldResponse[]
  filterExamples: ProviderOnboardingFilterExampleResponse[]
  sortExamples: string[]
  defaultFilter: string
  defaultSort: string
}

export type PaginationResponse = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type ProviderOnboardingQueueResponse = {
  items: ProviderOnboardingSummaryResponse[]
  pagination: PaginationResponse
}

export type ProviderOnboardingQueueQuery = {
  filter?: string
  sort?: string
  page: number
  pageSize: number
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

export type ProviderOnboardingAction = 'approve' | 'request_changes' | 'reject'

type ProviderOnboardingActionRequest = {
  action: ProviderOnboardingAction
  reasonCode: string | null
  comments: string | null
}

type ProviderOnboardingActionResponse = {
  onboarding: ProviderOnboardingResponse
  result?: {
    status?: string
    actionCode?: string
    reasonCode?: string | null
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

export type InternalUserRoleResponse = {
  userRoleId: string
  userId: string
  role: string
  createdAt: string
  updatedAt: string
}

export type InternalExternalAuthProviderResponse = {
  externalAuthProviderId: string
  userId: string
  provider: string
  externalId: string
  hasExternalToken: boolean
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
  roles: InternalUserRoleResponse[]
  externalAuthProviders: InternalExternalAuthProviderResponse[]
  providerMemberships: InternalProviderMembershipResponse[]
}

export type InternalUsersListResponse = {
  items: InternalUserSummaryResponse[]
  pagination: PaginationResponse
}

export type InternalUserManagementOptionsResponse = InternalListOptionsResponse

export type ProviderGovernanceDiagnosticsResponse = {
  hasProfileContact: boolean
  activeResources: number
  totalResources: number
  activeOffers: number
  totalOffers: number
  acquiringConnectionId?: string | null
  acquiringStatus?: string | null
  activeRoutes: number
  activeBindings: number
  acquiringOnboardingStatus?: string | null
}

export type ProviderGovernanceSummaryResponse = {
  providerId: string
  displayName: string
  overallStatus: string
  capabilityStatus: string
  settlementStatus: string
  governanceStatus: string
  diagnostics: ProviderGovernanceDiagnosticsResponse
  updatedAt: string
}

export type ProviderProfileResponse = {
  providerId: string
  displayName: string
  legalName?: string | null
  legalCountryCode?: string | null
  legalForm?: string | null
  taxNumber?: string | null
  registrationNumber?: string | null
  branchNumber?: string | null
  registeredAddress?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  cityId?: string | null
  address?: string | null
  description?: string | null
  operatingState: string
  operatingSummary?: Array<{
    value?: string | null
    label?: string | null
  }> | null
  profileMetadata?: {
    governance?: {
      operatingState?: string | null
    } | null
    reviewReasonCode?: string | null
    reviewMessage?: string | null
    reviewActorUserId?: string | null
  } | null
  updatedAt: string
}

export type ProviderPayoutMode = 't_bank_bank_account' | 't_bank_sbp_individual' | string

export type ProviderPayoutBankRequisites = {
  account?: string | null
  bankName?: string | null
  bik?: string | null
  correspondentAccount?: string | null
}

export type ProviderSbpPayout = {
  beneficiaryName?: string | null
  phone?: string | null
  sbpMemberId?: string | null
  displayBankName?: string | null
}

export type ProviderPayoutContractResponse = {
  contractId: string
  providerId: string
  payoutMode: ProviderPayoutMode
  contractNumber: number
  currency: string
  startsOn: string
  status: string
  bankRequisites?: ProviderPayoutBankRequisites | null
  sbpPayout?: ProviderSbpPayout | null
  tBankSbpPayoutRecipient?: unknown
  tBankShop?: unknown
  createdAt: string
  updatedAt: string
}

export type ProviderPayoutContractRequest = {
  payoutMode: ProviderPayoutMode
  currency: string
  startsOn: string
  status: string
  bankRequisites?: ProviderPayoutBankRequisites | null
  sbpPayout?: ProviderSbpPayout | null
}

export type ProviderPayoutCommandResponse = {
  contract: ProviderPayoutContractResponse
  connection?: unknown
  result?: {
    status?: string
    actionCode?: string
    reasonCode?: string | null
  }
}

export type ProviderPayoutSetupDraftResponse = {
  providerId: string
  contractId: string
  payoutMode: ProviderPayoutMode
  contract: ProviderPayoutContractResponse
  suggestedSbpPayout?: ProviderSbpPayout | null
  suggestedBankRequisitesRegistration?: unknown
}

export type ProviderPayoutContractOptionsResponse = {
  payoutModes: Array<{
    key: string
    value: string
  }>
  statuses: Array<{
    key: string
    value: string
  }>
  setupActions: Array<{
    key: string
    value: string
  }>
}

export type PublicAddressSuggestion = {
  value: string
  unrestrictedValue?: string | null
  postalCode?: string | null
  country?: string | null
  countryIsoCode?: string | null
  region?: string | null
  city?: string | null
  street?: string | null
  house?: string | null
  flat?: string | null
  qcGeo?: string | null
  source?: string | null
}

export type PublicAddressSuggestionsResponse = {
  provider: string
  suggestions: PublicAddressSuggestion[]
}

export type PublicBankByBicResponse = {
  source?: string | null
  value?: string | null
  unrestrictedValue?: string | null
  bic: string
  swift?: string | null
  swifts?: string[] | null
  inn?: string | null
  branchNumber?: string | null
  registrationNumber?: string | null
  correspondentAccount?: string | null
  paymentName?: string | null
  shortName?: string | null
  paymentCity?: string | null
  opfType?: string | null
  address?: string | null
  unrestrictedAddress?: string | null
  stateStatus?: string | null
}

export type ProviderGovernanceListResponse = {
  items: ProviderGovernanceSummaryResponse[]
  pagination: PaginationResponse
}

export type ProviderGovernanceOptionsResponse = InternalListOptionsResponse

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
    const errorBody = (await response.json()) as ApiErrorBody
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

  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader)
  }

  let response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && getStoredAuthTokens()?.refreshToken) {
    const refreshedTokens = await refreshStoredAuthTokens()

    headers.set('Authorization', `${refreshedTokens.tokenType || 'Bearer'} ${refreshedTokens.accessToken}`)
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    })
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as TResponse
}

export function getProviderOnboarding(applicationId: string) {
  return requestJson<ProviderOnboardingResponse>(`/internal/provider-onboarding/${encodeURIComponent(applicationId)}`)
}

export function getProviderOnboardingOptions() {
  return requestJson<ProviderOnboardingListOptionsResponse>('/internal/provider-onboarding/options')
}

export function getProviderOnboardingQueue(query: ProviderOnboardingQueueQuery) {
  const searchParams = new URLSearchParams()

  if (query.filter) {
    searchParams.set('filter', query.filter)
  }

  if (query.sort) {
    searchParams.set('sort', query.sort)
  }

  searchParams.set('page', String(query.page))
  searchParams.set('pageSize', String(query.pageSize))

  return requestJson<ProviderOnboardingQueueResponse>(`/internal/provider-onboarding?${searchParams.toString()}`)
}

export function postProviderOnboardingAction(applicationId: string, request: ProviderOnboardingActionRequest) {
  return requestJson<ProviderOnboardingActionResponse>(`/internal/provider-onboarding/${encodeURIComponent(applicationId)}/actions`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
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

export function getInternalUserRoles(userId: string) {
  return requestJson<InternalUserRoleResponse[]>(`/internal/users/${encodeURIComponent(userId)}/roles`)
}

export function getInternalUserExternalAuthProviders(userId: string) {
  return requestJson<InternalExternalAuthProviderResponse[]>(`/internal/users/${encodeURIComponent(userId)}/external-auth-providers`)
}

export async function getProviderGovernanceQueue(query?: InternalListQuery) {
  const response = await requestJson<ProviderGovernanceSummaryResponse[] | ProviderGovernanceListResponse>(
    buildInternalListUrl('/internal/providers/governance', query),
  )

  return normalizeInternalListResponse(response, query)
}

export function getProviderGovernanceOptions() {
  return requestJson<ProviderGovernanceOptionsResponse>('/internal/providers/governance/options')
}

export function getInternalProviderProfile(providerId: string) {
  return requestJson<ProviderProfileResponse>(`/internal/providers/${encodeURIComponent(providerId)}/profile`)
}

export function getInternalProviderMemberships(providerId: string) {
  return requestJson<InternalProviderMembershipResponse[]>(`/internal/providers/${encodeURIComponent(providerId)}/memberships`)
}

export function getProviderPayoutContracts(providerId: string) {
  return requestJson<ProviderPayoutContractResponse[]>(`/internal/providers/${encodeURIComponent(providerId)}/payout-contracts`)
}

export function postProviderPayoutContract(providerId: string, request: ProviderPayoutContractRequest) {
  return requestJson<ProviderPayoutCommandResponse>(`/internal/providers/${encodeURIComponent(providerId)}/payout-contracts`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function putProviderPayoutContract(providerId: string, contractId: string, request: ProviderPayoutContractRequest) {
  return requestJson<ProviderPayoutCommandResponse>(
    `/internal/providers/${encodeURIComponent(providerId)}/payout-contracts/${encodeURIComponent(contractId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
  )
}

export function getProviderPayoutSetupDraft(providerId: string, contractId: string) {
  return requestJson<ProviderPayoutSetupDraftResponse>(
    `/internal/providers/${encodeURIComponent(providerId)}/payout-contracts/${encodeURIComponent(contractId)}/setup-draft`,
  )
}

export function getProviderPayoutContractOptions() {
  return requestJson<ProviderPayoutContractOptionsResponse>('/internal/provider-payout-contracts/options')
}

export function postProviderPayoutSbpRecipientRegister(providerId: string, contractId: string, sbpPayout: ProviderSbpPayout) {
  return requestJson<ProviderPayoutCommandResponse>(
    `/internal/providers/${encodeURIComponent(providerId)}/payout-contracts/${encodeURIComponent(contractId)}/t-bank/sbp-recipient/register`,
    {
      method: 'POST',
      body: JSON.stringify({ sbpPayout }),
    },
  )
}

export function postProviderPayoutTBankShopRegister(providerId: string, contractId: string, request: unknown) {
  return requestJson<ProviderPayoutCommandResponse>(
    `/internal/providers/${encodeURIComponent(providerId)}/payout-contracts/${encodeURIComponent(contractId)}/t-bank/shop/register`,
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
  )
}

export function postPublicAddressSuggestions(query: string, count = 10, signal?: AbortSignal) {
  return requestJson<PublicAddressSuggestionsResponse>('/api/v1/public/suggestions/address', {
    method: 'POST',
    body: JSON.stringify({ query, count }),
    signal,
  })
}

export function postPublicBankByBic(bic: string, signal?: AbortSignal) {
  return requestJson<PublicBankByBicResponse>('/api/v1/public/suggestions/bank-by-bic', {
    method: 'POST',
    body: JSON.stringify({ bic }),
    signal,
  })
}
