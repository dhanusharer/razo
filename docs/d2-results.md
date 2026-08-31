# Phase D2 — Single-Page Merchant Demo Experience Report

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Stage**: Phase D2 — Merchant Demo Console, Visualizer & Safe Escalation  
**Date**: 2026-08-31  
**Status**: ✅ FULL PASS (GREEN)  
**Total Automated Tests**: 106 / 106 Tests Passing (100% Green)  

---

## 1. Executive Summary

Phase D2 delivers the **Single-Page Merchant Demo Experience** (`src/public/index.html`), presenting the end-to-end capabilities of the Resilient-Agent-Relay in an intuitive, high-visibility control console.

### Key Architectural Invariants:
- **Zero Client-Side Calculation**: Metrics, price deltas, gross margins, policy results, and recovery rates are **never calculated in the frontend**. The UI is a pure rendering layer over authoritative backend APIs.
- **Dual Flow Demonstration**: Supports both autonomous golden-path recovery (with verified Razorpay order creation) and **deterministic safe escalation** (constraint breach with zero orders created).
- **Explicit Provenance Badges**: Every view visibly displays its data source (`[LIVE]`, `[SYNTHETIC BENCHMARK]`, `[DEMO_FIXTURE]`).
- **Zero Secret Leakage**: No private keys, webhook secrets, or model chain-of-thought traces are exposed to the client.

---

## 2. Single-Page UI Structure

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Resilient-Agent-Relay — Merchant Control Plane & Recovery Console       │
│  [PROVENANCE: LIVE]  [TEST MODE]  [GEMINI 2.5 FLASH]                     │
├──────────────────────────────────────────────────────────────────────────┤
│ 📊 View 1 — Merchant Business Overview [SYNTHETIC BENCHMARK]             │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ │
│ │ Recovered GMV │ │ Recovery Rate │ │ Gross Margin  │ │ Unauthorized   │ │
│ │ ₹1,045,200    │ │ 59.64%        │ │ ₹261,300      │ │ 0 (0.00%)      │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ ⚡ View 2 — Live Recovery Console [READY]                                │
│ [🚀 Run Live Golden Recovery] [🛡️ Test Safe Escalation] [🔄 Load Fixture]│
│                                                                          │
│ ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐    │
│ │Intent │ → │Product│ → │ OOS   │ → │Gemini │ → │Policy │ → │Order  │    │
│ └───────┘   └───────┘   └───────┘   └───────┘   └───────┘   └───────┘    │
├──────────────────────────────────────────────────────────────────────────┤
│ 🔍 View 3 — Recovery Details & Audit Ledger                              │
│ ┌──────────────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Authoritative Decision Ledger        │ │ Chronological Event Stream  │ │
│ │ • Original: Adidas Boston 12 (₹4,900)│ │ [21:20:00] CHECKOUT_STARTED │ │
│ │ • Substitute: Adizero SL2 (₹5,200)   │ │ [21:20:01] FAILURE_DETECTED │ │
│ │ • Delta: +₹300 (+6.12%)              │ │ [21:20:02] CANDIDATE_SEL    │ │
│ │ • Policy: PASS (User ∩ Merchant)     │ │ [21:20:02] POLICY_PASSED    │ │
│ │ • Order ID: order_TW2gAizOpB5o32     │ │ [21:20:03] REVAL_PASSED     │ │
│ │ • Final State: PAID                  │ │ [21:20:04] RECOVERY_SUCC    │ │
│ └──────────────────────────────────────┘ └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Interactive User Flows

### Flow A: Autonomous Golden Recovery
1. User clicks **"🚀 Run Live Golden Recovery"**.
2. Frontend calls `POST /api/recovery/evaluate`.
3. System injects `OUT_OF_STOCK` on `ADIDAS-RUN-01`.
4. Gemini 2.5 Flash evaluates catalog and recommends `ADIDAS-RUN-02` (₹5,200, +6.12% delta).
5. Deterministic Policy Gate 1 evaluates effective rules: **PASS**.
6. Live Revalidation Gate 2 verifies real-time stock and price: **PASS**.
7. New Razorpay Test Mode Order is created (`order_...`).
8. Pipeline lights up green; ledger and chronological audit stream are updated.

### Flow B: Safe Escalation (Constraint Breach)
1. User clicks **"🛡️ Test Safe Escalation (Constraint Breach)"**.
2. Frontend submits a mandate with a strict 1% price tolerance cap (`max_price_delta_percent: 1`).
3. AI selects `ADIDAS-RUN-02` (+6.12% price increase).
4. Policy Gate 1 blocks the substitution:
   `Price delta +6.12% (₹300) exceeds allowed effective maximum +1.00%.`
5. System immediately halts automated execution:
   - **Zero Razorpay Orders Created** (`razorpay_order = undefined`).
   - Transition to `ESCALATION_REQUIRED`.
   - Pipeline displays amber `POLICY BLOCKED` and `NO RAZORPAY ORDER`.

---

## 4. API Endpoints Consumed by Frontend

| View / Action | Endpoint | Purpose | Provenance |
|:---|:---|:---|:---|
| **View 1** | `GET /api/metrics` | Fetches real-time GMV, recovery rate, latency, and failure breakdown. | `[SYNTHETIC BENCHMARK]` / `[LIVE]` |
| **View 2 (Fixture)**| `GET /api/recovery/demo-fixture` | Populates default golden-path state. | `[DEMO_FIXTURE]` |
| **View 2 (Execute)**| `POST /api/recovery/evaluate` | Executes full autonomous recovery relay. | `[LIVE]` |
| **View 3 (Detail)** | `GET /api/recovery/:transactionId` | Fetches authoritative transaction and policy metadata. | `[LIVE]` / `[MOCK]` |
| **View 3 (Audit)**  | `GET /api/recovery/:transactionId/events`| Fetches chronological event log. | `[LIVE]` |
| **Policy Details**  | `GET /api/policy` | Fetches active merchant policy and effective constraints. | `[LIVE]` |

---

## 5. Security & Containment Assurances

1. **Zero Secret Leakage**:
   - Automated tests (`D2-6`) assert that no private credentials (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`) exist in static HTML or API payloads.
2. **Deterministic Triage**:
   - Under no circumstances does the frontend possess authority to bypass policy or initiate orders.

---

## 6. Automated Test Suite Matrix

```text
✓ tests/gate-a.test.ts (21 tests)
✓ tests/gate-b1.test.ts (12 tests)
✓ tests/gate-b2.test.ts (24 tests)
✓ tests/gate-b3.test.ts (10 tests)
✓ tests/c2-timeout-safety.test.ts (2 tests)
✓ tests/c3-merchant-policy.test.ts (12 tests)
✓ tests/c3.5-metrics.test.ts (11 tests)
✓ tests/d1-demo-api.test.ts (8 tests)
✓ tests/d2-demo-ui.test.ts (6 tests)

Test Files: 9 passed (9)
Tests:      106 passed (106)
Execution:  1.98 seconds
```

---

## 7. Conclusion & Verdict

**PHASE D2 STATUS: COMPLETE (GREEN)**

The single-page merchant demo experience provides an intuitive, visually clear presentation of the Resilient-Agent-Relay. It clearly demonstrates autonomous AI reasoning, strict deterministic policy containment, safe escalation triage, and full Razorpay checkout integration with 106/106 automated tests passing.
