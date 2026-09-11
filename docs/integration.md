# Sportgearhub Web Admin Console Product Brief

This file is a repo-local product brief for building `sportgearhub-web-admin`.

The admin console is the internal/operator workspace. It is not the public customer app and not the provider console.

## Product Goal

Build a serious internal operations console for Sportgearhub.

The first prototype should support:

- admin authentication and role validation
- provider onboarding review
- provider governance
- go-live readiness
- user lookup
- booking/payment/reconciliation inspection
- fulfillment and operational case visibility
- canonicalization and capability drift surfaces where useful

Do not build payout-method onboarding yet unless explicitly requested later.

## Main Users

- platform admin
- provider onboarding reviewer
- operations manager
- reconciliation operator
- finance/control operator

## Source Material

Use these local files as references:

- `admin-web-api.md`
- `docs/internal-platform-api-surface.v1.md`
- `docs/provider-console-api-surface.v1.md`
- `docs/platform-api-readiness-checklist.v1.md`
- `docs/flows/sign-in-provider-onboarding.md`
- `docs/architecture/questions.md`

## Architecture Rules

- Internal console may expose workflow-aware state, but must preserve domain boundaries.
- Provider onboarding review must not collapse `ProviderOnboardingApplication` into `Provider`.
- Approval creates `Provider` and owner `ProviderMembership`.
- Search documents and summaries are projections only.
- Ledger/payment/settlement views are inspection/control surfaces, not random mutation surfaces.
- Do not create new support incident authority; human support stays external and links back to owning surfaces.

## Auth And Access

Admin console must require:

- authenticated user
- `Admin` role
- `internal_api` scope

Expected client:

- OIDC client id `sportgearhub-web-admin`
- callback such as `http://localhost:3001/auth/callback`
- scopes: `openid profile email offline_access internal_api`

### Wire format

Request and response bodies are **snake_case** in both directions (`{"user_id": "...", "access_token": "..."}`).
Case matching relaxes letter case only, not the separator, so camelCase keys do not bind. This app converts
once at the HTTP boundary in `src/lib/case-convert.ts` and stays camelCase internally; the fields listed in
`DATA_KEYED_MAP_FIELDS` there hold maps keyed by data (locale codes, status codes) and pass through untouched.

### Passwords are gone

There are none. `/api/v1/auth/login` accepts only `authorization_code` and `refresh_token`; the
forgot/reset endpoints no longer exist. Admin sign-in is:

```http
POST /api/v1/auth/email/start        # { email, app: "admin", delivery_mode: "code" }
POST /api/v1/auth/email/verify-code  # { email, code } -> tokens
```

An admin who has trusted this browser can unlock with a passcode instead:

```http
GET    /api/v1/auth/passcode/policy  # { length, max_attempts, max_devices_per_user }
POST   /api/v1/auth/devices          # { client_id, platform, name, passcode } -> { device_id, device_secret }
GET    /api/v1/auth/devices
POST   /api/v1/auth/devices/passcode # { device_id, device_secret, current_passcode, new_passcode }
DELETE /api/v1/auth/devices/{deviceId}
POST   /api/v1/auth/passcode/sign-in # { device_id, device_secret, passcode, client_id } -> tokens
```

`device_secret` is 256 bits returned **once** at enrolment; it stays in this browser. The sign-in request
carries no email or user id on purpose — the account comes from the device row, which is what stops a short
passcode from being sprayed at a leaked address list. Five wrong passcodes revoke the device permanently
(never the account); on `auth.device_not_trusted` or `auth.passcode_locked`, drop the local secret and fall
back to an emailed code. Never validate the passcode client-side — that hands back the attempt counter.

## Admin User Bootstrap

The first admin user is initialized by the backend from configuration.

Backend responsibility:

- read `AdminBootstrap` configuration
- create or update the configured user identity
- assign `Admin` role
- optionally bind the configured external auth provider and external id
- keep this role assignment out of frontend control

