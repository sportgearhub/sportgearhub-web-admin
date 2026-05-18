import { KeyRound, ShieldCheck, UsersRound, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { DialogBackdrop, DialogBody, DialogContent, DialogHeader } from '../../../components/ui/dialog'
import type { InternalUserDetailResponse, ProviderGovernanceSummaryResponse } from '../adminApi'
import { getUserDisplayName } from './userUtils'

type UserDetailModalProps = {
  user: InternalUserDetailResponse
  providers: ProviderGovernanceSummaryResponse[]
  error: string
  onClose: () => void
}

function getProviderLookup(providers: ProviderGovernanceSummaryResponse[]) {
  return new Map(providers.map((provider) => [provider.providerId, provider]))
}

export function UserDetailModal({ user, providers, error, onClose }: UserDetailModalProps) {
  const providerLookup = getProviderLookup(providers)

  return (
    <DialogBackdrop role="presentation" onMouseDown={onClose}>
      <DialogContent className="max-w-[980px]" role="dialog" aria-modal="true" aria-labelledby="user-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div className="min-w-0">
            <h2 id="user-detail-title" className="truncate text-xl font-semibold">{getUserDisplayName(user)}</h2>
            <span className="block truncate text-sm text-muted-foreground">{user.email ?? user.userId}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
            <X size={16} aria-hidden="true" />
          </Button>
        </DialogHeader>
        <DialogBody className="grid gap-4 lg:grid-cols-3">
          {error ? <p className="text-sm font-medium text-destructive lg:col-span-3">{error}</p> : null}

          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Роли</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.roles.length ? user.roles.map((role) => (
                <Badge key={role.userRoleId} variant="secondary">{role.role}</Badge>
              )) : <span className="text-sm text-muted-foreground">Ролей нет</span>}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Внешний вход</h3>
            </div>
            <div className="grid gap-2">
              {user.externalAuthProviders.length ? user.externalAuthProviders.map((provider) => (
                <div key={provider.externalAuthProviderId} className="rounded-md border bg-card p-2 text-sm">
                  <strong className="block">{provider.provider}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{provider.externalId}</span>
                </div>
              )) : <span className="text-sm text-muted-foreground">Подключений нет</span>}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <UsersRound size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Доступы</h3>
            </div>
            <div className="grid gap-2">
              {user.providerMemberships.length ? user.providerMemberships.map((membership) => {
                const provider = providerLookup.get(membership.providerId)

                return (
                  <div key={membership.providerMembershipId} className="rounded-md border bg-card p-2 text-sm">
                    <strong className="block truncate">{provider?.displayName ?? 'Поставщик не найден'}</strong>
                    <span className="mt-1 inline-flex rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{membership.role}</span>
                  </div>
                )
              }) : <span className="text-sm text-muted-foreground">Доступов к поставщикам нет</span>}
            </div>
          </section>
        </DialogBody>
      </DialogContent>
    </DialogBackdrop>
  )
}
