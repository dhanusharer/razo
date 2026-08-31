# Resilient-Agent-Relay — Gate A

## Razorpay AI Buildathon 2026 — Phase 0

> **Gate A objective**: Prove the Razorpay Test Mode payment foundation end-to-end before building the AI recovery layer.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env — add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

# 3. Run the server
npm run dev

# 4. Open the checkout test UI
# http://localhost:3000

# 5. Run all tests
npm test
```

## Architecture (Gate A)

```
POST /api/orders             → creates Razorpay Test Order + internal transaction record
Razorpay Standard Checkout   → browser-side payment
POST /api/orders/verify-callback → timing-safe HMAC checkout signature check (provisional, NOT PAID)
POST /api/webhooks/razorpay  → raw body HMAC + x-razorpay-event-id dedup + PAID state transition
GET  /api/orders/:id         → current transaction state
GET  /api/orders/:id/events  → event log for transaction
GET  /api/status             → credential & service health
GET  /api/events             → full event log
```

## State Machine

```
ORDER_CREATED → CHECKOUT_STARTED → PAYMENT_CALLBACK_VERIFIED → PAYMENT_CAPTURE_PENDING → PAID
```

PAID is set **only** by a raw-body HMAC-verified `payment.captured` webhook.

## Trust Rules

| Actor | Can do | Cannot do |
|-------|--------|-----------|
| Frontend / Checkout handler | Trigger provisional callback verification | Set PAID state |
| Webhook processor | Set PAID after verified payment.captured | Accept unverified webhooks |
| Razorpay Key Secret | Sign/verify callback (server-side only) | Be sent to browser |
| Webhook Secret | Verify raw webhook body (server-side only) | Be logged or returned |

## Webhook Setup (for live test)

1. Start ngrok: `ngrok http 3000`
2. Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
3. Razorpay Dashboard → Settings → Webhooks → Add Webhook
   - URL: `https://abc123.ngrok-free.app/api/webhooks/razorpay`
   - Events: `payment.captured`
   - Secret: same as `RAZORPAY_WEBHOOK_SECRET` in `.env`

## Test Cards (Razorpay Test Mode)

| Method | Details |
|--------|---------|
| Card | `4111 1111 1111 1111`, any future date, CVV `123` |
| UPI | `success@razorpay` |
| Net Banking | Any bank → Test Success |

## Repository Structure

```
src/
├── config.ts                   # Credential loader
├── types.ts                    # TypeScript types
├── state/transactionStore.ts   # In-memory state + event log
├── razorpay/
│   ├── razorpayAdapter.ts      # Order creation + callback sig verification
│   └── webhookVerifier.ts      # Raw body HMAC + idempotency + state transitions
├── routes/
│   ├── orders.ts               # POST /api/orders, POST /api/orders/verify-callback
│   └── webhooks.ts             # POST /api/webhooks/razorpay
├── server.ts                   # Express app
└── public/index.html           # Checkout test UI
tests/
└── gate-a.test.ts              # 17 automated tests (A1–A7)
docs/
└── gate-a-results.md           # Gate A results + GO/NO-GO
evidence/gate-a/
├── order-response.json
├── payment-callback-result.json
├── webhook-verification-result.json
├── duplicate-webhook-result.json
└── test-summary.txt
```

## Gate A Test Results

**17 / 17 tests passing** — run `npm test` to verify.

## Phase Scope

Gate A implements the Razorpay foundation only. The following are **deliberately out of scope** until Gates B and C:
- LLM evaluator
- Policy engine
- Recovery relay
- Catalog / inventory simulator
- Hash-chain audit ledger
- AI substitution logic
