import { useCallback, useState } from 'react'
import {
  getInternalUserManagementOptions,
  getInternalUsers,
  type InternalListOptionsResponse,
  type InternalListQuery,
  type InternalUserSummaryResponse,
  type PaginationResponse,
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
  const [pagination, setPagination] = useState<PaginationResponse>(DEFAULT_PAGINATION)
  const [listOptions, setListOptions] = useState<InternalListOptionsResponse | null>(null)
  const [activeQuery, setActiveQuery] = useState<InternalListQuery>(DEFAULT_QUERY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadUsers = useCallback(async (query = activeQuery) => {
    try {
      setIsLoading(true)
      setActiveQuery(query)
      const [userResponse, optionsResponse] = await Promise.all([
        getInternalUsers(query),
        getInternalUserManagementOptions(),
      ])
      setUsers(userResponse.items)
      setPagination(userResponse.pagination)
      setListOptions(optionsResponse)
      setError('')
    } catch (loadError) {
      setUsers([])
      setPagination(DEFAULT_PAGINATION)
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей')
    } finally {
      setIsLoading(false)
    }
  }, [activeQuery])

  return { users, pagination, listOptions, isLoading, error, loadUsers }
}
