import { useMemo } from 'react'
import { RsqlDataTable } from '../shared/RsqlDataTable'
import { UserDetailModal } from './UserDetailModal'
import { createUserColumns } from './userColumns'
import { useUserManagement } from './useUserManagement'

function buildPageSizeOptions(defaultPageSize: number, maxPageSize: number) {
  return Array.from(new Set([10, 20, 50, 100, defaultPageSize].filter((pageSize) => pageSize <= maxPageSize))).sort((left, right) => left - right)
}

export function UserManagementPage() {
  const { users, providers, selectedUser, pagination, listOptions, isLoading, error, detailError, loadUsers, openUser, closeUser } = useUserManagement()
  const columns = useMemo(() => createUserColumns(listOptions), [listOptions])
  const defaultPageSize = listOptions?.pagination.defaultPageSize ?? 20
  const maxPageSize = listOptions?.pagination.maxPageSize ?? 100
  const pageSizeOptions = useMemo(() => buildPageSizeOptions(defaultPageSize, maxPageSize), [defaultPageSize, maxPageSize])

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col overflow-hidden bg-card">
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <RsqlDataTable
        rows={users}
        columns={columns}
        getRowKey={(user) => user.userId}
        emptyText="Пользователей нет."
        loading={isLoading}
        onRefresh={() => void loadUsers()}
        pageSizeOptions={pageSizeOptions}
        initialPageSize={defaultPageSize}
        initialSort={listOptions?.defaultSort}
        pagination={pagination}
        onQueryChange={(query) => void loadUsers(query)}
        onRowOpen={openUser}
      />
      {selectedUser ? <UserDetailModal user={selectedUser} providers={providers} error={detailError} onClose={closeUser} /> : null}
    </section>
  )
}
