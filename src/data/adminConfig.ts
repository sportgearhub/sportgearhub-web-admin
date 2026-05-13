import type { AdminSectionId, ConsoleAction, NavItem } from '../types/admin'

export const navItems: NavItem[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'onboarding', label: 'Онбординг провайдеров' },
  { id: 'governance', label: 'Управление провайдерами' },
  { id: 'readiness', label: 'Готовность к запуску' },
  { id: 'users', label: 'Пользователи' },
  { id: 'bookings', label: 'Бронирования' },
  { id: 'payments', label: 'Платежи' },
  { id: 'refunds', label: 'Кейсы возвратов' },
  { id: 'reservations', label: 'Резервации' },
  { id: 'workflows', label: 'Воркфлоу' },
  { id: 'reconciliation', label: 'Сверка' },
  { id: 'settlements', label: 'Расчеты' },
  { id: 'ledger', label: 'Ледгер' },
  { id: 'drift', label: 'Дрейф возможностей' },
  { id: 'canonicalization', label: 'Каноникализация' },
  { id: 'system', label: 'Система' },
]

export const sectionActions: Partial<Record<AdminSectionId, ConsoleAction[]>> = {}
