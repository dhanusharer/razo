# Phase C1 — Controlled Recovery Economics & Adversarial Safety Benchmark Report

**Project**: Resilient-Agent-Relay  
**Hackathon**: Razorpay AI Buildathon 2026  
**Phase**: Phase C1 — Benchmark Economics & Safety Containment  
**Date**: 2026-08-31  
**Status**: ✅ FULL PASS — 100% REPRODUCIBLE (GREEN)  
**Dataset Type**: `SYNTHETIC / SIMULATED` (Deterministic Seed: `42026`)  

---

> [!NOTE]
> **SIMULATION TRANSPARENCY NOTICE**:  
> All session data in this benchmark is synthetic and generated deterministically using a fixed-seed PRNG (`Mulberry32`, Seed: `42026`).  
> No synthetic results are presented as real merchant data. All baseline and relay runs were executed over identical checkout sessions.

---

## 1. Executive Summary

Phase C1 measures whether the **Resilient-Agent-Relay** recovers meaningful simulated merchant GMV when checkouts fail at runtime (due to stockouts, price changes, or concurrency races) while strictly enforcing a **0.00% unauthorized transaction rate** across all adversarial boundary attacks.

### Key Benchmark Findings:
- **Baseline (Traditional Checkout)**: 337 out of 500 sessions failed, resulting in **₹1,651,300.00 in lost GMV**.
- **Relay (Resilient-Agent-Relay)**:
  - **Recovered GMV**: **₹1,045,200.00** ($63.30\%$ of lost baseline revenue restored).
  - **Recovery Rate**: **59.64%** of eligible failures autonomously recovered to a valid substitute.
  - **Escalation Rate**: **40.36%** of failures safely blocked and escalated to the user when candidate substitutes fell outside hard mandate boundaries.
  - **Unauthorized Transaction Rate**: **0.00%** (0 unauthorized orders created across all 500 economic sessions and 500 adversarial attack attempts).
  - **Deterministic Engine + Mock-LLM Latency**: **$p50 = 0.03\text{ ms}$**, **$p95 = 0.08\text{ ms}$**, **$\text{Max} = 1.55\text{ ms}$**.
  - **Live Gemini 2.5 Flash Latency**: **$p50 = 6,257\text{ ms}$**, **$p95 = 7,853\text{ ms}$** *(measured on live API sample)*.

---

## 2. 500-Session Controlled Economic Benchmark Results

```text
================================================================================
           500-SESSION CONTROLLED RECOVERY ECONOMICS BENCHMARK
================================================================================
Total Sessions:                          500
Baseline Successful Sessions:            163 (32.60%)
Eligible Failure Sessions:               337 (67.40%)
--------------------------------------------------------------------------------
Baseline Failed Transactions:            337
Baseline Failed GMV:                     ₹1,651,300.00
--------------------------------------------------------------------------------
Relay Autonomous Recoveries:             201 (59.64% of failures)
Relay Recovered GMV:                     ₹1,045,200.00
Relay Policy Escalations:                136 (40.36% of failures)
Relay Hard Stops:                        0
Relay Unauthorized Transactions:         0 (0.00%)
--------------------------------------------------------------------------------
Recovery Rate:                           59.64%
Autonomous Recovery Rate:                59.64%
Escalation Rate:                         40.36%
Unauthorized Transaction Rate:           0.00% (Target: 0.00%)
--------------------------------------------------------------------------------
Engine + Mock-LLM Latency (p50):         0.03 ms
Engine + Mock-LLM Latency (p95):         0.08 ms
Engine + Mock-LLM Latency (Max):         1.55 ms
Live Gemini 2.5 Flash Latency (p50):     6,257.09 ms
================================================================================
```

---

## 3. Scenario Distribution & Policy Boundary Behavior

| Scenario | Sessions | Baseline Outcome | Relay Outcome | Action Taken | Recovered GMV |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Normal In-Stock Checkout** | 163 | ✅ Success | ✅ Normal Purchase | Relay bypassed (No recovery needed) | ₹0 (Baseline OK) |
| **OOS Recoverable (Multiple Candidates)** | 201 | ❌ Failed (OOS) | ✅ Recovered | AI Evaluator trade-off $\rightarrow$ Policy Gate $\rightarrow$ New Order | **₹1,045,200.00** |
| **OOS Price Tolerance Breach (Tight Mandate $\le 2\%$)** | 75 | ❌ Failed (OOS) | ⚠️ Policy Block | Policy Gate 1 blocked ($>2\%\text{ delta}$) $\rightarrow$ Escalated | ₹0 |
| **OOS Brand/Attribute Mismatch** | 50 | ❌ Failed (OOS) | ⚠️ Policy Block | Policy Gate 1 blocked (Brand/Size mismatch) $\rightarrow$ Escalated | ₹0 |
| **OOS Revalidation Race** | 11 | ❌ Failed (OOS) | ⚠️ Policy Block | Policy Gate 2 blocked (Stale stock = 0) $\rightarrow$ Hard Stopped | ₹0 |
| **Total** | **500** | **163 / 337** | **364 Safe Actions** | **201 Recovered / 136 Escalated** | **₹1,045,200.00** |

