import type { AdminOidcTokens } from '../../types/admin'

let activeTokens: AdminOidcTokens | null = null
const TOKEN_STORAGE_KEY = 'sportgearhub.admin.authTokens'

function isTokenShape(value: unknown): value is AdminOidcTokens {
  if (!value || typeof value !== 'object') {
    return false
  }

  const tokens = value as Partial<AdminOidcTokens>
  return typeof tokens.accessToken === 'string' && typeof tokens.tokenType === 'string'
}

function readStoredTokens() {
  try {
    const serializedTokens = window.localStorage.getItem(TOKEN_STORAGE_KEY)

    if (!serializedTokens) {
      return null
    }

    const tokens = JSON.parse(serializedTokens) as unknown
    return isTokenShape(tokens) ? tokens : null
  } catch {
    return null
  }
}

export function getStoredAuthTokens() {
  if (!activeTokens) {
    activeTokens = readStoredTokens()
  }

  return activeTokens
}

export function storeAuthTokens(tokens: AdminOidcTokens) {
  activeTokens = tokens

  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // Keep the in-memory session if browser storage is unavailable.
  }

  return tokens
}

export function clearStoredAuthTokens() {
  activeTokens = null

  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Nothing else to clear.
  }
}

export function getAuthorizationHeader() {
  const tokens = getStoredAuthTokens()

  if (!tokens?.accessToken) {
    return null
  }

  return `${tokens.tokenType || 'Bearer'} ${tokens.accessToken}`
}
