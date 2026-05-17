import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function DialogBackdrop({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4', className)} {...props} />
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl', className)} {...props} />
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-4 border-b px-5 py-4', className)} {...props} />
}

export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-y-auto p-5', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-t px-5 py-4', className)} {...props} />
}
