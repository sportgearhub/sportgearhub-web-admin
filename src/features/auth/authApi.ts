import type { AdminSession } from '../../types/admin'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''
const ADMIN_APP = 'admin'

type ApiErrorBody = {
  message?: string
  title?: string
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

function mapSession(user: AuthUserResponse): AdminSession {
  const nameParts = [user.name, user.surname].filter(Boolean)

  return {
    userId: user.userId,
    name: nameParts.join(' ') || user.email || 'Администратор',
    email: user.email ?? '',
    roles: user.roles ?? [],
  }
}

async function requestJson<TResponse>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  headers.set('Accept', 'application/json')

  if (init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    let errorMessage = 'Не удалось выполнить запрос'

    try {
      const errorBody = (await response.json()) as ApiErrorBody
      errorMessage = errorBody.message ?? errorBody.title ?? errorMessage
    } catch {
      errorMessage = 'Не удалось выполнить запрос'
    }

    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}

async function postJson(path: string, body: Record<string, string>) {
  await requestJson<void>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function signInWithPassword(email: string, password: string) {
  const user = await requestJson<AuthUserResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  })

  try {
    return await getCurrentUser()
  } catch {
    return mapSession(user)
  }
}

export async function getCurrentUser() {
  const user = await requestJson<AuthUserResponse>('/api/v1/auth/me')
  return mapSession(user)
}

export function signOutCurrentUser() {
  return requestJson<void>('/api/v1/auth/signout', {
    method: 'POST',
  })
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
    password,
  })
}

export function requestEmailVerification(email: string) {
  return postJson('/api/v1/auth/email/verification', {
    email,
    app: ADMIN_APP,
  })
}
