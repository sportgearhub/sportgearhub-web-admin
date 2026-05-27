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
  return <Card className={cn('min-w-0 p-3', className)}>{children}</Card>
}

export function PanelHeader({ title }: PanelHeaderProps) {
  return (
    <CardHeader className="mb-2 border-b p-0 pb-2">
      <CardTitle>{title}</CardTitle>
    </CardHeader>
  )
}
