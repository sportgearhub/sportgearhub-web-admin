import type { BadgeProps } from '../../../components/ui/badge'
import type { SellerKind, SellerStatus } from '../adminApi'

export const sellerStatusLabels: Record<string, string> = {
  draft: 'Черновик',
  pending_review: 'На проверке',
  changes_requested: 'Нужны изменения',
  rejected: 'Отклонён',
  active: 'Активен',
  suspended: 'Приостановлен',
  archived: 'В архиве',
}

export function sellerStatusLabel(status: SellerStatus) {
  return sellerStatusLabels[status] ?? status
}

export function sellerStatusVariant(status: SellerStatus): BadgeProps['variant'] {
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

/** Readiness item keys the API emits: profile, seller_profile, payout. */
export const readinessLabels: Record<string, string> = {
  profile: 'Профиль проката',
  seller_profile: 'Данные продавца',
  payout: 'Выплаты',
}

export function readinessStatusLabel(status: string) {
  switch (status) {
    case 'ready':
      return 'Готово'
    case 'missing':
      return 'Нет'
    case 'awaiting_registration':
      return 'Ждёт банк'
    default:
      return status
  }
}

export function readinessStatusVariant(status: string): BadgeProps['variant'] {
  if (status === 'ready') return 'success'
  if (status === 'missing') return 'destructive'
  return 'warning'
}

/** Field groups the shop-registration preview could not assemble; the operator fills only these. */
export const missingFieldLabels: Record<string, string> = {
  agreement: 'номер договора (нет принятого договора)',
  short_name: 'краткое название с префиксом ИП/ООО',
  legal_address: 'юридический адрес (индекс, город, улица)',
  email: 'подтверждённая почта владельца',
  ceo_name: 'ФИО руководителя',
  ceo_phone: 'телефон руководителя',
  bank_account: 'расчётный счёт, БИК и банк',
}

export function memberRoleLabel(role: string) {
  switch (role) {
    case 'owner':
      return 'Владелец'
    case 'manager':
      return 'Менеджер'
    case 'finance':
      return 'Финансы'
    default:
      return 'Сотрудник'
  }
}

export function personName(
  person:
    | { surname?: string | null; name?: string | null; patronymic?: string | null }
    | null
    | undefined,
) {
  if (!person) return '—'
  return [person.surname, person.name, person.patronymic].filter(Boolean).join(' ') || '—'
}

export function agreementSummary(agreement: { number: number; acceptedAt: string; status: string } | null) {
  if (!agreement) return 'не принят'
  const state =
    agreement.status === 'active' ? 'действует' : agreement.status === 'terminated' ? 'расторгнут' : 'принят, ждёт одобрения'
  return { number: agreement.number, acceptedAt: agreement.acceptedAt, state }
}
