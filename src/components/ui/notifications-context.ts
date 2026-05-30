import { createContext, useContext } from 'react'

export type NotificationTone = 'success' | 'error' | 'info'

export type NotificationInput = {
  tone?: NotificationTone
  title: string
  description?: string
}

export type NotificationsContextValue = {
  notify: (notification: NotificationInput) => void
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function useNotifications() {
  const context = useContext(NotificationsContext)

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }

  return context
}
