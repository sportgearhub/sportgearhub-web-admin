import type { BadgeProps } from '../../../components/ui/badge'
import type { ProductStatus } from '../adminApi'

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  changes_requested: 'Нужны изменения',
  rejected: 'Отклонён',
  active: 'Активен',
  paused: 'На паузе',
  suspended: 'Снят',
  archived: 'В архиве',
}

export function productStatusLabel(status: ProductStatus) {
  return PRODUCT_STATUS_LABELS[status] ?? status
}

export function productStatusVariant(status: ProductStatus): BadgeProps['variant'] {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending_review':
    case 'changes_requested':
      return 'warning'
    case 'rejected':
    case 'suspended':
      return 'destructive'
    case 'archived':
    case 'paused':
      return 'outline'
    default:
      return 'secondary'
  }
}
