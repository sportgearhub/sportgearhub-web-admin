import type { AdminOidcTokens, AdminSession } from '../../types/admin'
import { clearStoredAuthTokens, getStoredAuthTokens, storeAuthTokens } from './authTokenStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''
const ADMIN_APP = 'admin'
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID?.trim() || 'sportgearhub-web-admin'
const OIDC_SCOPE = 'openid profile email offline_access roles internal_api'
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000
let activeRefreshRequest: Promise<AdminOidcTokens> | null = null

type ApiErrorBody = {
  error?: string
  error_description?: string
  message?: string
  title?: string
}

type OidcTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  scope?: string
}

type AuthUserResponse = {
  userId: string
  name?: string | null
  surname?: string | null
  email?: string | null
  emailVerified?: boolean
  mustChangePassword?: boolean
  roles?: string[]
}

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

function mapSession(user: AuthUserResponse, tokens = getStoredAuthTokens()): AdminSession {
  const tokenClaims = tokens ? decodeJwtClaims(tokens.idToken) ?? decodeJwtClaims(tokens.accessToken) ?? {} : {}
  const tokenEmail = getClaimString(tokenClaims, [
    'email',
    'preferred_username',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  ])
  const nameParts = [user.name, user.surname].filter(Boolean)

  return {
    userId: user.userId,
    name: nameParts.join(' ') || user.email || tokenEmail || 'Администратор',
    email: user.email ?? tokenEmail,
    roles: user.roles ?? getClaimList(tokenClaims, ['roles', 'role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']),
    tokens: tokens ?? undefined,
  }
}

function getClaimString(claims: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = claims[name]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

function getClaimList(claims: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = claims[name]

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    }

    if (typeof value === 'string' && value.trim()) {
      return [value]
    }
  }

  return []
}

function decodeJwtClaims(token?: string) {
  const payload = token?.split('.')[1]

  if (!payload) {
    return null
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4), '=')
    return JSON.parse(window.atob(paddedPayload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function mapTokenResponse(response: OidcTokenResponse): AdminOidcTokens {
  const currentTokens = getStoredAuthTokens()

  return {
    accessToken: response.access_token,
    tokenType: response.token_type || 'Bearer',
    expiresAt: response.expires_in ? new Date(Date.now() + response.expires_in * 1000).toISOString() : undefined,
    refreshToken: response.refresh_token ?? currentTokens?.refreshToken,
    idToken: response.id_token ?? currentTokens?.idToken,
    scope: response.scope ?? currentTokens?.scope,
  }
}

function isAccessTokenFresh(tokens: AdminOidcTokens) {
  if (!tokens.expiresAt) {
    return true
  }

  const expiresAt = new Date(tokens.expiresAt).getTime()

  if (Number.isNaN(expiresAt)) {
    return true
  }

  return expiresAt - Date.now() > ACCESS_TOKEN_REFRESH_SKEW_MS
}

function mapSessionFromTokens(tokens: AdminOidcTokens): AdminSession {
  const claims = decodeJwtClaims(tokens.idToken) ?? decodeJwtClaims(tokens.accessToken) ?? {}
  const email = getClaimString(claims, [
    'email',
    'preferred_username',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  ])
  const givenName = getClaimString(claims, ['given_name', 'name'])
  const familyName = getClaimString(claims, ['family_name'])
  const fullName = getClaimString(claims, ['name']) || [givenName, familyName].filter(Boolean).join(' ')
  const userId = getClaimString(claims, [
    'sub',
    'nameid',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  ])

  return {
    userId: userId || email || 'admin',
    name: fullName || email || 'Администратор',
    email,
    roles: getClaimList(claims, ['roles', 'role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']),
    tokens,
  }
}

async function parseError(response: Response) {
  try {
    const errorBody = (await response.json()) as ApiErrorBody
    return errorBody.error_description ?? errorBody.message ?? errorBody.title ?? errorBody.error ?? 'Не удалось выполнить запрос'
  } catch {
    return 'Не удалось выполнить запрос'
  }
}

async function requestJson<TResponse>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const authorizationHeader = await getFreshAuthorizationHeader()

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader)
  }

  let response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && getStoredAuthTokens()?.refreshToken) {
    const refreshedTokens = await refreshStoredAuthTokens()

    headers.set('Authorization', `${refreshedTokens.tokenType || 'Bearer'} ${refreshedTokens.accessToken}`)
    response = await fetch(buildApiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    })
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}

