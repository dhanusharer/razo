# Gate B3 Results — Resilient Transaction Recovery Integration

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Checkpoint**: Gate B3 — End-to-End Resilient Commerce Recovery Loop  
**Date**: 2026-08-30  
**Status**: ✅ PASS (GREEN)

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │              User Intent               │
                      │         Original Product (OOS)         │
                      │      Hard Mandate + Soft Prefs         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │             Recovery Relay             │
                      │       (src/recovery/recoveryRelay.ts)  │
                      │  - Detects runtime checkout failure    │
                      │  - Orchestrates candidate retrieval    │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         AI Semantic Evaluator          │
                      │       (src/agent/llmEvaluator.ts)      │
                      │  - Live Gemini / Mock Trade-off Engine │
                      │  - PROPOSAL ONLY:                      │
                      │    { selected_product_id, reason, conf }│
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          Policy Gate 1 (Static)        │
                      │       (src/policy/policyEngine.ts)     │
                      │  - Budget, price delta, brand, size    │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │      Live Revalidation Gate 2 (Dynamic)│
                      │  - Real-time inventory & price check   │
                      │  - Prevents race conditions / stale OOS│
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │            Razorpay Adapter            │
                      │  - Creates NEW Razorpay Test Order     │
                      │  - Supersedes old transaction attempt  │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │           Standard Checkout UI         │
                      │  - Razorpay Checkout modal             │
                      │  - Callback signature verified         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │            Webhook Handler             │
                      │  - payment.captured raw-body HMAC check│
                      │  - Authoritative PAID transition       │
                      │  - Audit log recorded                  │
                      └────────────────────────────────────────┘
```

---

## 2. Recovery State Machine & Transitions

```
[ Initial Attempt ]
CHECKOUT_STARTED
      ↓
FAILURE_DETECTED (OUT_OF_STOCK)
      ↓
RECOVERY_EVALUATING
      ↓
CANDIDATE_SELECTED (by AI Evaluator)
      ↓
POLICY_VALIDATED (Policy Gate 1) ──(if rejected)──> POLICY_REJECTED
      ↓
REVALIDATING (Policy Gate 2)     ──(if stale OOS)─> REVALIDATION_FAILED
      ↓
RECOVERY_APPROVED
      ↓
[ Original Attempt Superseded ]
SUPERSEDED_UNPAID

      ║
      ║ (Linked via supersedes_transaction_id)
      ▼

[ New Recovered Attempt ]
NEW_ORDER_CREATED
      ↓
PAYMENT_CALLBACK_VERIFIED (provisional)
      ↓
PAYMENT_CAPTURE_PENDING
      ↓
