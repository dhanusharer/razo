# Gate B1 Results — Local Commerce State & Candidate Retrieval

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Checkpoint**: Gate B1 — Commerce State, Inventory Simulator, User Mandate, Candidate Retrieval  
**Date**: 2026-08-30  
**Status**: ✅ PASS (GREEN)

---

## 1. Overview & Architecture

Gate B1 establishes the local, deterministic commerce foundation required for autonomous semantic recovery without yet invoking external LLMs or creating new payment orders.

```
┌─────────────────────────────────────────────────────────────┐
│                     Authoritative Catalog                   │
│                     (src/commerce/catalog.ts)               │
│               6 Curated Products (JSON Ground Truth)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     Inventory Simulator     │ │      User Mandate Model     │
│ (src/commerce/inventory.ts) │ │  (src/commerce/mandate.ts)  │
│  - Deterministic Stock      │ │  - Budget, Brands, Category │
│  - setStock / toggleOOS     │ │  - Price Delta %, Size 10   │
│  - In-memory State          │ │  - Deep Immutability        │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Candidate Retrieval Service                 │
│             (src/commerce/candidateRetrieval.ts)            │
│       Extracts Realistic Alternatives for Policy Eval        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Curated 6-Product Catalog

The catalog is defined in [src/commerce/catalog.json](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/src/commerce/catalog.json) and accessed via [src/commerce/catalog.ts](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/src/commerce/catalog.ts):

| ID | Product Name | Brand | Category | Price (INR) | Price (Paise) | Size | Initial Stock | Role / Expected Test Outcome |
|----|--------------|-------|----------|-------------|---------------|------|---------------|------------------------------|
| `ADIDAS-RUN-01` | Adidas Boston 12 | Adidas | running_shoes | ₹4,900 | 490000 | 10 | 5 | **Original Product** (Initially in-stock; target for OOS injection) |
| `ADIDAS-RUN-02` | Adidas Adizero SL2 | Adidas | running_shoes | ₹5,200 | 520000 | 10 | 4 | **Candidate 1**: Expected VALID match (+6.12% delta ≤ 10%, Size 10, Adidas) |
| `ADIDAS-RUN-03` | Adidas Prime X | Adidas | running_shoes | ₹5,500 | 550000 | 10 | 2 | **Candidate 2**: Expected PRICE REJECTION (+12.24% delta > 10% tolerance) |
| `NIKE-RUN-01` | Nike Pegasus 41 | Nike | running_shoes | ₹4,800 | 480000 | 10 | 3 | **Candidate 3**: Expected BRAND REJECTION (Nike not in allowed_brands) |
| `ADIDAS-RUN-04` | Adidas Boston 12 | Adidas | running_shoes | ₹4,700 | 470000 | 9 | 5 | **Candidate 4**: Expected ATTRIBUTE REJECTION (Size 9 vs required Size 10) |
| `ADIDAS-RUN-05` | Adidas Supernova | Adidas | running_shoes | ₹5,100 | 510000 | 10 | 0 | **Candidate 5**: Expected OUT OF STOCK (Stock 0) |

---

## 3. Inventory Simulator

Defined in [src/commerce/inventorySimulator.ts](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/src/commerce/inventorySimulator.ts):

- **Deterministic Stock Control**:
  - `setStock(productId, count)`: Sets exact integer stock count.
  - `toggleOOS(productId)`: Flips stock between 0 (OOS) and default stock level.
  - `getStock(productId)`: Returns current in-memory inventory count.
  - `isAvailable(productId, quantity)`: Checks if inventory meets requested quantity.
  - `reset()`: Restores catalog default stock levels.
- **Ground-Truth Price Guarantee**:
  - `CatalogService.getAuthoritativePrice(productId)` returns ground truth from catalog data only, ensuring prices are never hallucinated or overridden by external LLM evaluation.

---

## 4. UserMandate Model

Defined in [src/commerce/mandate.ts](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/src/commerce/mandate.ts):

- **Default Test Mandate**:
  ```ts
  export const DEFAULT_TEST_MANDATE: UserMandate = createUserMandate({
    max_budget: 5500,                         // In INR (₹5,500 max ceiling)
    allowed_categories: ['running_shoes'],    // Strict category restriction
    allowed_brands: ['Adidas'],               // Strict brand restriction
    max_price_delta_percent: 10,              // Max +10% price increase from original (₹4,900 -> max ₹5,390)
    required_attributes: { size: 10 }         // Strict size requirement
  });
  ```
- **Immutability**:
  - Created via `createUserMandate()`, which applies deep `Object.freeze` to the mandate and its nested arrays/objects. Any attempt to mutate at runtime throws a TypeError.

---

## 5. Candidate Retrieval Service

Defined in [src/commerce/candidateRetrieval.ts](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/src/commerce/candidateRetrieval.ts):

- `getCandidateProducts(originalProductId, options)` retrieves candidate products from the catalog.
- Automatically excludes the unavailable original product (`ADIDAS-RUN-01`) from candidate lists.
- Supports optional stock filtering (`onlyInStock: true`) to exclude items like `ADIDAS-RUN-05`.

---

## 6. Test Suite Execution & Verification

Test suite defined in [tests/gate-b1.test.ts](file:///c:/Users/DHANUSH%20A%20G/Desktop/razopay/tests/gate-b1.test.ts):

```text
 ✓ tests/gate-a.test.ts (21 tests)
 ✓ tests/gate-b1.test.ts (12 tests)

 Test Files  2 passed (2)
      Tests  33 passed (33)
```

### B1 Test Breakdown:
1. **TEST B1.1 — Catalog Structure**: Exactly 6 products verified with exact prices, brands, sizes, and IDs.
2. **TEST B1.2 — Authoritative Prices**: Ground-truth price lookups verified independently of LLM.
3. **TEST B1.3 — Inventory Simulator**: Initial stock verification, deterministic `setStock(id, 0)` OOS injection, `toggleOOS()` cycle, and isolated test instances.
4. **TEST B1.4 — Candidate Retrieval**: Returns the 5 alternative candidates when original is unavailable; filters out OOS items when requested.
5. **TEST B1.5 — UserMandate Immutability**: Verified `Object.isFrozen()`, mutation rejections in strict mode, and exact match to specification.

---

## 7. Known Limitations (Phase 0 / Gate B1)

1. **In-memory Inventory**: Stock changes in the simulator are held in memory and reset upon server restart.
2. **Catalog Scale**: The catalog is intentionally minimal (6 items) to isolate specific policy boundary test cases for Gate B2/B3.
3. **No Database Persistence**: No relational/document database attached (by design for checkpoint B1).

---

## 8. Gate B1 Decision

**GATE B1 STATUS: PASS (GREEN)**  
All commerce state structures, inventory controls, mandate immutability guarantees, and candidate retrieval routines are verified.

**Next Recommended Step**: Gate B2 (Policy Engine & Deterministic Constraint Evaluation).
