# Gate A Results — Razorpay Payment Foundation

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Gate**: A — Razorpay Foundation (no AI, no recovery)  
**Date**: 2026-08-30  
**Status**: ✅ FULL PASS — GATE A COMPLETE (GREEN)

---

## 1. Environment & Setup

| Component | Detail |
|-----------|--------|
| Runtime | Node.js v24.11.0 |
| Language | TypeScript (ESM, target ES2022) |
| Framework | Express v4.21 |
| Razorpay SDK | razorpay v2.9.5 |
| Test Runner | Vitest v3.2.7 |
| Ingress / Tunnel | ngrok (HTTPS to port 3000) |
| Canonical Webhook URL | `POST /api/webhooks/razorpay` |
| OS | Windows 11 |

---

## 2. Verification Classification (Evidence Breakdown)

| Capability / Criterion | Verification Level | Evidence Details | Status |
|------------------------|-------------------|------------------|--------|
| Test Mode Order Creation | **LIVE VERIFIED** | Created `order_TW1KsiKtgXEAuj` (₹4,900.00 INR) via Razorpay API | ✅ PASS |
| Public Key Delivery | **LIVE VERIFIED** | Public `key_id` returned to client; `key_secret` kept server-side | ✅ PASS |
| Standard Checkout Launch | **LIVE VERIFIED** | Modal loaded and completed in test netbanking mode | ✅ PASS |
| Checkout Callback Signature Verification | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Timing-safe HMAC verified for payment `pay_TW1KyfqCki6IOZ` | ✅ PASS |
| Raw Request Body Capture | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Unmodified `Buffer` captured via `express.raw()` before JSON parsing | ✅ PASS |
| Live Webhook Receipt & Parsing | **LIVE VERIFIED** | Received `payment.captured` from Razorpay (`TW1L2nOIBGsCMG`) | ✅ PASS |
| Webhook HMAC-SHA256 Verification | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Timing-safe comparison against `RAZORPAY_WEBHOOK_SECRET` | ✅ PASS |
| `x-razorpay-event-id` Idempotency | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Live replayed event returned `DUPLICATE_IGNORED` with zero side effects | ✅ PASS |
| Defensive Payment ID Deduplication | **UNIT TEST VERIFIED** | Tested via Vitest in `tests/gate-a.test.ts` | ✅ PASS |
| Single Authoritative `PAID` State Setter | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Transaction transitioned to `PAID` exclusively on verified webhook | ✅ PASS |
| Tampered / Invalid Signature Rejection | **UNIT TEST VERIFIED** | Tested invalid key secret, tampered payload, missing headers | ✅ PASS |
| Non-INR / Invalid Order Input Rejection | **UNIT TEST VERIFIED** | Negative, zero, float, non-INR currencies rejected with 400 | ✅ PASS |
| Webhook Route 404 on Typo Paths | **LIVE VERIFIED** & **UNIT TEST VERIFIED** | Non-canonical routes like `/api/webhooks/razopay` return 404 | ✅ PASS |
| Autonomous LLM Evaluator / Recovery Relay | **NOT TESTED** *(Deferred by design)* | Scoped for Gate B / Phase 1 | ⏸️ DEFERRED |

---

## 3. Live Evidence Log

### A. Live Transaction Record
```json
{
  "internal_transaction_id": "txn_1788101502138_qyilir",
  "razorpay_order_id": "order_TW1KsiKtgXEAuj",
  "razorpay_payment_id": "pay_TW1KyfqCki6IOZ",
  "amount_paise": 490000,
  "currency": "INR",
  "receipt": "gate_a_1788101501736_3SX90",
  "status": "PAID",
  "created_at": "2026-08-30T14:51:42.138Z",
  "updated_at": "2026-08-30T14:52:02.363Z"
}
```

### B. Live Webhook Delivery (`payment.captured`)
- **Event ID**: `TW1L2nOIBGsCMG`
- **Method / Path**: `POST /api/webhooks/razorpay`
- **Signature**: `ee76b0b196895abbfe6b3acca2b97487f9037da1e2762d951cefc82b7c74c758`
- **Response**: `200 OK`
- **Recorded Event**: `PAYMENT_CAPTURED` (result: `SUCCESS`)

### C. Live Idempotency Replay Test
- **Replayed Event ID**: `TW1L2nOIBGsCMG`
- **Replay Response Status**: `200 OK`
- **Replay Response Body**:
  ```json
  {
    "status": "DUPLICATE_IGNORED",
    "message": "Duplicate webhook event — already processed",
    "webhook_event_id": "TW1L2nOIBGsCMG"
  }
  ```
- **Recorded Event**: `DUPLICATE_EVENT_IGNORED` (result: `IGNORED`, zero business mutations).

---

## 4. Test Suite Execution

```text
✓ tests/gate-a.test.ts (21 tests)
Test Files: 1 passed (1)
Tests:      21 passed (21)
Duration:   1.18s
```

### Test Breakdown:
- **TEST A1**: Valid webhook signature accepted (1 test)
- **TEST A2**: Invalid webhook signature / tampered body / wrong secret / empty signature rejected (3 tests)
- **TEST A3**: Duplicate `x-razorpay-event-id` idempotency deduplication (1 test)
- **TEST A4**: Valid `payment.captured` transitions transaction to `PAID` (1 test)
- **TEST A5**: Invalid webhook leaves transaction state unmutated (1 test)
- **TEST A6**: Checkout callback signature verification & tamper rejection (3 tests)
- **TEST A7**: Order creation input validation for amounts and INR currency (7 tests)
- **TEST A8**: HTTP route verification for canonical path, 404 on typo routes, and terminal `PAID` state preservation (4 tests)

---

## 5. Remaining Limitations

1. **In-Memory Store (Phase 0 Spike)**: State records and webhook idempotency sets reside in-memory and reset on process termination.
2. **Single Instance**: No distributed locking or multi-pod synchronization (acceptable for Phase 0).
3. **HTTP Local Server**: Requires reverse proxy / tunnel (ngrok) for external webhook ingress.

---

## 6. Gate A Final Decision

**FINAL GATE A DECISION: FULL GO (GREEN)**

All foundational payment, HMAC signature verification, raw-body capture, timing-safe validation, idempotency, and authoritative `PAID` state transition requirements have been demonstrated with live test mode evidence and 100% passing automated test suite.

**Ready for Phase 1 / Gate B implementation.**
