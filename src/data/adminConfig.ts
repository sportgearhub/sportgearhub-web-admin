import type { NavGroup, NavItem } from '../types/admin'

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Рабочий стол',
    items: [{ id: 'overview', label: 'Обзор' }],
  },
  {
    id: 'providers',
    label: 'Поставщики',
    items: [
      { id: 'onboarding', label: 'Заявки' },
      { id: 'providers', label: 'Поставщики' },
    ],
  },
  {
    id: 'access',
    label: 'Доступ',
    items: [{ id: 'users', label: 'Пользователи' }],
  },
  {
    id: 'catalog',
    label: 'Каталог',
    items: [{ id: 'catalog', label: 'Каталог и бренды' }],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)
