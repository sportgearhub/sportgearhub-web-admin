import type { AdminOidcTokens, AdminSession } from '../../types/admin'
import { keysToCamel, keysToSnake } from '../../lib/case-convert'
import { clearStoredAuthTokens, getStoredAuthTokens, storeAuthTokens } from './authTokenStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''
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
  phone?: string | null
  platformRole?: string | null
}

export type VerificationStage = 'pending' | 'code_required' | 'confirmed' | 'consumed' | 'failed' | 'expired'

export type VerificationStarted = {
  accepted: boolean
  message: string
  verificationId: string
  /** `pending` means a silent SIM push is with the user — wait, do not prompt for a code. */
  stage: VerificationStage
  codeLength: number
  expiresAt: string
}

type SimpleTokenResponse = {
  status: 'authenticated' | 'registration_required'
  accessToken: string
  refreshToken: string
  registrationToken?: string | null
}

export type PasscodePolicy = {
  length: number
  maxAttempts: number
  maxDevicesPerUser: number
}

type TrustedDeviceEnrolment = {
  deviceId: string
  // 256 bits of server-generated entropy, shown exactly once. This — not the short passcode — is what
  // makes the credential strong, so it stays in this browser and is never sent anywhere else.
  deviceSecret: string
  name: string
  platform: string
}

const DEVICE_STORAGE_KEY = 'sportgearhub.admin.device'

function storeDevice(device: TrustedDeviceEnrolment) {
  try {
    window.localStorage.setItem(
      DEVICE_STORAGE_KEY,
      JSON.stringify({ deviceId: device.deviceId, deviceSecret: device.deviceSecret }),
    )
  } catch {
    // Without storage the device cannot be remembered; sign-in falls back to an emailed code.
  }
}

function loadStoredDevice(): { deviceId: string; deviceSecret: string } | null {
  try {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY)
    if (!raw) return null

    const device = JSON.parse(raw) as Partial<{ deviceId: string; deviceSecret: string }>
    return device.deviceId && device.deviceSecret
      ? { deviceId: device.deviceId, deviceSecret: device.deviceSecret }
      : null
  } catch {
    return null
  }
}

function clearStoredDevice() {
  try {
    window.localStorage.removeItem(DEVICE_STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
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
    name: nameParts.join(' ') || user.phone || user.email || tokenEmail || 'Администратор',
    phone: user.phone ?? '',
    email: user.email ?? tokenEmail,
    isAdmin: (user.platformRole ?? '').toLowerCase() === 'admin',
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

  const roles = getClaimList(claims, ['roles', 'role', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'])
  return {
    userId: userId || email || 'admin',
    name: fullName || email || 'Администратор',
    phone: getClaimString(claims, ['phone_number', 'phone']),
    email,
    isAdmin: roles.some((role) => role.toLowerCase() === 'admin'),
    tokens,
  }
}

async function parseError(response: Response) {
  try {
    const errorBody = keysToCamel<ApiErrorBody>(await response.json())
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

  // Call sites build camelCase bodies; the wire format is snake_case. Converting here keeps a single
  // translation point instead of hand-editing every request literal.
  const requestInit: RequestInit = { ...init }
  if (typeof requestInit.body === 'string') {
    try {
      requestInit.body = JSON.stringify(keysToSnake(JSON.parse(requestInit.body)))
    } catch {
      // Not a JSON object literal — send it through unchanged.
    }
  }

  if (authorizationHeader) {
    headers.set('Authorization', authorizationHeader)
  }

  let response = await fetch(buildApiUrl(path), {
    ...requestInit,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && getStoredAuthTokens()?.refreshToken) {
    const refreshedTokens = await refreshStoredAuthTokens()

    headers.set('Authorization', `${refreshedTokens.tokenType || 'Bearer'} ${refreshedTokens.accessToken}`)
    response = await fetch(buildApiUrl(path), {
      ...requestInit,
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

  return keysToCamel<TResponse>(await response.json())
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


// There are no passwords. Step 1: mail a one-time code to the address.
export function requestPhoneCode(phone: string) {
  return requestJson<VerificationStarted>('/api/v1/auth/phone/start', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
}

export function getVerificationStage(verificationId: string) {
  return requestJson<{ stage: VerificationStage }>(`/api/v1/auth/verifications/${encodeURIComponent(verificationId)}`)
}

// Only an existing account can sign in here: the console has no registration, an admin is made
// by the platform. A number the API does not know gets a plain answer, not a registration form.
export async function signInWithPhoneCode(phone: string, code: string) {
  clearStoredAuthTokens()
  const result = await requestJson<SimpleTokenResponse>('/api/v1/auth/phone/verify-code', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
  return adoptSignIn(result)
}

export async function signInWithConfirmedPhone(verificationId: string) {
  clearStoredAuthTokens()
  const result = await requestJson<SimpleTokenResponse>('/api/v1/auth/phone/redeem', {
    method: 'POST',
    body: JSON.stringify({ verificationId }),
  })
  return adoptSignIn(result)
}

async function adoptSignIn(result: SimpleTokenResponse) {
  if (result.status === 'registration_required') {
    throw new Error('Этот номер не зарегистрирован. Доступ в консоль выдаёт платформа.')
  }
  return adoptSimpleToken(result)
}

export async function signInWithPasscode(passcode: string) {
  const device = loadStoredDevice()

  if (!device) {
    throw new Error('Это устройство не доверено.')
  }

  clearStoredAuthTokens()

  try {
    const result = await requestJson<SimpleTokenResponse>('/api/v1/auth/passcode/sign-in', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: device.deviceId,
        deviceSecret: device.deviceSecret,
        passcode,
        clientId: OIDC_CLIENT_ID,
      }),
    })
    return await adoptSimpleToken(result)
  } catch (error) {
    // A revoked or forgotten device can never be used again: drop the local secret so the UI falls
    // back to an emailed code.
    const message = error instanceof Error ? error.message : ''
    if (message.includes('не доверено') || message.includes('отозвано')) {
      clearStoredDevice()
    }
    throw error
  }
}

export function getPasscodePolicy() {
  return requestJson<PasscodePolicy>('/api/v1/auth/passcode/policy')
}

export async function enrolTrustedDevice(passcode: string, name: string) {
  const device = await requestJson<TrustedDeviceEnrolment>('/api/v1/auth/devices', {
    method: 'POST',
    body: JSON.stringify({ clientId: OIDC_CLIENT_ID, platform: 'web', name, passcode }),
  })
  storeDevice(device)
  return device
}

export function hasTrustedDevice() {
  return loadStoredDevice() !== null
}

export function forgetLocalDevice() {
  clearStoredDevice()
}

async function adoptSimpleToken(result: SimpleTokenResponse) {
  const tokens = storeAuthTokens(mapTokenResponse({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: accessTokenLifetimeSeconds(result.accessToken),
    refresh_token: result.refreshToken,
    scope: OIDC_SCOPE,
  }))

  try {
    return await getCurrentUser()
  } catch {
    return mapSessionFromTokens(tokens)
  }
}

function accessTokenLifetimeSeconds(accessToken: string) {
  const claims = decodeJwtClaims(accessToken)
  const exp = claims && typeof claims.exp === 'number' ? claims.exp : null
  return exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 3600
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
