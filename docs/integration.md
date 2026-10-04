# Admin console integration

How `sportgearhub-web-admin` wires to the platform API. Written for developers of this repo.

## Source of truth

These three files are fetched from `sportgearhub-api` (`docs/api/…`) and are the contract:

- [`swagger.json`](swagger.json) — the generated OpenAPI document for the admin surface (`Sportgearhub
  Admin API`: auth plus everything under `/internal`). Shapes and status codes come from here.
- [`admin-api-integration.md`](admin-api-integration.md) — the API team's integration guide. It carries
  the rules the spec cannot: the two review queues and their transition tables, what a refund does to a
  settlement, which buttons are irreversible. Where the two disagree, the spec is right about shapes and
  the guide is right about rules.
- [`api-errors.md`](api-errors.md) — every error `code`, its status and cause. Branch on `code`, never
  on message text.

Re-fetch all three together whenever the API changes; they are copies, kept in step by hand.

## Auth and access

Sign-in is passwordless and **email-only**: a one-time code, then a device passcode.

- **Email code** — `POST /api/v1/auth/email/start` (`{ email }`) mails a code; `POST
  /api/v1/auth/email/verify-code` (`{ email, code }`) returns tokens. Email has no silent push, so
  `start` always asks for a code.
- **Trusted device** — after the first sign-in the browser enrols a passcode
  (`POST /api/v1/auth/devices`) and unlocks with `POST /api/v1/auth/passcode/sign-in`. The 256-bit
  `device_secret` is shown once and never leaves this browser; five wrong passcodes revoke the device,
  never the account. "Войти по коду из почты" drops the local device and falls back to an emailed code.

The phone and SIM-push sign-in paths exist in the API but are not used by this console.

The console has no registration — an admin is provisioned by the platform (`AdminBootstrap`). A number
the API does not know gets a plain "not registered" answer, not a sign-up form.

Access to `/internal` requires all three, enforced server-side (401 / 403 otherwise):

- an authenticated user,
- `platform_role == "Admin"` (`GET /api/v1/auth/me` returns the single `platform_role` string, plus the
  caller's `sellers[]`), and
- the OAuth scope `internal_api`, which is only minted for admins.

`App.tsx` opens the console only when `session.isAdmin`; everyone else sees a forbidden screen. Admin
eligibility is never decided in frontend state.

## Wire format

Request and response bodies are **snake_case** in both directions. The app is camelCase internally and
converts once at the HTTP boundary in [`src/lib/case-convert.ts`](../src/lib/case-convert.ts):
`keysToSnake` on the way out, `keysToCamel` on the way in. Fields in `DATA_KEYED_MAP_FIELDS` hold maps
keyed by data (locale codes, status codes) and pass through untouched — but only when the value is a
plain object, so a contract array that happens to share a name (the catalogue `attributes` array) is
still converted.

## Errors

Every failure is an RFC-7807 `ProblemDetails` (`title`, `status`, `detail`, `instance`, `code`);
field-validation failures are 400 with an `errors` object instead of a `code`. `adminApi.ts` turns both
into an `ApiError { message, status, code, fieldErrors }` (and `NotFoundError` for 404s), so a call site
can branch on `error.code` — e.g. `seller.transition_not_allowed` means "someone else acted first,
reload the row", never "retry".

## The API client

[`src/features/admin/adminApi.ts`](../src/features/admin/adminApi.ts) is the single typed client for the
whole `/internal` surface. It owns the request core (auth header, 401-refresh retry, case conversion,
error parsing) and one function per endpoint. Endpoints that take no body (`…/payout/sync-bank-account`,
`payments/{id}/sync`, `…/cancel`, `bookings/{id}/payout`) are sent with no payload and no `Content-Type`.

## What the console does

| Section | Endpoints | Notes |
|---|---|---|
| **Overview** | `GET /internal/sellers/review-queue?status=pending_review`, `GET /internal/products/review-queue?status=pending_review`, `GET /internal/sellers?filter=status==…` | Counts come from each list's `pagination.totalItems`; the queue previews are the first page's `items`. |
| **Заявки продавцов** / **Все продавцы** | `GET /internal/sellers`, `GET /internal/sellers/{id}`, `POST …/actions`, `…/memberships` | The seller list is paged (`{ items, pagination }`) and RSQL-filtered — **no `status` param**; status is `filter=status==<value>` (`rsqlStatus()` / `status=in=(…)`). The card carries `profile`, the discriminated-union `seller` legal identity, `agreement`, `readiness`, `reviews`, `owner`, `members`. Decision buttons follow the API guide's transition table, not the status label — `archive` is terminal and is confirmed first. |
| **Товары** | `GET /internal/products/review-queue`, `GET /internal/products/{id}`, `POST …/actions` | Paged (`{ items, pagination }`, `status` defaults to `pending_review`). Queue → card with completeness `sections` and review `history`. Actions: `approve` · `request_changes` · `reject` (need a message) · `suspend`. Approve puts the card on sale immediately. |
| **Платежи и выплаты** | `payments/*`, `bookings/{id}/payment\|refund\|payout`, `settlements/{id}`, `ledger/*` | Look a payment or booking up by id (no list exists). Read the acquirer's facts, refund case, settlement and ledger; guarded actions: sync, cancel, refund and a manual booking payout. **Refund amounts are in kopecks**; the refund dialog runs `review-settlement-impact` before it fires. A refund against a paid-out booking creates a debt nothing collects automatically. |
| **Продавцы → Эквайринг** | `sellers/{id}/deal-binding`, `…/deal-bindings/{id}/actions`, `…/payout-destinations/{id}/actions` | The API exposes no list of bindings or destinations, so the tab can only create a binding (which returns its id) and act on an id already in hand. Nothing here is reversible from the console. |
| **Продавцы → Выплаты** | `sellers/{id}/payout`, `…/payout/register`, `…/payout/sync-bank-account` | Self-employed → activate an SBP recipient; ИП/организация → register the T-Bank shop from the assembled `preview`, filling only the `missing[]` fields. `bank_account_out_of_sync` surfaces the sync button. |
| **Пользователи** | `GET /internal/users` (RSQL), `/options`, `/{id}` | Read-only. Server-side filter/sort/page via `RsqlDataTable`; detail shows `platform_role` and seller memberships. |
| **Каталог** | `equipment-categories/*`, `equipment-attributes/*`, `…/allowed-values`, category↔attribute bindings | Full CRUD (no delete — retire via `status: archived`). `key`/`value_key`/`slug` are Latin identifiers and part of the contract: renaming one orphans stored values. The attribute set is deliberately frozen (see `rental-first-simplification`); the UI shows a warning on create. |

## Money units

Payment-detail, settlement and ledger amounts are already in **roubles**. The refund and
payment-status endpoints speak the acquirer's **kopecks** (`*_minor_units`). `shared/format.ts` has
`formatRubles` and `formatKopecks` — use the one that matches the field.

## Migrated from the previous surface

This branch moved the console off the pre-`rental-first-simplification` API. `provider` became
`seller` everywhere (routes, ids, types); the legal identity is now one discriminated-union object
keyed by `kind` rather than nested `person`/`business`/`company`; and the workflow, reconciliation,
capability-drift, canonicalization, payout-contract, equipment-brand, deduction and reservation
surfaces were removed with the endpoints that backed them.
