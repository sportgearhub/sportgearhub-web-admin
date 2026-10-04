import { useCallback, useState } from 'react'
import {
  getInternalUser,
  getInternalUserManagementOptions,
  getInternalUsers,
  getSellers,
  type InternalListOptionsResponse,
  type InternalUserDetailResponse,
  type InternalListQuery,
  type InternalUserSummaryResponse,
  type PaginationResponse,
  type SellerListItem,
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
  const [sellers, setSellers] = useState<SellerListItem[]>([])
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
      const [userResponse, sellerResponse, optionsResponse] = await Promise.all([
        getInternalUsers(query),
        // Best-effort lookup of seller display names for the detail modal; the list is now paged, so
        // pull a generous page rather than the whole platform.
        getSellers({ pageSize: 100 }),
        getInternalUserManagementOptions(),
      ])
      setUsers(userResponse.items)
      setSellers(sellerResponse.items)
      setPagination(userResponse.pagination)
      setListOptions(optionsResponse)
      setError('')
    } catch (loadError) {
      setUsers([])
      setSellers([])
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
      setSelectedUser({ ...user, platformRole: null, memberships: [] })
    }
  }

  return {
    users,
    sellers,
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
