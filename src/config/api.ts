function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.hostname === 'admin.sportgearhub.ru' ? 'https://api.sportgearhub.ru' : ''
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')

export const API_BASE_URL = configuredApiBaseUrl || getDefaultApiBaseUrl()
