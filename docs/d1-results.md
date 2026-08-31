# Phase D1 — Demo API & Read-Only Product Surface Report

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Stage**: Phase D1 — Read-Only API Surface, Safe Telemetry & Demo Fixtures  
**Date**: 2026-08-31  
**Status**: ✅ FULL PASS (GREEN)  
**Total Automated Tests**: 100 / 100 Tests Passing (100% Green)  

---

## 1. Executive Summary

Phase D1 establishes a clean, read-only API surface preparing the application for the merchant demo and evaluation without modifying the core payment, AI, or policy engines.

### Key Architectural Guarantees:
- **Authoritative Business Truth**: The frontend never computes GMV, recovery rates, price deltas, margins, or policy decisions. All values are calculated server-side from authoritative ledgers.
- **Zero Secret Leakage**: API responses never expose API secrets, webhook secrets, Gemini API keys, or raw tokens.
- **Explicit Provenance**: Every response declares its data origin (`LIVE`, `SYNTHETIC`, `MOCK`, `DEMO_FIXTURE`, or `MIXED`).
- **Deterministic Golden-Path Fixture**: Provides a stable, auditable demonstration record (`/api/recovery/demo-fixture`).

---

## 2. API Endpoints & Response Schemas

### A. Recovery Transaction Detail: `GET /api/recovery/:transactionId`
Provides full lifecycle details for a recovery transaction:
```json
{
  "provenance": "LIVE",
  "transaction_id": "txn_rec_1788191532812",
  "original_transaction_id": "txn_orig_1788191532812",
  "original_product": {
    "id": "ADIDAS-RUN-01",
    "name": "Adidas Boston 12",
    "brand": "Adidas",
    "category": "running_shoes",
    "price_inr": 4900
  },
  "failure_type": "OUT_OF_STOCK",
  "selected_substitute": {
    "id": "ADIDAS-RUN-02",
    "name": "Adidas Adizero SL2",
    "brand": "Adidas",
    "category": "running_shoes",
    "price_inr": 5200
  },
  "original_price_inr": 4900,
  "recovered_price_inr": 5200,
  "price_delta_inr": 300,
  "price_delta_percent": 6.12,
  "llm_provider": "Google Gemini 2.5 Flash",
  "llm_recommendation_explanation": "Selected Adidas Adizero SL2 because it satisfies user running preferences within 10% price tolerance.",
  "policy_result": "PASS",
  "revalidation_result": "PASS",
  "recovery_outcome": "VALID_SUBSTITUTE",
  "new_razorpay_order_id": "order_TW2gAizOpB5o32",
  "payment_id": "pay_demo_captured_001",
  "final_state": "NEW_ORDER_CREATED",
  "policy_id": "pol_default_merchant_v1",
  "policy_version": 1
}
```

### B. Recovery Chronological Audit Stream: `GET /api/recovery/:transactionId/events`
Returns ordered state transitions and decision facts:
```json
{
  "provenance": "LIVE",
  "transaction_id": "txn_rec_1788191532812",
  "total_events": 6,
  "events": [
    { "event_id": "evt_0001", "event_type": "CHECKOUT_STARTED", "result": "SUCCESS" },
    { "event_id": "evt_0002", "event_type": "FAILURE_DETECTED", "result": "FAILURE", "details": { "reason": "OUT_OF_STOCK" } },
    { "event_id": "evt_0003", "event_type": "CANDIDATE_SELECTED", "result": "SUCCESS", "details": { "selected_product_id": "ADIDAS-RUN-02" } },
    { "event_id": "evt_0004", "event_type": "POLICY_PASSED", "result": "SUCCESS" },
    { "event_id": "evt_0005", "event_type": "REVALIDATION_PASSED", "result": "SUCCESS" },
    { "event_id": "evt_0006", "event_type": "RECOVERY_SUCCEEDED", "result": "SUCCESS" }
  ]
}
```

### C. Active Policy & Effective Constraints: `GET /api/policy`
```json
{
  "provenance": "LIVE",
  "active_policy": {
    "policy_id": "pol_default_merchant_v1",
    "policy_version": 1,
    "max_substitution_price_delta_percent": 10,
    "max_recovery_amount_inr": 5500,
    "allowed_brands": ["Adidas"],
    "allowed_categories": ["running_shoes"],
    "max_recovery_attempts": 2,
    "minimum_margin_percent": 10,
    "auto_recovery_enabled": true,
    "escalation_on_llm_timeout": true
  },
  "effective_rules": {
    "max_budget": 5500,
    "max_price_delta_percent": 10,
    "allowed_brands": ["Adidas"],
    "allowed_categories": ["running_shoes"],
    "minimum_margin_percent": 10,
    "max_recovery_attempts": 2,
    "auto_recovery_enabled": true,
    "escalation_on_llm_timeout": true
  }
}
```

### D. Safe Product Catalog: `GET /api/catalog`
```json
{
  "provenance": "LIVE",
  "total_products": 6,
  "products": [
    {
      "id": "ADIDAS-RUN-01",
      "name": "Adidas Boston 12",
      "brand": "Adidas",
      "category": "running_shoes",
      "price_inr": 4900,
      "cost_inr": 3675,
      "margin_inr": 1225,
      "margin_percent": 25.0,
      "currency": "INR",
      "attributes": { "size": 10, "margin_percent": 25 }
    }
  ]
}
```

### E. Authoritative Merchant Metrics: `GET /api/metrics`
Exposes the real-time `MetricsService` report (GMV, recovery rate, latency percentiles, and failure breakdown).

### F. Golden-Path Demo Fixture: `GET /api/recovery/demo-fixture`
Provides the verified golden-path baseline (`ADIDAS-RUN-01` $\rightarrow$ `ADIDAS-RUN-02` with 6.12% delta).

---

## 3. Security Boundaries & Invariants

1. **Zero Secret Leakage**:
   - Automated tests (`D1-8`) verify across all endpoints that `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `GEMINI_API_KEY` are never serialized into response payloads.
2. **Private Chain-of-Thought Protection**:
   - Audit event details log only structured recommendation facts (`selected_product_id`, `reason`, `confidence`). Unfiltered internal prompts or reasoning traces are never persisted or exposed.
3. **Read-Only Surface**:
   - GET endpoints contain no state mutations.

---

## 4. Automated Test Suite Matrix

```text
✓ tests/gate-a.test.ts (21 tests)
✓ tests/gate-b1.test.ts (12 tests)
✓ tests/gate-b2.test.ts (24 tests)
✓ tests/gate-b3.test.ts (10 tests)
✓ tests/c2-timeout-safety.test.ts (2 tests)
✓ tests/c3-merchant-policy.test.ts (12 tests)
✓ tests/c3.5-metrics.test.ts (11 tests)
✓ tests/d1-demo-api.test.ts (8 tests)

Test Files: 8 passed (8)
Tests:      100 passed (100)
Execution:  1.89 seconds
```

---

## 5. Conclusion & Verdict

**PHASE D1 STATUS: COMPLETE (GREEN)**

The Demo API and Read-Only Product Surface is fully verified with 100/100 automated tests green and zero secret leakage. The backend provides complete, auditable business data for presentation and merchant evaluation.
