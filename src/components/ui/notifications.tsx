import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { Button } from './button'
import { NotificationsContext, type NotificationInput, type NotificationTone } from './notifications-context'
import { cn } from '@/lib/utils'

type NotificationItem = NotificationInput & {
  id: string
  tone: NotificationTone
}

const NOTIFICATION_TTL_MS = 4200

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const notify = useCallback((notification: NotificationInput) => {
    const id = crypto.randomUUID()
    setItems((current) => [
      ...current.slice(-3),
      {
        ...notification,
        id,
        tone: notification.tone ?? 'info',
      },
    ])
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[80] grid w-[min(380px,calc(100vw-1.5rem))] gap-2" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <NotificationCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </NotificationsContext.Provider>
  )
}

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, NOTIFICATION_TTL_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [onDismiss])

  const Icon = item.tone === 'success' ? CircleCheck : item.tone === 'error' ? CircleAlert : Info

  return (
    <section
      className={cn(
        'pointer-events-auto grid grid-cols-[20px_minmax(0,1fr)_28px] gap-2 border bg-popover p-3 text-popover-foreground shadow-lg',
        item.tone === 'success' ? 'border-primary/35' : null,
        item.tone === 'error' ? 'border-destructive/45' : null,
      )}
      role={item.tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={cn('mt-0.5 size-4', item.tone === 'error' ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block text-sm font-semibold leading-5">{item.title}</strong>
        {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onDismiss} aria-label="Закрыть уведомление">
        <X size={14} aria-hidden="true" />
      </Button>
    </section>
  )
}
