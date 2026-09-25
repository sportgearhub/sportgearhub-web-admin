import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { getProviders, type ProviderListItem, type ProviderStatus } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { providerStatusLabel, providerStatusVariant, sellerKindLabel } from './providerLabels'

const ONBOARDING_TABS: Array<{ status: ProviderStatus; label: string }> = [
  { status: 'pending_review', label: 'На проверке' },
  { status: 'changes_requested', label: 'Нужны изменения' },
  { status: 'rejected', label: 'Отклонённые' },
]

type ProvidersPageProps = {
  /** «Заявки» shows the statuses a reviewer acts on; «Поставщики» shows everyone. */
  mode: 'onboarding' | 'all'
  onOpenProvider: (providerId: string) => void
}

export function ProvidersPage({ mode, onOpenProvider }: ProvidersPageProps) {
  const [status, setStatus] = useState<ProviderStatus | ''>(mode === 'onboarding' ? 'pending_review' : '')
  const [rows, setRows] = useState<ProviderListItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProviders(status || undefined))
      setError('')
    } catch (failure) {
      setRows([])
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить поставщиков')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => [row.displayName, row.legalName, row.inn, row.providerId].some((value) => value?.toLowerCase().includes(needle)))
  }, [rows, query])

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
        {mode === 'onboarding' ? (
          <div className="flex gap-1" role="tablist">
            {ONBOARDING_TABS.map((tab) => (
              <Button key={tab.status} type="button" size="sm" variant={status === tab.status ? 'secondary' : 'ghost'} role="tab" aria-selected={status === tab.status} onClick={() => setStatus(tab.status)}>
                {tab.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1" role="tablist">
            <Button type="button" size="sm" variant={status === '' ? 'secondary' : 'ghost'} onClick={() => setStatus('')}>Все</Button>
            <Button type="button" size="sm" variant={status === 'active' ? 'secondary' : 'ghost'} onClick={() => setStatus('active')}>Активные</Button>
            <Button type="button" size="sm" variant={status === 'draft' ? 'secondary' : 'ghost'} onClick={() => setStatus('draft')}>Черновики</Button>
            <Button type="button" size="sm" variant={status === 'suspended' ? 'secondary' : 'ghost'} onClick={() => setStatus('suspended')}>Приостановленные</Button>
          </div>
        )}
        <Input className="ml-auto max-w-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, ИНН, юрлицо" aria-label="Поиск" />
        <Button type="button" variant="ghost" size="icon" onClick={() => void load()} aria-label="Обновить" title="Обновить">
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
        </Button>
      </div>
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Кабинет</TableHead>
              <TableHead className="w-[12%]">Статус</TableHead>
              <TableHead className="w-[12%]">Форма</TableHead>
              <TableHead className="w-[22%]">Юрлицо · ИНН</TableHead>
              <TableHead className="w-[10%]">Договор</TableHead>
              <TableHead className="w-[10%]">Выплаты</TableHead>
              <TableHead className="w-[6%]">{mode === 'onboarding' ? 'Ждёт с' : 'Обновлён'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Загружаем…</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">{mode === 'onboarding' ? 'Заявок нет.' : 'Поставщиков нет.'}</TableCell></TableRow>
            ) : visible.map((row) => (
              <TableRow key={row.providerId} className="cursor-pointer" onClick={() => onOpenProvider(row.providerId)}>
                <TableCell>
                  <strong className="block truncate text-sm font-medium">{row.displayName}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{row.providerId}</small>
                </TableCell>
                <TableCell><Badge variant={providerStatusVariant(row.status)}>{providerStatusLabel(row.status)}</Badge></TableCell>
                <TableCell className="text-sm">{sellerKindLabel(row.sellerKind)}</TableCell>
                <TableCell>
                  <span className="block truncate text-sm">{row.legalName ?? '—'}</span>
                  <small className="block text-xs text-muted-foreground">{row.inn ?? 'ИНН не указан'}</small>
                </TableCell>
                <TableCell className="text-sm">{row.agreementNumber ? `№ ${row.agreementNumber}` : '—'}</TableCell>
                <TableCell>
                  <Badge variant={row.canBePaid ? 'success' : row.payoutRegistered ? 'info' : row.payoutDetailsPresent ? 'warning' : 'secondary'}>
                    {row.canBePaid ? 'Готовы' : row.payoutRegistered ? 'В банке' : row.payoutDetailsPresent ? 'Ждут банк' : 'Нет'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.reviewOpenedAt ?? row.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>
    </section>
  )
}
