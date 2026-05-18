import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, RotateCcw, Search, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import type { PaginationResponse } from '../adminApi'

export type RsqlColumn<TRow> = {
  key: string
  label: string
  field: string
  render: (row: TRow) => React.ReactNode
  value: (row: TRow) => string | number | boolean | null | undefined
  width?: string
  align?: 'left' | 'right'
  filterKind?: 'text' | 'select' | 'boolean'
  options?: string[]
}

type SortDirection = 'asc' | 'desc' | ''
type ColumnState = Record<string, { filter: string; sort: SortDirection }>
type FlyoutPosition = { top: number; left: number }

export type RsqlTableQuery = {
  filter: string
  sort: string
  page: number
  pageSize: number
}

type RsqlDataTableProps<TRow> = {
  rows: TRow[]
  columns: Array<RsqlColumn<TRow>>
  getRowKey: (row: TRow) => string
  emptyText: string
  loading?: boolean
  onRefresh?: () => void
  pageSizeOptions?: number[]
  initialPageSize?: number
  initialSort?: string
  onRowOpen?: (row: TRow) => void
  pagination?: PaginationResponse
  onQueryChange?: (query: RsqlTableQuery) => void
}

function escapeRsqlValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeValue(value: string | number | boolean | null | undefined) {
  return String(value ?? '').trim()
}

function compareValues(left: string | number | boolean | null | undefined, right: string | number | boolean | null | undefined) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return normalizeValue(left).localeCompare(normalizeValue(right), 'ru', { numeric: true, sensitivity: 'base' })
}

function getSortIcon(direction: SortDirection) {
  if (direction === 'asc') {
    return <ArrowUp size={13} aria-hidden="true" />
  }

  if (direction === 'desc') {
    return <ArrowDown size={13} aria-hidden="true" />
  }

  return <ArrowUpDown size={13} aria-hidden="true" />
}

function buildRsql(columns: Array<RsqlColumn<unknown>>, columnState: ColumnState) {
  return columns.flatMap((column) => {
    const filter = columnState[column.key]?.filter.trim()

    if (!filter) {
      return []
    }

    if (column.filterKind === 'text' || !column.filterKind) {
      return `${column.field}=="*${escapeRsqlValue(filter)}*"`
    }

    return `${column.field}=="${escapeRsqlValue(filter)}"`
  }).join(';')
}

function buildSort(columns: Array<RsqlColumn<unknown>>, columnState: ColumnState) {
  return columns.flatMap((column) => {
    const sort = columnState[column.key]?.sort

    if (!sort) {
      return []
    }

    return sort === 'desc' ? `-${column.field}` : column.field
  }).join(',')
}

function buildColumnState<TRow>(columns: Array<RsqlColumn<TRow>>, sortExpression?: string) {
  const state = columns.reduce((currentState, column) => {
    currentState[column.key] = { filter: '', sort: '' }
    return currentState
  }, {} as ColumnState)

  if (!sortExpression) {
    return state
  }

  sortExpression.split(',').map((value) => value.trim()).filter(Boolean).forEach((sortField) => {
    const direction: SortDirection = sortField.startsWith('-') ? 'desc' : 'asc'
    const field = sortField.replace(/^-/, '')
    const column = columns.find((candidate) => candidate.field === field)

    if (column) {
      state[column.key].sort = direction
    }
  })

  return state
}

