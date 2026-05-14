import { getAuthorizationHeader } from '../auth/authTokenStore'

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

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
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
  const authorizationHeader = getAuthorizationHeader()

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader)
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })

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
