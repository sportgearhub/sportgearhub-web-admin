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

It also takes `filter` and `sort` (RSQL), and **until 2026-10-04 it did not** — both were documented
in the spec and silently dropped, so a console that sent them saw unchanged results. Filterable:
`product_id`, `seller_id`, `title`, `status`, `quantity`, `group_name`, `category_id`, `created_at`,
`updated_at`. `seller_id` is here and not on the seller's own list, because you are the one looking
across sellers. The same fix landed on `/internal/sellers/review-queue`.

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

## Bookings

```
GET /internal/bookings?filter=…&sort=…&page=1&pageSize=20
GET /internal/bookings/{booking_id}
```

**Neither existed until 2026-10-04.** You could read a booking's payment, its refund case and its
ledger entries — and only if you already knew the booking id. There was no way to list bookings or
find one, though both the customer and the seller have had their own lists all along. Repairing three
stuck bookings in production had to be done in `psql`.

The list answers `{ items, pagination }`, newest first, and each row carries what you need to pick
the right booking without opening it: the customer, **the seller**, the product, the money, and the
current `payment_status` and `settlement_status`.

| Filterable | |
|---|---|
| `booking_id`, `booking_number` | identity |
| `status` | the booking's own status |
| `user_id`, `product_id` | who and what |
| `start_at`, `end_at`, `quantity` | the rental |
| `total_price`, `total_charge_amount` | money |
| `cancelled_at`, `created_at`, `updated_at` | time |

`seller_id` is **not** a filter — it is a separate query parameter, applied before the filter:

```
GET /internal/bookings?seller_id=29ae2a65-…&filter=status==confirmed
```

The reason is structural, not cautious: a booking does not carry a seller, it points at a card. Scoping
by seller is an `EXISTS` over cards, which is a different thing from a condition on the booking's own
columns, and mixing the two into one `filter` would promise an ordering the index cannot give.

`GET /internal/bookings/{booking_id}` returns one booking whole — customer, seller, product, the full
money breakdown, and the payment, settlement and fulfilment state together rather than behind three
more requests. The question you arrive with is "which step did this stall on", and that answer is
assembled from all three.

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
GET /internal/settlements?filter=…&sort=…&seller_id=…
GET /internal/settlements/{settlement_plan_id}
```

Read-only. The ledger is the audit trail — every movement with its cause. Use it to answer "where did
this money go", not to compute balances yourself.

**The settlements list is new as of 2026-10-04.** Before it, a plan could only be opened by id — so
the platform's money was readable one row at a time and not enumerable at all.

Filterable: `settlement_plan_id`, `booking_id`, `payment_intent_id`, `seller_id`, `deal_id`,
`outcome_type`, `status`, `gross_collected_amount`, `seller_payout_amount`,
`platform_commission_amount`, `payout_execution_id`, `created_at`, `updated_at`, `executed_at`.

The amounts are filterable on purpose — "which settlements owe a seller more than ten thousand" is an
ordinary question and should not be answered by paging:

```
GET /internal/settlements?filter=status==planned;seller_payout_amount=gt=10000&sort=-created_at
```

Each row carries the recipient snapshot (bank account **masked**) and the payout execution inline when
one exists, so the list answers "was this paid" without a second request per row.

> `outcome_type` is written once, when the plan is created, and describes the booking as it was at
> that moment. A plan made while a booking was still `confirmed` reads
> `operator_accepted_pending_fulfillment` forever, even after the rental completes. It is history, not
> current state, and it does not affect the payout: the amount branches only on `cancelled`.

---

## Payout executions

```
GET /internal/payouts?filter=…&sort=…&seller_id=…
GET /internal/payouts/{payout_execution_id}
```

**`payout_executions` had no read endpoint at all until 2026-10-04.** `POST
/internal/bookings/{booking_id}/payout` created one and nothing could read one back — so the table
holding the actual movement of money was entirely invisible from outside, and "did this seller get
paid" was not an answerable question.

The question this list exists for is *what did not go out*:

```
GET /internal/payouts?filter=status==failed&sort=-created_at
```

Filterable: `payout_execution_id`, `settlement_plan_id`, `deal_id`, `status`, `amount`,
`external_payout_ref`, `created_at`, `updated_at`, `submitted_at`, `paid_at`, `failed_at`.

Each row nests the payout itself and adds **the seller and the booking number** beside it. A payout
carries neither — it points at a settlement plan — and without them a row is not something you can
act on.

`seller_id` is a query parameter rather than a filter field, for the same structural reason as on
bookings: scoping by seller is an `EXISTS` over settlement plans, not a condition on a payout column.

---

## Fiscal receipts (54-FZ, ATOL)

There is **no endpoint for these yet** — this section exists so you know the table is there and what
it means when a receipt is stuck.

A `payments.fiscal_receipts` row is written in the same transaction as the payment transition that
caused it: `captured` → a «Приход» receipt, `refunded` / `partially_refunded` → «Возврат прихода». A
worker then registers it with ATOL and polls for the fiscal result.

| `status` | Means |
|---|---|
| `Pending` | Queued, not sent. Normal for seconds — **or forever, if ATOL credentials are unset** |
| `Registered` | ATOL accepted it, `uuid` assigned, fiscal result not back yet |
| `Done` | Fiscalized: `fiscal_document_number`, `fiscal_sign` and `ofd_receipt_url` are filled |
| `Failed` | Rejected, or retries exhausted — **needs a human** |

`Failed` is the one that matters. The reason is in `error` verbatim from ATOL, and the row is not
retried again. Two causes worth recognising:

- **`validation.failed` about the ИНН** — the supplier attributes came from a seller's legal data and
  ATOL rejected them. The receipt cannot be fixed by retrying; the seller's data has to be corrected
  and the receipt reissued.
- **A receipt that stayed `Pending` across a deploy** — fiscalization is simply not configured.
  Nothing is lost; it registers once credentials are set.

> **Receipts are issued only when ATOL credentials are configured.** Until then every row sits at
> `Pending`. This is intentional: a receipt is a tax document. Nothing accumulates incorrectly — the
> queue drains in order once it is switched on.

A receipt is **tracking only**. The legal document lives at ATOL and the OFD; `ofd_receipt_url` is
the customer-facing copy. Do not treat this table as the record of what was fiscalized — treat it as
the record of whether we managed to.

---

## Payout destinations and bank binding

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
