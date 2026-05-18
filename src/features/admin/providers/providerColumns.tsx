import { Badge } from '../../../components/ui/badge'
import type { ProviderGovernanceSummaryResponse } from '../adminApi'
import { formatDateTime } from '../shared/format'
import type { RsqlColumn } from '../shared/RsqlDataTable'
import { getOperationalStatusVariant } from '../shared/status'

export function createProviderColumns(statusOptions: string[]): Array<RsqlColumn<ProviderGovernanceSummaryResponse>> {
  return [
    {
      key: 'provider',
      label: 'Поставщик',
      field: 'displayName',
      width: '27%',
      value: (provider) => `${provider.displayName} ${provider.providerId}`,
      render: (provider) => (
        <div className="min-w-0">
          <strong className="block truncate text-sm font-medium">{provider.displayName}</strong>
          <small className="block truncate text-xs text-muted-foreground">{provider.providerId}</small>
        </div>
      ),
    },
    {
      key: 'overall',
      label: 'Сводно',
      field: 'overallStatus',
      width: '14%',
      filterKind: 'select',
      options: statusOptions,
      value: (provider) => provider.overallStatus,
      render: (provider) => <Badge variant={getOperationalStatusVariant(provider.overallStatus)}>{provider.overallStatus}</Badge>,
    },
    {
      key: 'capability',
      label: 'Возможности',
      field: 'capabilityStatus',
      width: '14%',
      filterKind: 'select',
      options: statusOptions,
      value: (provider) => provider.capabilityStatus,
      render: (provider) => <Badge variant={getOperationalStatusVariant(provider.capabilityStatus)}>{provider.capabilityStatus}</Badge>,
    },
    {
      key: 'settlement',
      label: 'Расчеты',
      field: 'settlementStatus',
      width: '14%',
      filterKind: 'select',
      options: statusOptions,
      value: (provider) => provider.settlementStatus,
      render: (provider) => <Badge variant={getOperationalStatusVariant(provider.settlementStatus)}>{provider.settlementStatus}</Badge>,
    },
    {
      key: 'resources',
      label: 'Ресурсы',
      field: 'diagnostics.activeResources',
      width: '11%',
      align: 'right',
      value: (provider) => provider.diagnostics.activeResources,
      render: (provider) => <span className="tabular-nums">{provider.diagnostics.activeResources}/{provider.diagnostics.totalResources}</span>,
    },
    {
      key: 'offers',
      label: 'Офферы',
      field: 'diagnostics.activeOffers',
      width: '10%',
      align: 'right',
      value: (provider) => provider.diagnostics.activeOffers,
      render: (provider) => <span className="tabular-nums">{provider.diagnostics.activeOffers}/{provider.diagnostics.totalOffers}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Обновлено',
      field: 'updatedAt',
      width: '10%',
      value: (provider) => provider.updatedAt,
      render: (provider) => <span className="text-xs text-muted-foreground">{formatDateTime(provider.updatedAt)}</span>,
    },
  ]
}
