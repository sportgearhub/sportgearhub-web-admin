import type { NavGroup, NavItem } from '../types/admin'

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Рабочий стол',
    items: [{ id: 'overview', label: 'Обзор' }],
  },
  {
    id: 'moderation',
    label: 'Модерация',
    items: [
      { id: 'onboarding', label: 'Заявки продавцов' },
      { id: 'products', label: 'Товары' },
    ],
  },
  {
    id: 'sellers',
    label: 'Продавцы',
    items: [{ id: 'sellers', label: 'Все продавцы' }],
  },
  {
    id: 'finance',
    label: 'Финансы',
    items: [{ id: 'finance', label: 'Платежи и выплаты' }],
  },
  {
    id: 'access',
    label: 'Доступ',
    items: [{ id: 'users', label: 'Пользователи' }],
  },
  {
    id: 'catalog',
    label: 'Каталог',
    items: [{ id: 'catalog', label: 'Категории и атрибуты' }],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)