async function requestOidcTokens(email: string, password: string) {
  const body = new URLSearchParams()

  body.set('grant_type', 'password')
  body.set('client_id', OIDC_CLIENT_ID)
  body.set('username', email)
  body.set('password', password)
  body.set('scope', OIDC_SCOPE)

  const response = await fetch(buildApiUrl('/api/v1/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as OidcTokenResponse
}

async function requestOidcTokenRefresh(refreshToken: string) {
  const body = new URLSearchParams()

  body.set('grant_type', 'refresh_token')
  body.set('client_id', OIDC_CLIENT_ID)
  body.set('refresh_token', refreshToken)
  body.set('scope', OIDC_SCOPE)

  const response = await fetch(buildApiUrl('/api/v1/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  return (await response.json()) as OidcTokenResponse
}

export async function refreshStoredAuthTokens() {
  const tokens = getStoredAuthTokens()

  if (!tokens?.refreshToken) {
    throw new Error('Нет refresh token')
  }

  activeRefreshRequest ??= requestOidcTokenRefresh(tokens.refreshToken)
    .then((response) => storeAuthTokens(mapTokenResponse(response)))
    .catch((error: unknown) => {
      clearStoredAuthTokens()
      throw error
    })
    .finally(() => {
      activeRefreshRequest = null
    })

  return activeRefreshRequest
}

async function getFreshAuthTokens() {
  const tokens = getStoredAuthTokens()

  if (!tokens) {
    return null
  }

  if (isAccessTokenFresh(tokens)) {
    return tokens
  }

  return refreshStoredAuthTokens()
}

export async function getFreshAuthorizationHeader() {
  const tokens = await getFreshAuthTokens()

  if (!tokens?.accessToken) {
    return null
  }

  return `${tokens.tokenType || 'Bearer'} ${tokens.accessToken}`
}

async function postJson(path: string, body: Record<string, string>) {
  await requestJson<void>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function signInWithPassword(email: string, password: string) {
  clearStoredAuthTokens()
  const tokenResponse = await requestOidcTokens(email, password)
  const tokens = storeAuthTokens(mapTokenResponse(tokenResponse))

  try {
    return await getCurrentUser()
  } catch {
    return mapSessionFromTokens(tokens)
  }
}

export async function restoreCurrentSession() {
  const tokens = getStoredAuthTokens()

  if (!tokens) {
    return null
  }

  try {
    await getFreshAuthTokens()
    return await getCurrentUser()
  } catch {
    clearStoredAuthTokens()
    return null
  }
}

export async function getCurrentUser() {
  const user = await requestJson<AuthUserResponse>('/api/v1/auth/me')
  return mapSession(user)
}

export async function signOutCurrentUser() {
  try {
    await requestJson<void>('/api/v1/auth/signout', {
      method: 'POST',
    })
  } finally {
    clearStoredAuthTokens()
  }
}

export function requestPasswordReset(email: string) {
  return postJson('/api/v1/auth/password/forgot', {
    email,
    app: ADMIN_APP,
  })
}

export function resetPassword(token: string, password: string) {
  return postJson('/api/v1/auth/password/reset', {
    token,
    newPassword: password,
  })
}

export function requestEmailVerification(email: string) {
  return postJson('/api/v1/auth/email/verification', {
    email,
    app: ADMIN_APP,
  })
}
