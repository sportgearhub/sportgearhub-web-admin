import { UsersRound, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import type { InternalUserDetailResponse, SellerListItem } from '../adminApi'
import { memberRoleLabel } from '../sellers/sellerLabels'
import { getUserDisplayName } from './userUtils'

type UserDetailModalProps = {
  user: InternalUserDetailResponse
  sellers: SellerListItem[]
  error: string
  onClose: () => void
}

export function UserDetailModal({ user, sellers, error, onClose }: UserDetailModalProps) {
  const sellerLookup = new Map(sellers.map((seller) => [seller.sellerId, seller]))

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        onClose()
      }
    }}>
      <DialogContent className="max-w-[980px]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle className="truncate text-xl font-semibold">{getUserDisplayName(user)}</DialogTitle>
            <span className="block truncate text-sm text-muted-foreground">{user.phone ?? user.email ?? user.userId}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
            <X size={16} aria-hidden="true" />
          </Button>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          {error ? <p className="text-sm font-medium text-destructive ">{error}</p> : null}

          <section className="grid gap-1 text-sm">
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Роль</span><span>{user.platformRole ?? '—'}</span></div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Почта</span><span>{user.email ?? '—'}{user.email ? (user.emailVerified ? ' ✓' : ' (не подтверждена)') : ''}</span></div>
            <div className="flex gap-3"><span className="w-28 text-muted-foreground">Телефон</span><span>{user.phone ?? '—'}{user.phone ? (user.phoneVerified ? ' ✓' : ' (не подтверждён)') : ''}</span></div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <UsersRound size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Доступы к кабинетам продавцов</h3>
            </div>
            <div className="divide-y text-sm">
              {user.memberships.length ? user.memberships.map((membership) => {
                const seller = sellerLookup.get(membership.sellerId)

                return (
                  <div key={membership.membershipId} className="py-2">
                    <strong className="block truncate">{seller?.displayName ?? 'Продавец не найден'}</strong>
                    <span className="mt-1 inline-flex rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{memberRoleLabel(membership.role)}</span>
                  </div>
                )
              }) : <span className="text-sm text-muted-foreground">Доступов к продавцам нет</span>}
            </div>
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
