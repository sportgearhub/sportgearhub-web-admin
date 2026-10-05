import { useCallback, useEffect, useRef, useState } from 'react'
import type { PagedResult, PaginationResponse } from '../adminApi'
import { RsqlDataTable, type RsqlColumn, type RsqlTableQuery } from './RsqlDataTable'

/**
 * A data table backed by a paged endpoint. The table owns the column filters, sort and page controls
 * and reports them through `onQueryChange`; this wrapper runs the fetch and feeds back rows and
 * pagination. `reloadKey` (a status tab, a toggle) remounts the table so a new scope starts at page 1.
 */
export function ServerDataTable<T>({
  columns,
  getRowKey,
  onRowOpen,
  fetchPage,
  emptyText,
  initialSort,
  pageSizeOptions,
  initialPageSize = 20,
  reloadKey,
}: {
  columns: Array<RsqlColumn<T>>
  getRowKey: (row: T) => string
  onRowOpen?: (row: T) => void
  fetchPage: (query: RsqlTableQuery) => Promise<PagedResult<T>>
  emptyText: string
  initialSort?: string
  pageSizeOptions?: number[]
  initialPageSize?: number
  reloadKey?: string | number
}) {
  const [rows, setRows] = useState<T[]>([])
  const [pagination, setPagination] = useState<PaginationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const lastQuery = useRef<RsqlTableQuery>({ filter: '', sort: '', page: 1, pageSize: initialPageSize })
  const fetchRef = useRef(fetchPage)
  useEffect(() => { fetchRef.current = fetchPage })

  const run = useCallback((query: RsqlTableQuery) => {
    lastQuery.current = query
    setLoading(true)
    fetchRef.current(query)
      .then((result) => { setRows(result.items); setPagination(result.pagination); setError('') })
      .catch((failure: unknown) => { setRows([]); setPagination(null); setError(failure instanceof Error ? failure.message : 'Не удалось загрузить') })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <RsqlDataTable
        key={reloadKey}
        rows={rows}
        columns={columns}
        getRowKey={getRowKey}
        onRowOpen={onRowOpen}
        emptyText={emptyText}
        loading={loading}
        pagination={pagination ?? undefined}
        onQueryChange={run}
        onRefresh={() => run(lastQuery.current)}
        initialSort={initialSort}
        pageSizeOptions={pageSizeOptions}
        initialPageSize={initialPageSize}
      />
    </>
  )
}