PAID (Authoritative — set ONLY via verified payment.captured webhook)
```

---

## 3. Financial Lifecycle Evidence Matrix (Live vs Unit Test)

| Lifecycle Stage | Verification Level | Evidence Details | Status |
|-----------------|-------------------|------------------|--------|
| **Failure Detection** | **LIVE VERIFIED** | `ADIDAS-RUN-01` OOS detected; `FAILURE_DETECTED` logged | ✅ PASS |
| **Candidate Retrieval** | **LIVE VERIFIED** | 5 candidates retrieved from authoritative catalog | ✅ PASS |
| **AI Trade-off Evaluation** | **LIVE VERIFIED** | `ADIDAS-RUN-02` recommended with factual reason & 0.83 confidence | ✅ PASS |
| **Policy Gate 1** | **LIVE VERIFIED** | Mandate validated against authoritative catalog | ✅ PASS |
| **Live Revalidation Gate 2** | **LIVE VERIFIED** | Real-time inventory check confirmed 4 units in stock | ✅ PASS |
| **NEW Razorpay Order Creation** | **LIVE VERIFIED** | Created `order_TW2JEVb89lci4Y` (₹5,200 / 520000 paise) via Razorpay API | ✅ PASS |
| **Original Order Superseding** | **LIVE VERIFIED** | Original attempt marked `SUPERSEDED_UNPAID`; linked to new txn | ✅ PASS |
| **Checkout UI Launch** | **UNIT TEST VERIFIED** | Standard checkout integration tested in automated suite | ✅ PASS |
| **Callback Signature Check** | **LIVE (Gate A) / UNIT (B3)** | Timing-safe HMAC verified; preserves terminal states | ✅ PASS |
| **Webhook `payment.captured`** | **LIVE (Gate A) / UNIT (B3)** | Webhook processed with timing-safe HMAC check | ✅ PASS |
| **`x-razorpay-event-id` Idempotency** | **LIVE (Gate A) / UNIT (B3)** | Verified duplicate rejection with zero side effects | ✅ PASS |
| **Authoritative `PAID` State** | **LIVE (Gate A) / UNIT (B3)** | Transitions to `PAID` exclusively upon verified webhook | ✅ PASS |

---

## 4. Live Evidence Log

### A. Live Recovery Execution
- **User Intent**: `"I need size 10 Adidas running shoes for training"`
- **Original Product**: `ADIDAS-RUN-01` (Adidas Boston 12, ₹4,900) $\rightarrow$ Injected `OUT_OF_STOCK`
- **Evaluator Recommendation**: `ADIDAS-RUN-02` (Adidas Adizero SL2, ₹5,200, +6.12% delta)
- **Policy Gate 1**: `PASS` (Budget ₹5,500, brand Adidas, size 10, category running_shoes)
- **Live Revalidation**: `PASS` (In-stock count = 4)
- **New Razorpay Order Created**: `order_TW2JEVb89lci4Y` (Amount: 520000 paise / ₹5,200.00 INR)
- **Original Transaction State**: `SUPERSEDED_UNPAID` (`txn_1788104929884_78o68z`)
- **Recovered Transaction State**: `NEW_ORDER_CREATED` (`txn_1788104930162_cow2f0`)

### B. Live Audit Trail Extract
```json
[
  { "event_type": "CHECKOUT_STARTED", "internal_transaction_id": "txn_1788104929884_78o68z" },
  { "event_type": "FAILURE_DETECTED", "details": { "reason": "OUT_OF_STOCK", "product_id": "ADIDAS-RUN-01" } },
  { "event_type": "RECOVERY_EVALUATING", "details": { "original_product_id": "ADIDAS-RUN-01" } },
  { "event_type": "CANDIDATE_SELECTED", "details": { "selected_product_id": "ADIDAS-RUN-02", "confidence": 0.83 } },
  { "event_type": "POLICY_VALIDATED", "details": { "selected_product_id": "ADIDAS-RUN-02" } },
  { "event_type": "REVALIDATING", "details": { "selected_product_id": "ADIDAS-RUN-02" } },
  { "event_type": "RECOVERY_APPROVED", "details": { "authoritative_price_paise": 520000 } },
  { "event_type": "ORDER_SUPERSEDED", "internal_transaction_id": "txn_1788104929884_78o68z", "details": { "recovered_by_transaction_id": "txn_1788104930162_cow2f0" } },
  { "event_type": "NEW_ORDER_CREATED", "internal_transaction_id": "txn_1788104930162_cow2f0", "razorpay_order_id": "order_TW2JEVb89lci4Y" }
]
```

---

## 5. Automated Test Matrix

```text
✓ tests/gate-a.test.ts (21 tests)
✓ tests/gate-b1.test.ts (12 tests)
✓ tests/gate-b2.test.ts (24 tests)
✓ tests/gate-b3.test.ts (10 tests)

Test Files: 4 passed (4)
Tests:      67 passed (67)
```

| Test ID | Description | Result |
|---------|-------------|--------|
| **B3-1** | Normal checkout remains successful when in stock | ✅ PASS |
| **B3-2** | OOS $\rightarrow$ valid substitute (`ADIDAS-RUN-02`) $\rightarrow$ policy pass $\rightarrow$ recovery decision | ✅ PASS |
| **B3-3** | OOS $\rightarrow$ price tolerance violation $\rightarrow$ policy rejection (zero orders created) | ✅ PASS |
| **B3-4** | OOS $\rightarrow$ brand violation $\rightarrow$ policy rejection (zero orders created) | ✅ PASS |
| **B3-5** | OOS $\rightarrow$ size/attribute violation $\rightarrow$ policy rejection (zero orders created) | ✅ PASS |
| **B3-6** | Valid candidate becomes OOS during revalidation $\rightarrow$ rejection (zero orders created) | ✅ PASS |
| **B3-7** | Invalid candidate never causes Razorpay Order creation | ✅ PASS |
| **B3-8** | Valid recovery creates a NEW Order and supersedes initial attempt | ✅ PASS |
| **B3-9** | Recovered payment reaches `PAID` exclusively through verified `payment.captured` webhook | ✅ PASS |
| **B3-10** | Webhook idempotency remains intact on recovered transactions | ✅ PASS |

---

## 6. Gate B3 Decision

**FINAL GATE B3 DECISION: FULL GO (GREEN)**

The complete recovery loop is verified. Failure detection, AI trade-off evaluation, dual policy gates, live revalidation, and replacement with a new Razorpay Test Mode Order are live-verified on the real API; checkout signature, webhook HMAC, and idempotency transitions to PAID are 100% verified across 67 automated tests and previous live gate runs.
