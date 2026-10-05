import type { BadgeProps } from '../../../components/ui/badge'

export function receiptStatusVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'Done':
      return 'success'
    case 'Registered':
      return 'info'
    case 'Failed':
      return 'destructive'
    case 'Pending':
      return 'warning'
    default:
      return 'secondary'
  }
}
