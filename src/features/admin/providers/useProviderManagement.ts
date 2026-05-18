import { useCallback, useEffect, useState } from 'react'
import {
  getInternalProviderMemberships,
  getInternalUsers,
  getProviderGovernanceQueue,
  type InternalProviderMembershipResponse,
  type InternalUserSummaryResponse,
  type ProviderGovernanceSummaryResponse,
} from '../adminApi'

export function useProviderManagement() {
  const [providers, setProviders] = useState<ProviderGovernanceSummaryResponse[]>([])
  const [users, setUsers] = useState<InternalUserSummaryResponse[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderGovernanceSummaryResponse | null>(null)
  const [memberships, setMemberships] = useState<InternalProviderMembershipResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMembershipLoading, setIsMembershipLoading] = useState(false)
  const [error, setError] = useState('')
  const [membershipError, setMembershipError] = useState('')

  const loadProviders = useCallback(async () => {
    try {
      setIsLoading(true)
      const [providerItems, userItems] = await Promise.all([
        getProviderGovernanceQueue(),
        getInternalUsers(),
      ])
      setProviders(providerItems)
      setUsers(userItems)
      setError('')
    } catch (loadError) {
      setProviders([])
      setUsers([])
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить поставщиков')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProviders()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadProviders])

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
    isLoading,
    isMembershipLoading,
    error,
    membershipError,
    loadProviders,
    openProvider,
    closeProvider: () => setSelectedProvider(null),
  }
}
