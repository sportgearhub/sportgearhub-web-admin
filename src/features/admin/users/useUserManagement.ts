import { useCallback, useState } from 'react'
import {
  getInternalUser,
  getInternalUserManagementOptions,
  getInternalUsers,
  getProviderGovernanceQueue,
  type InternalListOptionsResponse,
  type InternalUserDetailResponse,
  type InternalListQuery,
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

export function useUserManagement() {
  const [users, setUsers] = useState<InternalUserSummaryResponse[]>([])
  const [providers, setProviders] = useState<ProviderGovernanceSummaryResponse[]>([])
  const [selectedUser, setSelectedUser] = useState<InternalUserDetailResponse | null>(null)
  const [pagination, setPagination] = useState<PaginationResponse>(DEFAULT_PAGINATION)
  const [listOptions, setListOptions] = useState<InternalListOptionsResponse | null>(null)
  const [activeQuery, setActiveQuery] = useState<InternalListQuery>(DEFAULT_QUERY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')

  const loadUsers = useCallback(async (query = activeQuery) => {
    try {
      setIsLoading(true)
      setActiveQuery(query)
      const [userResponse, providerResponse, optionsResponse] = await Promise.all([
        getInternalUsers(query),
        getProviderGovernanceQueue({ page: 1, pageSize: 100 }),
        getInternalUserManagementOptions(),
      ])
      setUsers(userResponse.items)
      setProviders(providerResponse.items)
      setPagination(userResponse.pagination)
      setListOptions(optionsResponse)
      setError('')
    } catch (loadError) {
      setUsers([])
      setProviders([])
      setPagination(DEFAULT_PAGINATION)
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей')
    } finally {
      setIsLoading(false)
    }
  }, [activeQuery])

  async function openUser(user: InternalUserSummaryResponse) {
    try {
      setDetailError('')
      setSelectedUser(await getInternalUser(user.userId))
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователя')
      setSelectedUser({ ...user, roles: [], externalAuthProviders: [], providerMemberships: [] })
    }
  }

  return {
    users,
    providers,
    selectedUser,
    pagination,
    listOptions,
    isLoading,
    error,
    detailError,
    loadUsers,
    openUser,
    closeUser: () => setSelectedUser(null),
  }
}