`AdminBootstrap` no longer carries a password: the bootstrap admin signs in with a one-time code to the
configured address, or through the configured external provider.

Web responsibility:

- show normal admin sign-in
- after callback, validate user has `Admin` role and `internal_api` scope
- show a clear forbidden state if the configured backend admin identity does not match the signed-in external identity
- never decide admin eligibility in frontend state

Do not build first-run admin registration in the web app.

Do not implement “first user to register becomes admin.” That is convenient, but too dangerous once deployed.

Development shortcut:

- local config may seed `admin@sportgearhub.local` and a known external auth binding
- admin console can document the expected local sign-in identity
- never ship dev-only external ids or local placeholder identity to production

## Auth App Decision

Do not create a separate auth web app yet.

Recommended now:

- one shared API/OIDC authority
- each web app owns its login entry and callback route
- customer app requests `public_api`
- provider console requests `provider_api`
- admin console requests `internal_api`

This keeps deployment simple while preserving API-surface separation.

Future option:

- introduce a shared `sportgearhub-web-auth` only if branding, SSO complexity, MFA, organization switching, or multiple app redirects become painful

## Admin Console Shell

Required:

- internal-only authenticated layout
- role/scope guard
- environment marker
- sidebar navigation
- global search placeholder
- operator identity
- safe forbidden state
- audit-aware action confirmations

Suggested navigation:

- Overview
- Provider Onboarding
- Provider Governance
- Go-Live Readiness
- Users
- Bookings
- Payments
- Refund Cases
- Reservations
- Workflows
- Reconciliation
- Settlements
- Ledger
- Capability Drift
- Canonicalization
- System

## 1. Overview

Purpose:

- show operational queues and launch blockers

Widgets:

- onboarding applications pending review
- providers blocked from go-live
- reconciliation incidents
- payment/refund cases requiring attention
- workflow recovery queue
- ledger repair warnings
- capability drift queue
- persistence/readiness warnings

Prototype rule:

- if exact aggregate endpoints are missing, build the overview from individual queue endpoints or mark widget `pending_api`

## 2. Provider Onboarding Review

Use:

- `GET /internal/provider-onboarding/{applicationId}`
- `POST /internal/provider-onboarding/{applicationId}/actions`
- provider governance queue endpoints where available

Required:

- pending applications list
- application detail
- legal identity panel
- applicant user panel
- checklist
- review note
- actions: `approve`, `request-changes`, `reject`, `suspend` where supported
- after approval, show created provider and owner membership

Important:

- approval creates provider truth; do not let admin UI edit approved provider legal identity through ordinary profile fields

## 3. Provider Governance

Use:

- `GET /internal/providers/governance?filter=<rsql>&sort=<fields>&page=1&pageSize=20`
- `GET /internal/providers/governance/options`
- `POST /internal/providers/{providerId}/governance/actions`
- `GET /internal/providers/{providerId}/profile`
- `GET /internal/providers/{providerId}/operating-state`
- `GET /internal/providers/{providerId}/memberships`

Required:

- provider governance queue
- server-side filter, sort, and pagination
- backend-provided filter fields, sort fields, default sort, and pagination limits
- full provider profile detail
- operating state
- capability, settlement, and governance status panels
- diagnostics explaining why a provider is blocked, warning, or ready when available
- provider memberships in read-only mode until write commands exist
- lifecycle actions: `activate`, `resume_review`, and `archive`
- reason/comment capture for actions that require it
- audit timeline placeholder for status changes, holds, operator comments, and readiness decisions

Governance action request:

```json
{
  "action": "activate",
  "reasonCode": null,
  "comments": null
}
```

## 4. Provider Payout Contracts

Use:

