import { useMemo } from 'react'
import { RsqlDataTable } from '../shared/RsqlDataTable'
import { createProviderColumns } from './providerColumns'
import { ProviderDetailModal } from './ProviderDetailModal'
import { useProviderManagement } from './useProviderManagement'

export function ProviderManagementPage() {
  const {
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
    closeProvider,
  } = useProviderManagement()

  const statusOptions = useMemo(() => Array.from(new Set(providers.flatMap((provider) => [
    provider.overallStatus,
    provider.capabilityStatus,
    provider.settlementStatus,
    provider.governanceStatus,
  ]))).filter(Boolean).sort(), [providers])
  const columns = useMemo(() => createProviderColumns(statusOptions), [statusOptions])

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col overflow-hidden bg-background">
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <RsqlDataTable
        rows={providers}
        columns={columns}
        getRowKey={(provider) => provider.providerId}
        emptyText="Поставщиков нет."
        loading={isLoading}
        onRefresh={() => void loadProviders()}
        onRowOpen={openProvider}
      />
      {selectedProvider ? (
        <ProviderDetailModal
          provider={selectedProvider}
          memberships={memberships}
          users={users}
          membershipError={membershipError}
          isMembershipLoading={isMembershipLoading}
          onClose={closeProvider}
        />
      ) : null}
    </section>
  )
}
