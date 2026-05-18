import { useCallback, useState } from 'react'
import {
  getInternalProviderMemberships,
  getInternalUsers,
  getProviderGovernanceOptions,
  getProviderGovernanceQueue,
  type InternalListQuery,
  type InternalListOptionsResponse,
  type InternalProviderMembershipResponse,
  type InternalUserSummaryResponse,
  type PaginationResponse,
  type ProviderGovernanceSummaryResponse,
} from '../adminApi'

const DEFAULT_PAGINATION: PaginationResponse = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
}

const DEFAULT_QUERY: InternalListQuery = {
  page: 1,
  pageSize: 20,
}

export function useProviderManagement() {
  const [providers, setProviders] = useState<ProviderGovernanceSummaryResponse[]>([])
  const [users, setUsers] = useState<InternalUserSummaryResponse[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderGovernanceSummaryResponse | null>(null)
  const [memberships, setMemberships] = useState<InternalProviderMembershipResponse[]>([])
  const [pagination, setPagination] = useState<PaginationResponse>(DEFAULT_PAGINATION)
  const [listOptions, setListOptions] = useState<InternalListOptionsResponse | null>(null)
  const [activeQuery, setActiveQuery] = useState<InternalListQuery>(DEFAULT_QUERY)
  const [isLoading, setIsLoading] = useState(true)
  const [isMembershipLoading, setIsMembershipLoading] = useState(false)
  const [error, setError] = useState('')
  const [membershipError, setMembershipError] = useState('')

  const loadProviders = useCallback(async (query = activeQuery) => {
    try {
      setIsLoading(true)
      setActiveQuery(query)
      const [providerResponse, userResponse, optionsResponse] = await Promise.all([
        getProviderGovernanceQueue(query),
        getInternalUsers({ page: 1, pageSize: 100 }),
        getProviderGovernanceOptions(),
      ])
      setProviders(providerResponse.items)
      setUsers(userResponse.items)
      setPagination(providerResponse.pagination)
      setListOptions(optionsResponse)
      setError('')
    } catch (loadError) {
      setProviders([])
      setUsers([])
      setPagination(DEFAULT_PAGINATION)
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить поставщиков')
    } finally {
      setIsLoading(false)
    }
  }, [activeQuery])

  async function openProvider(provider: ProviderGovernanceSummaryResponse) {
    setSelectedProvider(provider)
    setMemberships([])

    try {
      setMembershipError('')
      setIsMembershipLoading(true)
      setMemberships(await getInternalProviderMemberships(provider.providerId))
    } catch (loadError) {
      setMembershipError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить доступы')
    } finally {
      setIsMembershipLoading(false)
    }
  }

  return {
    providers,
    users,
    selectedProvider,
    memberships,
    pagination,
    listOptions,
    isLoading,
    isMembershipLoading,
    error,
    membershipError,
    loadProviders,
    openProvider,
    closeProvider: () => setSelectedProvider(null),
  }
}
