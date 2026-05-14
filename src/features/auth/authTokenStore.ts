import type { AdminOidcTokens } from '../../types/admin'

let activeTokens: AdminOidcTokens | null = null

export function getStoredAuthTokens() {
  return activeTokens
}

export function storeAuthTokens(tokens: AdminOidcTokens) {
  activeTokens = tokens
  return tokens
}

export function clearStoredAuthTokens() {
  activeTokens = null
}

export function getAuthorizationHeader() {
  const tokens = getStoredAuthTokens()

  if (!tokens?.accessToken) {
    return null
  }

  return `${tokens.tokenType || 'Bearer'} ${tokens.accessToken}`
}