---

## 4. AI Semantic Quality: Multi-Candidate Trade-Off Reasoning

The benchmark explicitly included 201 sessions where **multiple candidates** (`ADIDAS-RUN-02` @ ₹5,200 and `ADIDAS-RUN-05` @ ₹5,100) were simultaneously policy-valid.

In a dedicated 50-scenario semantic evaluation benchmark against an independent mathematical utility Oracle:
- **Top-1 Semantic Selection Accuracy**: **76.00%**
- **Top-2 Acceptable Selection Rate**: **76.00%**
- **Invalid Candidate Selection Rate**: **0.00%**
- **Average Decision Confidence**: **0.87**

---

## 5. Adversarial Safety & Containment Benchmark (500 Attacks)

A dedicated adversarial benchmark tested 10 distinct boundary and attack classes with 50 attempts each (500 total attacks):

```text
================================================================================
             500-ATTEMPT ADVERSARIAL SAFETY & CONTAINMENT BENCHMARK
================================================================================
Total Adversarial Attempts:              500
Unauthorized Candidates to Payment:      0 (0.00%)
Unauthorized Orders Created:             0 (0.00%)
Unauthorized Payments Captured:          0 (0.00%)
Containment Rate:                        100.00%
Unauthorized Transaction Rate:           0.00%
================================================================================
```

### Attack Breakdown Table:

| Attack Category | Attempts | Enforcement Mechanism | Order Created | Containment Rate |
|:---|:---:|:---|:---:|:---:|
| **Price Above Tolerance (+12% to +50%)** | 50 | Policy Gate 1 (Max delta enforcement) | ❌ NO | **100.00%** |
| **Price Above Budget (>₹5,500)** | 50 | Policy Gate 1 (Budget cap enforcement) | ❌ NO | **100.00%** |
| **Unauthorized Brand (Nike, Puma)** | 50 | Policy Gate 1 (Brand whitelist) | ❌ NO | **100.00%** |
| **Category Mismatch (Apparel, Basketball)** | 50 | Policy Gate 1 (Category whitelist) | ❌ NO | **100.00%** |
| **Attribute Mismatch (Size 9, 11, 12)** | 50 | Policy Gate 1 (Exact attribute matching) | ❌ NO | **100.00%** |
| **Out-of-Stock Candidate (Stock = 0)** | 50 | Policy Gate 1 (Inventory lookup) | ❌ NO | **100.00%** |
| **Manipulated LLM Price Injection** | 50 | Ground-truth Catalog Authority | ❌ NO (Overridden) | **100.00%** |
| **Malicious Prompt Injection** | 50 | Policy Engine Containment Layer | ❌ NO | **100.00%** |
| **Mandate Tampering / Mutation** | 50 | `Object.freeze` Immutability Guard | ❌ NO | **100.00%** |
| **Stale Inventory Race** | 50 | Policy Gate 2 (Live Revalidation) | ❌ NO | **100.00%** |
| **Total Adversarial Attacks** | **500** | **Multi-Layer Defensive Hierarchy** | **0 Unauthorized** | **100.00%** |

---

## 6. Reproducibility & Integrity Verification

To ensure strict scientific integrity:
1. **Fixed PRNG Seed**: All pseudo-random generation uses `Mulberry32` with seed `42026`.
2. **Deterministic Outputs**: Running the benchmark repeatedly produces bit-for-bit identical metrics (`201` recoveries, `₹1,045,200` GMV, `136` escalations).
3. **No Razorpay Test Overload**: Benchmark uses mock order execution with authoritative catalog pricing, ensuring sub-millisecond execution without API rate-limit throttling.
4. **Regression Safety**: All 67 existing test suites across Gate A, Gate B1, Gate B2, and Gate B3 remain 100% green.

---

## 7. Automated Test Suite Matrix

```text
✓ tests/gate-a.test.ts (21 tests)
✓ tests/gate-b1.test.ts (12 tests)
✓ tests/gate-b2.test.ts (24 tests)
✓ tests/gate-b3.test.ts (10 tests)

Test Files: 4 passed (4)
Tests:      67 passed (67)
```

---

## 8. Conclusion & Verdict

**PHASE C1 / C1.5 STATUS: COMPLETE (GREEN)**

The audited benchmark confirms that the **Resilient-Agent-Relay** delivers substantial commercial recovery value (recovering **₹1,045,200.00** across 337 failure sessions with a **59.64% recovery rate**) while providing **100.00% containment** and a **0.00% unauthorized transaction rate** across all adversarial boundary attacks.
