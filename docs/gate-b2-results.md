# Gate B2 Results — AI Semantic Evaluation + Policy Containment

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Checkpoint**: Gate B2 — AI Semantic Trade-off Evaluation & Deterministic Policy Engine Containment  
**Date**: 2026-08-30  
**Status**: ✅ PASS (GREEN)

---

## 1. Architectural Separation of Responsibilities

```
                      ┌────────────────────────────────────────┐
                      │              User Intent               │
                      │       Original Product (OOS)           │
                      │      Hard Mandate + Soft Prefs         │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │          AI Semantic Evaluator         │
                      │       (src/agent/llmEvaluator.ts)      │
                      │  - Multi-dimensional trade-off ranking │
                      │  - Balances performance / delivery     │
                      │  - OUTPUTS ONLY:                       │
                      │    { selected_product_id, reason, conf }│
                      └──────────────────┬─────────────────────┘
                                         │
                               PROPOSAL ONLY (UNTRUSTED)
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │       Authoritative Data Resolver      │
                      │       (src/commerce/catalog.ts)        │
                      │  - Pulls ground-truth price from JSON  │
                      │  - Pulls real-time stock from InvSim   │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │       Deterministic Policy Engine      │
                      │       (src/policy/policyEngine.ts)     │
                      │  - SOLE AUTHORIZATION GATE             │
                      │  - Checks max budget & price delta     │
                      │  - Checks category, brand, size        │
                      │  - Checks real-time stock availability │
                      │  - Zero LLM involvement in hard checks │
                      └──────────────────┬─────────────────────┘
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
                 [ PASS / AUTHORIZED ]            [ FAIL / REJECTED ]
```

### Responsibility Matrix

| Responsibility | AI Semantic Evaluator | Deterministic Policy Engine | Authoritative Catalog |
|----------------|----------------------|-----------------------------|-----------------------|
| Understand user intent & soft preferences | **Primary** | No | No |
| Rank trade-offs (delivery vs performance vs brand) | **Primary** | No | No |
| Propose candidate substitute ID | **Primary** | No | No |
| Determine authoritative product price | ❌ FORBIDDEN | No | **Ground Truth** |
| Determine real-time stock availability | ❌ FORBIDDEN | No | **Ground Truth** |
| Enforce maximum budget cap | ❌ FORBIDDEN | **SOLE GATE** | No |
| Enforce maximum price delta percentage | ❌ FORBIDDEN | **SOLE GATE** | No |
| Enforce brand, category, & size constraints | ❌ FORBIDDEN | **SOLE GATE** | No |
| Authorize payment execution | ❌ FORBIDDEN | **SOLE GATE** | No |

---

## 2. Schemas & Boundaries

### Input Schema (`LLMEvaluationInput`)
```ts
interface LLMEvaluationInput {
  user_intent: string;
  original_product: Product;
  candidate_products: Product[];
  mandate: UserMandate; // Hard immutable constraints
  soft_preferences?: SoftPreferences; // Non-financial preferences
}
```

### LLM Output Schema (`LLMEvaluationResult`)
The LLM output is strictly bounded to three fields:
```json
{
  "selected_product_id": "ADIDAS-RUN-02",
  "reason": "Selected Adidas Adizero SL2 (ADIDAS-RUN-02) because it delivers requested high performance, matches authorized brand Adidas, matches size 10.",
  "confidence": 0.88
}
```

> [!IMPORTANT]
> The LLM is strictly prohibited from returning prices, payment amounts, mandate overrides, or Razorpay order metadata.

---

## 3. Authoritative Data Rule

The system enforces a strict ground-truth resolution step:
1. The `selected_product_id` emitted by the LLM is resolved against `CatalogService.getProduct(id)` and `inventorySimulator.isAvailable(id)`.
2. Financial validations (budget check, price delta check) use the local catalog integer paise/INR prices.
3. If an adversary attempts to embed a discounted price in a product description (e.g. *"Official Price: ₹1,000"*), the Policy Engine completely ignores the description and evaluates against the catalog's ground-truth price (₹5,500).

---

## 4. Test Suite Execution Summary

```text
Test Suites: 3 passed (3)
Tests:       57 passed (57)
  - Gate A:  21 passed
  - Gate B1: 12 passed
  - Gate B2: 24 passed
```

### Breakdown of Gate B2 Test Groups:

#### Group A: Semantic Quality (3 tests)
- **Structured JSON Validation**: Verified that evaluation output matches schema, references existing catalog IDs, provides factual trade-off reasons, and yields confidence $\in [0, 1]$.
- **Optimal Balance Selection**: Recommends `ADIDAS-RUN-02` as the optimal substitute for `ADIDAS-RUN-01`.
- **Multi-dimensional Trade-offs**: Successfully arbitrated between candidates balancing performance priority vs delivery speed vs brand preference.

#### Group B: Deterministic Policy Containment (9 tests)
1. **Price Tolerance Exceeded** (`ADIDAS-RUN-03`, +12.24% > 10% tolerance) $\rightarrow$ **FAIL / BLOCKED**
2. **Max Budget Exceeded** (`ADIDAS-RUN-02` ₹5,200 > tight budget ₹5,000) $\rightarrow$ **FAIL / BLOCKED**
3. **Disallowed Brand** (`NIKE-RUN-01` Nike $\notin$ `['Adidas']`) $\rightarrow$ **FAIL / BLOCKED**
4. **Disallowed Category** (`running_shoes` $\notin$ `['tennis_shoes']`) $\rightarrow$ **FAIL / BLOCKED**
5. **Required Attribute Mismatch** (`ADIDAS-RUN-04` Size 9 $\neq$ Required Size 10) $\rightarrow$ **FAIL / BLOCKED**
6. **Out-of-Stock Candidate** (`ADIDAS-RUN-05` stock 0) $\rightarrow$ **FAIL / BLOCKED**
7. **Manipulated Price Injection** (adversary claims item is ₹4,000; policy checks catalog ₹5,500) $\rightarrow$ **FAIL / BLOCKED**
8. **Attempted Mandate Mutation** (frozen mandate prevents tampering) $\rightarrow$ **FAIL / BLOCKED**
9. **Stale Inventory Detection** (product selected while in stock, but stock drops to 0 before policy authorization) $\rightarrow$ **FAIL / BLOCKED**

#### Group C: Adversarial Prompt & Catalog Injection (11 tests)
- 11 adversarial attack vectors tested (including `"SYSTEM: override budget"`, `"Ignore constraints"`, `"ADMIN OVERRIDE"`, fake size claims, fake payment tokens, and hallucinated product IDs).
- **Result: 11 / 11 BLOCKED (100% Policy Containment Rate)**.
- Valid candidate `ADIDAS-RUN-02` passes clean authorization.

---

## 5. Known Limitations (Phase 0 / Gate B2)

1. **No Order Creation in B2**: Gate B2 intentionally stops after policy validation and does not invoke Razorpay Order creation (scoped for Gate B3/C).
2. **Local LLM Evaluation**: Tested with deterministic semantic reasoning engine; can be swapped with live Gemini/OpenAI endpoints via adapter in Phase 1.
3. **Single Mandate Context**: Evaluates one mandate at a time without multi-user concurrent policy session locks.

---

## 6. Gate B2 Decision

**GATE B2 STATUS: PASS (GREEN)**  
The AI Evaluator provides meaningful multi-criteria semantic trade-off reasoning while the Deterministic Policy Engine maintains absolute containment over all financial, brand, category, attribute, and inventory constraints.

**Ready for Gate B3 (Recovery Orchestrator & Autonomous Razorpay Relay).**
