export type Severity = 'critical' | 'warning' | 'info' | 'ok'

export type AdminSectionId =
  | 'overview'
  | 'onboarding'
  | 'governance'
  | 'readiness'
  | 'users'
  | 'bookings'
  | 'payments'
  | 'refunds'
  | 'reservations'
  | 'workflows'
  | 'reconciliation'
  | 'settlements'
  | 'ledger'
  | 'drift'
  | 'canonicalization'
  | 'system'

export type NavItem = {
  id: AdminSectionId
  label: string
}

export type QueueItem = {
  id: string
  title: string
  owner: string
  severity: Severity
  status: string
  updatedAt: string
}

export type ConsoleAction = {
  label: string
  tone?: 'default' | 'danger'
}

export type OnboardingApplication = {
  id: string
  providerId?: string
  isApiBacked?: boolean
  providerName: string
  applicantName: string
  applicantEmail: string
  submittedAt: string
  status: string
  priority: Severity
  legalName: string
  legalCountryCode?: string
  legalForm?: string
  taxId: string
  registrationNumber?: string
  branchNumber?: string
  registeredAddress?: string
  contactPhone?: string
  city: string
  address?: string
  description?: string
  reviewNote: string
  checklist: Array<{
    label: string
    done: boolean
  }>
}

export type SectionRecord = {
  id: string
  title: string
  status: string
  updatedAt: string
  owner: string
  severity?: Severity
  details: readonly FactRow[]
}

export type AdminSession = {
  userId: string
  name: string
  email: string
  roles: string[]
}

export type FactRow = readonly [label: string, value: string]
