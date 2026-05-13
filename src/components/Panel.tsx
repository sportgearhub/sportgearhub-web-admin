import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
  className?: string
}

type PanelHeaderProps = {
  title: string
}

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`panel ${className}`.trim()}>{children}</section>
}

export function PanelHeader({ title }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <h2>{title}</h2>
    </header>
  )
}
