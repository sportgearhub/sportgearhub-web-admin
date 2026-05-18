import { BooleanBadge, type RsqlColumn } from '../shared/RsqlDataTable'
import { formatDateTime } from '../shared/format'
import type { InternalUserSummaryResponse } from '../adminApi'
import { getUserDisplayName } from './userUtils'

export const userColumns: Array<RsqlColumn<InternalUserSummaryResponse>> = [
  {
    key: 'user',
    label: 'Пользователь',
    field: 'email',
    width: '28%',
    value: (user) => `${getUserDisplayName(user)} ${user.email ?? ''}`,
    render: (user) => (
      <div className="min-w-0">
        <strong className="block truncate text-sm font-medium">{getUserDisplayName(user)}</strong>
        <small className="block truncate text-xs text-muted-foreground">{user.email ?? user.userId}</small>
      </div>
    ),
  },
  {
    key: 'phone',
    label: 'Телефон',
    field: 'phone',
    width: '17%',
    value: (user) => user.phone,
    render: (user) => <span className="truncate text-sm">{user.phone ?? '—'}</span>,
  },
  {
    key: 'emailVerified',
    label: 'Почта',
    field: 'emailVerified',
    width: '12%',
    filterKind: 'select',
    options: ['true', 'false'],
    value: (user) => String(user.emailVerified),
    render: (user) => <BooleanBadge value={user.emailVerified} />,
  },
  {
    key: 'phoneVerified',
    label: 'Телефон',
    field: 'phoneVerified',
    width: '12%',
    filterKind: 'select',
    options: ['true', 'false'],
    value: (user) => String(user.phoneVerified),
    render: (user) => <BooleanBadge value={user.phoneVerified} />,
  },
  {
    key: 'updatedAt',
    label: 'Обновлено',
    field: 'updatedAt',
    width: '16%',
    value: (user) => user.updatedAt,
    render: (user) => <span className="text-xs text-muted-foreground">{formatDateTime(user.updatedAt)}</span>,
  },
  {
    key: 'createdAt',
    label: 'Создан',
    field: 'createdAt',
    width: '15%',
    value: (user) => user.createdAt,
    render: (user) => <span className="text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</span>,
  },
]
