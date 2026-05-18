import { Route, ShieldCheck, UsersRound, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { DialogBackdrop, DialogBody, DialogContent, DialogHeader } from '../../../components/ui/dialog'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import type { InternalProviderMembershipResponse, InternalUserSummaryResponse, ProviderGovernanceSummaryResponse } from '../adminApi'
import { BooleanBadge } from '../shared/RsqlDataTable'
import { formatDateTime } from '../shared/format'
import { getOperationalStatusVariant } from '../shared/status'
import { getUserDisplayName } from '../users/userUtils'

type ProviderDetailModalProps = {
  provider: ProviderGovernanceSummaryResponse
  memberships: InternalProviderMembershipResponse[]
  users: InternalUserSummaryResponse[]
  membershipError: string
  isMembershipLoading: boolean
  onClose: () => void
}

function getUserLookup(users: InternalUserSummaryResponse[]) {
  return new Map(users.map((user) => [user.userId, user]))
}

export function ProviderDetailModal({
  provider,
  memberships,
  users,
  membershipError,
  isMembershipLoading,
  onClose,
}: ProviderDetailModalProps) {
  const userLookup = getUserLookup(users)

  return (
    <DialogBackdrop role="presentation" onMouseDown={onClose}>
      <DialogContent className="max-w-[1080px]" role="dialog" aria-modal="true" aria-labelledby="provider-detail-title" onMouseDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <div className="min-w-0">
            <h2 id="provider-detail-title" className="truncate text-xl font-semibold">{provider.displayName}</h2>
            <span className="block truncate text-sm text-muted-foreground">Доступы и операционный контроль</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
            <X size={16} aria-hidden="true" />
          </Button>
        </DialogHeader>
        <DialogBody className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="grid content-start gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Контроль</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Badge variant={getOperationalStatusVariant(provider.overallStatus)}>Сводно: {provider.overallStatus}</Badge>
              <Badge variant={getOperationalStatusVariant(provider.governanceStatus)}>Контроль: {provider.governanceStatus}</Badge>
              <Badge variant={getOperationalStatusVariant(provider.capabilityStatus)}>Возможности: {provider.capabilityStatus}</Badge>
              <Badge variant={getOperationalStatusVariant(provider.settlementStatus)}>Расчеты: {provider.settlementStatus}</Badge>
            </div>
            <div className="mt-2 grid gap-2 text-sm">
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Контакт профиля</span><BooleanBadge value={provider.diagnostics.hasProfileContact} /></div>
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Ресурсы</span><strong>{provider.diagnostics.activeResources}/{provider.diagnostics.totalResources}</strong></div>
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Офферы</span><strong>{provider.diagnostics.activeOffers}/{provider.diagnostics.totalOffers}</strong></div>
              <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">Маршруты</span><strong>{provider.diagnostics.activeRoutes}</strong></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Привязки</span><strong>{provider.diagnostics.activeBindings}</strong></div>
            </div>
          </section>

          <section className="grid content-start gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UsersRound size={16} className="text-primary" />
                <h3 className="text-sm font-semibold">Доступы</h3>
              </div>
              <Badge variant="secondary">{memberships.length}</Badge>
            </div>
            {membershipError ? <p className="text-sm font-medium text-destructive">{membershipError}</p> : null}
            <TableFrame className="max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Обновлено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.length ? memberships.map((membership) => {
                    const user = userLookup.get(membership.userId)

                    return (
                      <TableRow key={membership.providerMembershipId}>
                        <TableCell>
                          <strong className="block truncate text-sm font-medium">{user ? getUserDisplayName(user) : 'Пользователь не найден'}</strong>
                          <small className="text-xs text-muted-foreground">{user?.email ?? user?.phone ?? 'Нет контактных данных'}</small>
                        </TableCell>
                        <TableCell><Badge variant="outline">{membership.role}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(membership.updatedAt)}</TableCell>
                      </TableRow>
                    )
                  }) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        {isMembershipLoading ? 'Загружаем доступы...' : 'Доступов нет.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableFrame>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4 xl:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Route size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Эквайринг и маршрутизация</h3>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-md border bg-card p-3">
                <span className="block text-xs text-muted-foreground">Эквайринг</span>
                <strong>{provider.diagnostics.acquiringStatus ?? '—'}</strong>
              </div>
              <div className="rounded-md border bg-card p-3">
                <span className="block text-xs text-muted-foreground">Онбординг</span>
                <strong>{provider.diagnostics.acquiringOnboardingStatus ?? '—'}</strong>
              </div>
              <div className="rounded-md border bg-card p-3">
                <span className="block text-xs text-muted-foreground">Подключение</span>
                <strong className="block truncate">{provider.diagnostics.acquiringConnectionId ?? '—'}</strong>
              </div>
            </div>
          </section>
        </DialogBody>
      </DialogContent>
    </DialogBackdrop>
  )
}
