const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''
const ADMIN_APP = 'admin'

type ApiErrorBody = {
  message?: string
  title?: string
}

function buildApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

async function postJson(path: string, body: Record<string, string>) {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (response.ok) {
    return
  }

  let errorMessage = 'Не удалось выполнить запрос'

  try {
    const errorBody = (await response.json()) as ApiErrorBody
    errorMessage = errorBody.message ?? errorBody.title ?? errorMessage
  } catch {
    errorMessage = 'Не удалось выполнить запрос'
  }

  throw new Error(errorMessage)
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