export function RsqlDataTable<TRow>({
  rows,
  columns,
  getRowKey,
  emptyText,
  loading = false,
  onRefresh,
  pageSizeOptions = [10, 20, 50],
  initialPageSize = 20,
  initialSort,
  onRowOpen,
  pagination,
  onQueryChange,
}: RsqlDataTableProps<TRow>) {
  const emptyState = useMemo(() => buildColumnState(columns), [columns])
  const [columnState, setColumnState] = useState<ColumnState>(emptyState)
  const [activeColumn, setActiveColumn] = useState<RsqlColumn<TRow> | null>(null)
  const [flyoutPosition, setFlyoutPosition] = useState<FlyoutPosition | null>(null)
  const [filterDraft, setFilterDraft] = useState('')
  const [sortDraft, setSortDraft] = useState<SortDirection>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const isServerBacked = Boolean(onQueryChange)
  const onQueryChangeRef = useRef(onQueryChange)
  const appliedInitialSortRef = useRef('')
  const appliedInitialPageSizeRef = useRef(initialPageSize)

  const filteredRows = useMemo(() => {
    return rows.filter((row) =>
      columns.every((column) => {
        const filter = columnState[column.key]?.filter.trim().toLowerCase()

        if (!filter) {
          return true
        }

        const value = normalizeValue(column.value(row)).toLowerCase()

        if (column.filterKind === 'text' || !column.filterKind) {
          return value.includes(filter)
        }

        return value === filter
      }),
    )
  }, [columnState, columns, rows])

  const sortedRows = useMemo(() => {
    const activeSort = columns.find((column) => columnState[column.key]?.sort)

    if (!activeSort) {
      return filteredRows
    }

    const direction = columnState[activeSort.key].sort
    return [...filteredRows].sort((left, right) => {
      const compared = compareValues(activeSort.value(left), activeSort.value(right))
      return direction === 'desc' ? -compared : compared
    })
  }, [columnState, columns, filteredRows])

  const rsql = buildRsql(columns as Array<RsqlColumn<unknown>>, columnState)
  const sort = buildSort(columns as Array<RsqlColumn<unknown>>, columnState)
  const totalItems = pagination?.totalItems ?? sortedRows.length
  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(pagination?.page ?? page, totalPages)
  const pageRows = isServerBacked ? rows : sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const displayedItems = isServerBacked ? rows.length : sortedRows.length
  const hasPreviousPage = pagination?.hasPreviousPage ?? safePage > 1
  const hasNextPage = pagination?.hasNextPage ?? safePage < totalPages

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange
  }, [onQueryChange])

  useEffect(() => {
    if (!initialSort || appliedInitialSortRef.current === initialSort) {
      return
    }

    appliedInitialSortRef.current = initialSort
    setColumnState(buildColumnState(columns, initialSort))
    setPage(1)
  }, [columns, initialSort])

  useEffect(() => {
    if (appliedInitialPageSizeRef.current === initialPageSize) {
      return
    }

    appliedInitialPageSizeRef.current = initialPageSize
    setPageSize(initialPageSize)
    setPage(1)
  }, [initialPageSize])

  useEffect(() => {
    if (!onQueryChangeRef.current) {
      return
    }

    onQueryChangeRef.current({
      filter: rsql,
      sort,
      page,
      pageSize,
    })
  }, [page, pageSize, rsql, sort])

  function openColumn(column: RsqlColumn<TRow>, anchor: HTMLElement) {
    const state = columnState[column.key] ?? { filter: '', sort: '' }
    const rect = anchor.getBoundingClientRect()

    setActiveColumn(column)
    setFlyoutPosition({
      top: rect.bottom + 8,
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 376)),
    })
    setFilterDraft(state.filter)
    setSortDraft(state.sort)
  }

  function closeColumnFlyout() {
    setActiveColumn(null)
    setFlyoutPosition(null)
  }

  function applyColumn() {
    if (!activeColumn) {
      return
    }

    setColumnState((current) => ({
      ...current,
      [activeColumn.key]: { filter: filterDraft, sort: sortDraft },
    }))
    setPage(1)
    closeColumnFlyout()
  }

  function clearAll() {
    setColumnState(emptyState)
    setPage(1)
  }

  function changePageSize(nextPageSize: number) {
    setPageSize(nextPageSize)
    setPage(1)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0 text-xs text-muted-foreground">
          <span>{displayedItems} / {totalItems}</span>
          {rsql ? <span className="ml-2 hidden truncate md:inline">фильтр: {rsql}</span> : null}
          {sort ? <span className="ml-2 hidden truncate md:inline">сортировка: {sort}</span> : null}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
              Обновить
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={clearAll} aria-label="Сбросить фильтры" title="Сбросить фильтры">
            <RotateCcw size={15} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <TableFrame className="min-h-0 flex-1 rounded-none border-0 bg-background">
        <Table className="table-fixed">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <TableRow>
              {columns.map((column) => {
                const state = columnState[column.key]
                const isActive = Boolean(state?.filter || state?.sort)

                return (
                  <TableHead key={column.key} className={column.align === 'right' ? 'px-2 text-right' : 'px-2'}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-background"
                      onClick={(event) => openColumn(column, event.currentTarget)}
                    >
                      <span className="min-w-0 break-words">{column.label}</span>
                      <span className={isActive ? 'grid size-5 shrink-0 place-items-center rounded bg-accent text-primary' : 'grid size-5 shrink-0 place-items-center text-muted-foreground'}>
                        {state?.filter ? <Filter size={12} aria-hidden="true" /> : null}
                        {getSortIcon(state?.sort ?? '')}
                      </span>
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  className={onRowOpen ? 'cursor-pointer' : undefined}
                  tabIndex={onRowOpen ? 0 : undefined}
                  onClick={onRowOpen ? () => onRowOpen(row) : undefined}
                  onKeyDown={onRowOpen ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowOpen(row)
                    }
                  } : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.align === 'right' ? 'min-w-0 px-2 text-right' : 'min-w-0 px-2'}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  {loading ? 'Загружаем...' : emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
        <span>Страница {safePage} из {totalPages}</span>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border bg-card px-2 text-sm outline-none"
            value={pageSize}
            onChange={(event) => changePageSize(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <Button type="button" variant="ghost" size="sm" disabled={loading || !hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Назад
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={loading || !hasNextPage} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            Вперед
          </Button>
        </div>
      </footer>

      {activeColumn && flyoutPosition ? (
        <div className="fixed inset-0 z-50" role="presentation" onMouseDown={closeColumnFlyout}>
          <section
            className="absolute grid w-[min(360px,calc(100vw-2rem))] gap-4 rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl"
            style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
            role="dialog"
            aria-labelledby="rsql-column-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3">
              <h2 id="rsql-column-title" className="truncate text-sm font-semibold">{activeColumn.label}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={closeColumnFlyout} aria-label="Закрыть">
                <X size={16} aria-hidden="true" />
              </Button>
            </header>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Фильтр</span>
                {activeColumn.options?.length ? (
                  <select className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={filterDraft} onChange={(event) => setFilterDraft(event.target.value)}>
                    <option value="">Все</option>
                    {activeColumn.options.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input className="pl-9" value={filterDraft} onChange={(event) => setFilterDraft(event.target.value)} autoFocus />
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {activeColumn.filterKind === 'text' || !activeColumn.filterKind
                    ? `${activeColumn.field}=="*${escapeRsqlValue(filterDraft)}*"`
                    : `${activeColumn.field}=="${escapeRsqlValue(filterDraft)}"`}
                </span>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Сортировка</span>
                <select className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring" value={sortDraft} onChange={(event) => setSortDraft(event.target.value as SortDirection)}>
                  <option value="">Без сортировки</option>
                  <option value="asc">По возрастанию</option>
                  <option value="desc">По убыванию</option>
                </select>
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setFilterDraft('')
                setSortDraft('')
              }}>
                Очистить
              </Button>
              <Button type="button" onClick={applyColumn}>Применить</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export function BooleanBadge({ value }: { value: boolean }) {
  return <Badge variant={value ? 'success' : 'secondary'}>{value ? 'Да' : 'Нет'}</Badge>
}
