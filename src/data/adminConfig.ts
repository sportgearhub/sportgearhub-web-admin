import { Banknote, Boxes, CalendarCheck, CreditCard, LayoutDashboard, PackageCheck, ReceiptText, Scale, Store, UserRound, Users } from 'lucide-react'
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
    items: [
      { id: 'bookings', label: 'Брони', icon: CalendarCheck },
      { id: 'settlements', label: 'Расчёты', icon: Scale },
      { id: 'payouts', label: 'Выплаты', icon: Banknote },
      { id: 'receipts', label: 'Чеки', icon: ReceiptText },
      { id: 'payments', label: 'Платежи', icon: CreditCard },
    ],
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
