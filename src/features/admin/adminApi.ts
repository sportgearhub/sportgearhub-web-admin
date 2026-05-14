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

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
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
