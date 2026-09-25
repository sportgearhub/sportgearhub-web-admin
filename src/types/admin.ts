export type AdminSectionId = 'overview' | 'onboarding' | 'providers' | 'users' | 'catalog'

export type NavItem = {
  id: AdminSectionId
  label: string
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
