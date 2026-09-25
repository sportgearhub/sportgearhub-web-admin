import type { BadgeProps } from '../../../components/ui/badge'
import type { ProviderStatus, SellerKind } from '../adminApi'

export const providerStatusLabels: Record<string, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  changes_requested: 'Нужны изменения',
  rejected: 'Отклонён',
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'В архиве',
}

export function providerStatusLabel(status: ProviderStatus) {
  return providerStatusLabels[status] ?? status
}

export function providerStatusVariant(status: ProviderStatus): BadgeProps['variant'] {
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
      return 'outline'
    default:
      return 'secondary'
  }
}

export function sellerKindLabel(kind: SellerKind | null | undefined) {
  switch (kind) {
    case 'self_employed':
      return 'Самозанятый'
    case 'sole_proprietor':
      return 'ИП'
    case 'company':
      return 'Организация'
    default:
      return kind ? String(kind) : '—'
  }
}

export const taxationLabels: Record<string, string> = {
  usn: 'УСН',
  osn: 'ОСН',
  psn: 'ПСН',
  ausn: 'АУСН',
  eskhn: 'ЕСХН',
  npd: 'НПД',
}

export const vatLabels: Record<string, string> = {
  none: 'без НДС',
  vat5: 'НДС 5 %',
  vat7: 'НДС 7 %',
  vat10: 'НДС 10 %',
  vat20: 'НДС 20 %',
}

export const readinessLabels: Record<string, string> = {
  profile: 'Профиль проката',
  seller: 'Данные продавца',
  agreement: 'Договор',
  payout: 'Выплаты',
  location: 'Пункт проката',
  offer: 'Предложения',
}

export const missingFieldLabels: Record<string, string> = {
  agreement: 'номер договора (нет принятого договора)',
  short_name: 'краткое название с префиксом ИП/ООО',
  legal_address: 'юридический адрес (индекс, город, улица)',
  email: 'подтверждённая почта владельца',
  ceo_name: 'ФИО руководителя',
  ceo_phone: 'телефон руководителя',
  bank_account: 'расчётный счёт, БИК и банк',
}

export function personName(person: { name?: string | null; surname?: string | null; lastName?: string | null; firstName?: string | null; middleName?: string | null } | null | undefined) {
  if (!person) return '—'
  const parts = 'lastName' in person
    ? [person.lastName, person.firstName, person.middleName]
    : [person.surname, person.name]
  return parts.filter(Boolean).join(' ') || '—'
}