- `GET /internal/provider-payout-contracts/options`
- `GET /internal/providers/{providerId}/payout-contracts`
- `POST /internal/providers/{providerId}/payout-contracts`
- `PUT /internal/providers/{providerId}/payout-contracts/{contractId}`
- `GET /internal/providers/{providerId}/payout-contracts/{contractId}/setup-draft`
- `POST /internal/providers/{providerId}/payout-contracts/{contractId}/t-bank/sbp-recipient/register`
- `POST /internal/providers/{providerId}/payout-contracts/{contractId}/t-bank/shop/register`

The options endpoint drives payout mode dropdowns, status badges, filters, and setup action buttons:

```json
{
  "payoutModes": [
    {
      "key": "t_bank_bank_account",
      "value": "Bank requisites payout for company or sole proprietor"
    },
    {
      "key": "t_bank_sbp_individual",
      "value": "SBP payout for self-employed individual"
    }
  ],
  "statuses": [
    {
      "key": "review",
      "value": "Admin must review or complete payout setup data"
    },
    {
      "key": "setting_up",
      "value": "Admin is registering payout details in T-Bank"
    },
    {
      "key": "active",
      "value": "Payout target is registered and routeable"
    },
    {
      "key": "rejected",
      "value": "Payout setup cannot be accepted in the current form"
    },
    {
      "key": "blocked",
      "value": "Payout contract is administratively blocked"
    }
  ],
  "setupActions": [
    {
      "key": "register_sbp_payout",
      "value": "Use for t_bank_sbp_individual"
    },
    {
      "key": "register_bank_requisites_payout",
      "value": "Use for t_bank_bank_account"
    }
  ]
}
```

Status meaning:

- `review`: default after onboarding approval or manual contract edits.
- `setting_up`: operator is registering payout details in T-Bank.
- `active`: setup succeeded and the payout target is usable.
- `rejected`: corrected requisites are needed before setup can continue.
- `blocked`: platform-side stop; do not route payouts.

UI flow:

- show the provider payout contract list on provider detail
- use `setup-draft` to prefill the SBP or bank requisites registration form
- for `t_bank_sbp_individual`, submit the SBP registration action
- for `t_bank_bank_account`, submit the T-Bank shop registration action
- after success, refresh payout contracts and provider governance settlement status

Supported actions:

- `activate`
- `resume_review` or `resume-review`; requires `reasonCode`
- `archive`; requires `reasonCode`

Missing management pieces:

- invite user, change role, and remove provider access
- clearer diagnostics drilldown where current diagnostics are only summary-level
- links to resources, offers, media, bookings, and payments through internal read/review surfaces
- provider governance action history endpoint

## 4. Go-Live Readiness

Use:

- `GET /internal/providers/{providerId}/go-live-readiness`
- `POST /internal/providers/{providerId}/go-live/actions`

Required:

- readiness checklist
- blockers
- hold/release controls using `hold` and `clear_hold`
- resource and offer readiness links
- financial/acquiring readiness panel
- capability drift context when returned by the API
- recommended actions from the API response

Go-live action request:

```json
{
  "action": "hold",
  "reasonCode": "manual_review",
  "comments": "Waiting for operator review."
}
```

Supported actions:

- `hold`; requires `reasonCode`
- `clear_hold` or `clear-hold`; requires `reasonCode`

Missing management pieces:

- audit timeline for hold changes and readiness decisions
- acquiring/routing action panels for connection, routability, recipient-route, and deal-binding operations
- resource, offer, media, booking, and payment drilldowns where relevant

## 5. User Management

Use:

- `GET /internal/users?filter=<rsql>&sort=<fields>&page=1&pageSize=20`
- `GET /internal/users/options`
- `GET /internal/users/{userId}`
- `GET /internal/users/{userId}/roles`
- `GET /internal/users/{userId}/external-auth-providers`
- `GET /internal/providers/{providerId}/memberships`

Required:

- users table
- server-side filter, sort, and pagination
- backend-provided filter fields, sort fields, default sort, and pagination limits
- user detail
- roles
- external auth providers
- provider memberships
- basic name, email, phone, and verification summary

