import { RsqlDataTable } from '../shared/RsqlDataTable'
import { UserDetailModal } from './UserDetailModal'
import { userColumns } from './userColumns'
import { useUserManagement } from './useUserManagement'

export function UserManagementPage() {
  const { users, providers, selectedUser, isLoading, error, detailError, loadUsers, openUser, closeUser } = useUserManagement()

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col overflow-hidden bg-background">
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <RsqlDataTable
        rows={users}
        columns={userColumns}
        getRowKey={(user) => user.userId}
        emptyText="Пользователей нет."
        loading={isLoading}
        onRefresh={() => void loadUsers()}
        onRowOpen={openUser}
      />
      {selectedUser ? <UserDetailModal user={selectedUser} providers={providers} error={detailError} onClose={closeUser} /> : null}
    </section>
  )
}
