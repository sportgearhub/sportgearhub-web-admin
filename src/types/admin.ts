import type { ComponentType } from 'react'

export type AdminSectionId =
  | 'overview'
  | 'onboarding'
  | 'products'
  | 'sellers'
  | 'bookings'
  | 'settlements'
  | 'payouts'
  | 'receipts'
  | 'payments'
  | 'users'
  | 'catalog'

export type NavIcon = ComponentType<{ size?: number | string; className?: string }>

export type NavItem = {
  id: AdminSectionId
  label: string
  icon: NavIcon
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export type AdminSession = {
  userId: string
  name: string
  phone: string
  email: string
  /** Only a platform admin may open the console; everyone else signs in and is told so. */
  isAdmin: boolean
  tokens?: AdminOidcTokens
}

export type AdminOidcTokens = {
  accessToken: string
  tokenType: string
  expiresAt?: string
  refreshToken?: string
  idToken?: string
  scope?: string
}