Current limitation:

- user management is read-only; no safe role, membership, account state, verification, external-auth, or session mutation command exists yet.

Needed before this becomes a full management console:

- add/remove roles with confirmation, reason, actor, and audit trail
- add/remove/update provider memberships
- disable, block, unlock, force password reset, and revoke sessions
- resend email or phone verification and recheck verification state when supported by the backend
- unlink external auth provider, revoke external token, and show external provider health
- login history, role-change history, membership-change history, and admin-action audit views
- fuller profile fields beyond the current summary

Do not add role mutation UI unless a dedicated safe admin command exists.

Do not simulate account, role, membership, verification, external-auth, or session mutations in UI state.

## 6. Bookings And Reservations

Use:

- internal booking/payment/reservation endpoints
- public/provider booking endpoints only for cross-checking visible state

Required:

- booking lookup
- reservation state
- booking workflow state
- payment correlation
- provider/customer visible status comparison

Rule:

- reservation uncertainty must route to reconciliation, not optimistic manual edits

## 7. Payments And Refund Cases

Use:

- `GET /internal/payments/{paymentId}`
- `GET /internal/payments/{paymentId}/status`
- `POST /internal/payments/{paymentId}/sync`
- refund case read/action endpoints
- cancel/refund endpoints where already implemented

Required:

- payment detail
- external PSP references
- callback/recovery state
- sync action
- refund case panel
- guarded refund/cancel action forms

Rule:

- admin UI must show factual PSP state separately from business booking state

## 8. Workflows And Reconciliation

Use:

- workflow detail endpoints
- workflow action endpoints
- reconciliation queue and incident endpoints

Required:

- recovery queue
- workflow detail
- compensation/recovery case panels
- reconciliation incident detail
- decision actions

Rule:

- uncertain external or write outcomes should be displayed as reconciliation-owned, not hidden behind generic errors

## 9. Settlements And Ledger

Use:

- settlement plan read/execute endpoints
- payout execution action endpoints in inspection mode unless explicitly enabled
- ledger by booking/payment endpoints
- ledger repair endpoint

Required:

- settlement plan detail
- refund/payout/commission allocation summary
- ledger facts table
- repair diagnostics
- repair action with strong confirmation

Rule:

- ledger completeness is mandatory
- do not present bootstrap ledger projections as final accounting truth without a status label

## 10. Capability Drift

Use:

- capability drift queue/history/impact endpoints
- remediation action endpoint

Required:

- drift queue
- provider impact detail
- reason codes
- remediation action
- history

## 11. Canonicalization

Use:

- canonical products/offers/mappings/proposals endpoints

Required:

- mapping lists
- proposal detail
- impact views
- history

Prototype note:

- canonicalization is partial; mark incomplete actions clearly

## Prototype Rules

When API exists:

- integrate the real endpoint
- enforce admin role and `internal_api` scope
- require confirmation for state-changing actions
- show audit-relevant actor and timestamp fields

When API is incomplete:

- build a read-only or prototype panel only when it clarifies operator workflow
- mark as `pending_api`, `read_only_for_now`, or `bootstrap_truth`
- never fake financial, booking, or ledger truth

## Suggested Delivery Order

1. Auth shell, callback, role/scope guard.
2. Backend-configured admin sign-in validation and dev seeded-admin instructions.
3. Provider onboarding review.
4. Provider governance and go-live readiness.
5. User lookup and memberships.
6. Reconciliation/workflow queues.
7. Payments/refund inspection.
8. Ledger/settlement inspection.
9. Capability drift and canonicalization.

## Definition Of Done For First Strong Prototype

The admin console should let an internal user:

- sign in as admin
- pass role/scope validation
- review provider onboarding
- approve or request changes safely
- inspect providers and go-live blockers
- inspect users and provider memberships
- inspect booking/payment/reconciliation state
- understand which financial surfaces are bootstrap, pending, or live
