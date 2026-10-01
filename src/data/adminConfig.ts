import { Boxes, CreditCard, LayoutDashboard, PackageCheck, Store, UserRound, Users } from 'lucide-react'
import type { NavGroup, NavItem } from '../types/admin'

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Рабочий стол',
    items: [{ id: 'overview', label: 'Обзор', icon: LayoutDashboard }],
  },
  {
    id: 'moderation',
    label: 'Модерация',
    items: [
      { id: 'onboarding', label: 'Заявки продавцов', icon: UserRound },
      { id: 'products', label: 'Товары', icon: PackageCheck },
    ],
  },
  {
    id: 'sellers',
    label: 'Продавцы',
    items: [{ id: 'sellers', label: 'Все продавцы', icon: Store }],
  },
  {
    id: 'finance',
    label: 'Финансы',
    items: [{ id: 'finance', label: 'Платежи и выплаты', icon: CreditCard }],
  },
  {
    id: 'access',
    label: 'Доступ',
    items: [{ id: 'users', label: 'Пользователи', icon: Users }],
  },
  {
    id: 'catalog',
    label: 'Каталог',
    items: [{ id: 'catalog', label: 'Категории и атрибуты', icon: Boxes }],
  },
]

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

/** The destinations worth a one-tap slot in the mobile bottom bar; the rest live behind «Ещё». */
export const bottomNavIds = ['overview', 'onboarding', 'products'] as const
