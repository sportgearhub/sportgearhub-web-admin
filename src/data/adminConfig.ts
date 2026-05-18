import type { AdminSectionId, ConsoleAction, NavGroup, NavItem } from '../types/admin'

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Рабочий стол',
    items: [
      { id: 'overview', label: 'Обзор' },
    ],
  },
  {
    id: 'suppliers',
    label: 'Поставщики',
    items: [
      { id: 'onboarding', label: 'Заявки' },
      { id: 'governance', label: 'Поставщики' },
      { id: 'readiness', label: 'Готовность к запуску' },
      { id: 'drift', label: 'Дрейф возможностей' },
    ],
  },
  {
    id: 'access',
    label: 'Доступ',
    items: [
      { id: 'users', label: 'Пользователи и роли' },
    ],
  },
  {
    id: 'operations',
    label: 'Операции',
    items: [
      { id: 'bookings', label: 'Бронирования' },
      { id: 'reservations', label: 'Резервации' },
      { id: 'workflows', label: 'Воркфлоу' },
    ],
  },
  {
    id: 'finance',
    label: 'Финансы',
    items: [
      { id: 'payments', label: 'Платежи' },
      { id: 'refunds', label: 'Возвраты' },
      { id: 'reconciliation', label: 'Сверка' },
      { id: 'settlements', label: 'Расчеты' },
      { id: 'ledger', label: 'Ледгер' },
    ],
  },
  {
    id: 'catalog',
    label: 'Каталог',
    items: [
      { id: 'canonicalization', label: 'Каталог и бренды' },
    ],
  },
  {
    id: 'platform',
    label: 'Платформа',
    items: [
      { id: 'system', label: 'Система' },
    ],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

export const sectionActions: Partial<Record<AdminSectionId, ConsoleAction[]>> = {}
