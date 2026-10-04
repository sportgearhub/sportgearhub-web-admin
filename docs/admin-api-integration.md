# Admin console integration

For the developers building `sportgearhub-web-admin`.

`docs/api/openapi/admin.json` is the generated contract. This page carries what it cannot: the two
review queues and their transition tables, what a refund actually does to a settlement, and which
buttons are irreversible.

Every error code with its status and cause is in [`docs/api/errors.md`](../errors.md).

Conventions are the same as everywhere — see
[`seller.md`](seller.md#conventions-that-hold-everywhere). Everything under `/internal` requires an
administrator session; `/api/v1/auth/…` is the same sign-in as the other two surfaces.

**Read this first: most actions here are visible to a seller immediately.** Approving puts a card on
sale. Suspending takes a business off the marketplace. Rejecting sends a message they will read.
There is no draft state for an administrator's decision and no undo — the transition table below is
the only thing standing between a misclick and a consequence.

---

## The seller review queue

```
GET  /internal/sellers?filter=status==pending_review   who is waiting
GET  /internal/sellers/review-queue                    the same queue, leaner rows
GET  /internal/sellers/{seller_id}         the full dossier
POST /internal/sellers/{seller_id}/actions the decision
GET  /internal/sellers/{seller_id}/memberships
```

All three lists answer `{ items, pagination }` and take `page`/`pageSize`; `/internal/sellers` and
`/internal/users` take `filter` and `sort` too. Until 2026-10-01 `/internal/sellers` returned every
cabinet on the platform and ran eight satellite queries over all of them to show twenty rows.

Status is a filter: `?filter=status==pending_review` is «Заявки»,
`?filter=status=in=(draft,changes_requested)` is everything waiting on the seller.

> A `tab` parameter and a `tab-counts` endpoint existed here for one day. They were added while
> `filter=status==pending_review` could not work — the query SDK matched enum values by member name,
> and an underscore is not part of one — and removed once `RsqlParserNet.Linq` 1.1.1 fixed that. Every
> value they offered was a status, so the parameter was a second way to say the same thing.

## The product review queue

```
GET  /internal/products/review-queue?status=pending_review&page=1&pageSize=20
GET  /internal/products/{product_id}
POST /internal/products/{product_id}/actions
```

`{ items, pagination }`, oldest first, `status` defaulting to `pending_review`. It used to return the
whole queue — which is longest on exactly the day you are most behind.

```json
POST /internal/products/{product_id}/actions
{ "action": "request_changes", "message": "На фотографии другой велосипед." }
```

| `action` | Result |
|---|---|
| `approve` | → `active`, on sale immediately |
| `request_changes` | → `changes_requested`, with the message |
| `reject` | → `rejected` |
| `suspend` | → `suspended` |

`request-changes` with a hyphen is accepted as well as `request_changes`; prefer the underscore.

A card is submitted by its seller only when every section is complete, so a card in the queue is
already whole. What you are judging is content, not completeness.

> **A seller can edit an `active` card and the edit goes live without coming back here.** That is a
> known gap, not a feature: your approval covers the card as it was when you saw it. A draft-and-review
> mechanism is designed but not built — `docs/product-drafts.design.md`. Until it ships, treat an
> approval as a judgement on a moment, and use `active` → `request_changes` when something changes
> under you.

---

## The catalogue schema

The categories and attributes every seller's card is built from. Editing these changes what sellers
can describe.

```
GET   /internal/equipment-categories
POST  /internal/equipment-categories
PATCH /internal/equipment-categories/{category_id}
GET   /internal/equipment-categories/{category_slug}/attributes

GET   /internal/equipment-attributes
POST  /internal/equipment-attributes
PATCH /internal/equipment-attributes/{attribute_id}
PUT   /internal/equipment-attributes/{attribute_id}/allowed-values

POST  /internal/equipment-categories/{category_id}/attributes            bind one to a category
PATCH /internal/equipment-categories/{category_id}/attributes/{attribute_id}
```

An attribute is defined once and **bound** to categories. The binding carries what is
category-specific — whether it is required there, its bounds, its group and its order — so `brand`
can be required for bicycles and optional for yoga mats without two definitions.

**`key` and `value_key` are Latin identifiers and are part of the contract.** Sellers' cards store
values by key; the web apps compare them in code. Renaming one orphans every stored value. The Russian
label lives in `name`, which is safe to change at any time.

`PUT …/allowed-values` replaces the whole list for an `enum`. Removing a value does not remove it from
cards that already hold it, so remove one only when nothing uses it.

`value_type` is one of `string` · `integer` · `decimal` · `boolean` · `enum` · `reference`. Changing
it on a live attribute will not reinterpret stored values — treat it as create-once.

---

## Payments

```
GET  /internal/payments/{payment_id}
GET  /internal/payments/{payment_id}/status
POST /internal/payments/{payment_id}/sync
POST /internal/payments/{payment_id}/cancel
GET  /internal/payments/{payment_id}/refund
POST /internal/payments/{payment_id}/refund
POST /internal/payments/{payment_id}/refund-case/review-settlement-impact
GET  /internal/bookings/{booking_id}/payment
GET  /internal/bookings/{booking_id}/refund
```

`sync` and `cancel` take **no body** — everything they need is in the path. Send no payload and no
`Content-Type`.

**Acquiring here is one-stage.** A payment reaching `CONFIRMED` is settled with no further call from
us; there is no capture step to perform. `AUTHORIZED` is **not** success — never read it as a paid
booking. `sync` re-asks the bank and writes down what it says; use it when our status and the bank's
have drifted.

### Refunds

```json
POST /internal/payments/{payment_id}/refund
{ "amount_minor_units": 120000, "reason_code": "seller_cancelled" }
```

**`amount_minor_units` is in kopecks**, unlike every amount on the other two surfaces. 120000 is
1 200 ₽. This is the one endpoint that does not speak roubles, because it talks to the acquirer in the
acquirer's units. Omit it for a full refund.

`GET …/refund` reads what has already been refunded — check it before refunding again, since partial
refunds accumulate.

**A refund moves money that may already be promised to a seller.** Call
`POST …/refund-case/review-settlement-impact` first: it reports what the refund would do to the
settlement plan and the payout. Show that to the operator before the confirm dialog. A refund issued
against a paid-out booking creates a debt, and nothing in the API collects it for you.

### Ledger and settlements

```
GET /internal/ledger/bookings/{booking_id}
GET /internal/ledger/payments/{payment_id}
GET /internal/settlements/{settlement_plan_id}
```

Read-only. The ledger is the audit trail — every movement with its cause. Use it to answer "where did
this money go", not to compute balances yourself.

---

## Payouts and bank binding

```
GET  /internal/sellers/{seller_id}/payout
POST /internal/sellers/{seller_id}/payout/register
POST /internal/sellers/{seller_id}/payout/sync-bank-account
POST /internal/sellers/{seller_id}/deal-binding
POST /internal/sellers/{seller_id}/deal-bindings/{binding_id}/actions
POST /internal/sellers/{seller_id}/payout-destinations/{destination_id}/actions
POST /internal/bookings/{booking_id}/payout
GET  /api/v1/payment-reference/sbp-members
```

`register` and `sync-bank-account` take **no body**.

These call the acquirer, so they fail for reasons outside our control.
`acquiring.shop_registration_failed` carries what the bank said — show it verbatim to the operator,
because it usually names the field to correct.

A deal binding connects a seller to the acquirer's multisplit arrangement. Its `actions` endpoint
takes `{ "action": "…", "reason_code": "…", "comments": "…" }`. Nothing here is reversible from the
console; a wrong binding needs the acquirer.

`POST /internal/bookings/{booking_id}/payout` pays a single booking out by hand. It takes no body.
Use it for a booking the scheduled worker did not pick up, and check the ledger afterwards.

---

## Users

```
GET /internal/users?…
GET /internal/users/options
GET /internal/users/{user_id}
```

Read-only. `options` lists the sort orders and the filterable fields — read it rather than
hard-coding.

The list takes RSQL (`filter`, `sort`, `page`, `pageSize`) and answers the same
`{ items, pagination }` envelope the other lists do. The operators and the sort syntax are in
[the seller guide](seller.md#the-list) — the language is the same on every list in this API.
Descending is a `-` prefix (`sort=-created_at`); `sort=created_at,desc` reads `desc` as a second
field and is refused.

---

## Reading a failure

| Status | `code` | Means |
|---|---|---|
| 400 | `bad_request` | Your payload. `errors` names the field — including the missing `message`. |
| 401 | `unauthorized` | Not signed in. |
| 403 | `forbidden` | Signed in, but not an administrator. |
| 404 | `not_found` | No such record. |
| 409 | `seller.transition_not_allowed` | Not in the table above. Refresh — somebody else acted. |
| 409 | `seller.review_not_open` | A seller in this status cannot be submitted for review. |
| 422 | `acquiring.shop_registration_failed` | The bank refused. Its message is in `detail`. |
| 500 | `internal_error` | Ours. Report the time and the path. |

Two administrators working the same queue will hit `seller.transition_not_allowed` regularly: the
other one decided first. Treat it as "reload the row", never as "retry the action".
