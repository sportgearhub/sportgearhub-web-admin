import { useCallback, useEffect, useState } from 'react'
import {
  getInternalUser,
  getInternalUsers,
  getProviderGovernanceQueue,
  type InternalUserDetailResponse,
  type InternalUserSummaryResponse,
  type ProviderGovernanceSummaryResponse,
} from '../adminApi'

export function useUserManagement() {
  const [users, setUsers] = useState<InternalUserSummaryResponse[]>([])
  const [providers, setProviders] = useState<ProviderGovernanceSummaryResponse[]>([])
  const [selectedUser, setSelectedUser] = useState<InternalUserDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      const [userItems, providerItems] = await Promise.all([
        getInternalUsers(),
        getProviderGovernanceQueue(),
      ])
      setUsers(userItems)
      setProviders(providerItems)
      setError('')
    } catch (loadError) {
      setUsers([])
      setProviders([])
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUsers()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadUsers])

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
    isLoading,
    error,
    detailError,
    loadUsers,
    openUser,
    closeUser: () => setSelectedUser(null),
  }
}
