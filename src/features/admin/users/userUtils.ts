import type { InternalUserSummaryResponse } from '../adminApi'

export function getUserDisplayName(user: Pick<InternalUserSummaryResponse, 'name' | 'surname' | 'email'>) {
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email || 'Пользователь'
}
