import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/badge'
import { getInternalUser, getSellers, type InternalUserDetailResponse, type SellerListItem } from '../adminApi'
import { formatDateTime } from '../shared/format'
import { memberRoleLabel } from '../sellers/sellerLabels'
import { DetailScreen, Field, Panel, PanelGrid } from '../shared/detail'
import { getUserDisplayName } from './userUtils'

export function UserDetailPage({ userId, onBack, onOpenSeller }: { userId: string; onBack: () => void; onOpenSeller: (sellerId: string) => void }) {
  const [user, setUser] = useState<InternalUserDetailResponse | null>(null)
  const [sellers, setSellers] = useState<SellerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      getInternalUser(userId)
        .then((value) => { if (mounted) { setUser(value); setError('') } })
        .catch((failure: unknown) => { if (mounted) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить пользователя') })
        .finally(() => { if (mounted) setLoading(false) })
      getSellers({ pageSize: 100 }).then((result) => { if (mounted) setSellers(result.items) }).catch(() => undefined)
    }, 0)
    return () => { mounted = false; window.clearTimeout(timer) }
  }, [userId])

  const sellerName = (sellerId: string) => sellers.find((seller) => seller.sellerId === sellerId)?.displayName

  return (
    <DetailScreen
      onBack={onBack}
      title={user ? getUserDisplayName(user) : 'Пользователь'}
      subtitle={user?.email ?? user?.phone ?? undefined}
      badges={user?.platformRole ? <Badge variant="secondary">{user.platformRole}</Badge> : null}
      loading={loading}
      error={error}
    >
      {user ? (
        <PanelGrid>
          <Panel title="Профиль">
            <dl>
              <Field label="Имя" value={getUserDisplayName(user)} />
              <Field label="Роль" value={user.platformRole ?? '—'} />
              <Field label="Почта" value={user.email ? `${user.email}${user.emailVerified ? ' ✓' : ' (не подтверждена)'}` : '—'} />
              <Field label="Телефон" value={user.phone ? `${user.phone}${user.phoneVerified ? ' ✓' : ' (не подтверждён)'}` : '—'} />
              <Field label="Создан" value={formatDateTime(user.createdAt)} />
              <Field label="Обновлён" value={formatDateTime(user.updatedAt)} />
            </dl>
          </Panel>

          <Panel title="Доступы к кабинетам продавцов">
            {user.memberships.length ? (
              <ul className="divide-y text-sm">
                {user.memberships.map((membership) => (
                  <li key={membership.membershipId} className="flex items-center justify-between gap-3 py-2">
                    <button type="button" className="min-w-0 text-left hover:underline" onClick={() => onOpenSeller(membership.sellerId)}>
                      <strong className="block truncate">{sellerName(membership.sellerId) ?? 'Открыть продавца'}</strong>
                      <span className="block truncate text-xs text-muted-foreground">{membership.sellerId}</span>
                    </button>
                    <Badge variant={membership.role === 'owner' ? 'default' : 'secondary'}>{memberRoleLabel(membership.role)}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Доступов к продавцам нет.</p>}
          </Panel>
        </PanelGrid>
      ) : null}
    </DetailScreen>
  )
}
