import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle } from './ui/card'
import { cn } from '../lib/utils'

type PanelProps = {
  children: ReactNode
  className?: string
}

type PanelHeaderProps = {
  title: string
}

export function Panel({ children, className = '' }: PanelProps) {
  return <Card className={cn('min-w-0 p-4', className)}>{children}</Card>
}

export function PanelHeader({ title }: PanelHeaderProps) {
  return (
    <CardHeader className="mb-3 border-b p-0 pb-3">
      <CardTitle>{title}</CardTitle>
    </CardHeader>
  )
}
