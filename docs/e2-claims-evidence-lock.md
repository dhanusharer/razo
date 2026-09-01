# Phase E2 — Final Claims & Evidence Lock

**Project**: Resilient-Agent-Relay  
**Track**: Razorpay AI Buildathon 2026 — Track 01  
**Stage**: Phase E2 — Comprehensive Claims, Evidence Mapping & Judge Defense Lock  
**Date**: 2026-08-31  
**Status**: 🔒 AUDITED, VERIFIED & LOCKED  
**Total Automated Tests**: 109 / 109 Tests Passing (100% Green)  

---

## 1. Executive Summary & Provenance Protocol

This audit provides a strict, evidence-backed inventory of every claim made by the **Resilient-Agent-Relay** project. To maintain 100% integrity before hackathon judges, all claims are mapped to exact source code, automated test files, or synthetic benchmark logs.

### Provenance Classification Taxonomy:
- **`LIVE TEST MODE`**: Verified against live Razorpay Test Rails with real API credentials and HMAC signatures.
- **`LIVE GEMINI API`**: Verified via remote HTTP calls to Google Generative AI (`gemini-2.0-flash`).
- **`SYNTHETIC`**: Derived from the deterministic 500-session benchmark harness (Seed: 42026) or 75-scenario holdout set (Seed: 54321).
- **`UNIT TEST`**: Deterministically verified via Vitest in-memory test suites (109 tests).
- **`DEMO_FIXTURE`**: Static baseline fixture used for deterministic UI visualization.

---

## 2. Exhaustive Claim & Evidence Matrix

| # | Domain | Claim | Exact Evidence | Source File / Test | Provenance | Safe Wording | Risk Level |
| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Payment Settlement** | Webhook signature is validated using raw HTTP body bytes. | `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` matches `x-razorpay-signature` | `src/routes/webhooks.ts`<br>`tests/gate-a.test.ts` (Gate A-1 to A-6) | `LIVE TEST MODE` / `UNIT TEST` | "Raw-body HMAC SHA256 cryptographic webhook verification" | **LOW** |
| **2** | **Payment State** | Transaction reaches `PAID` state only after verified `payment.captured`. | Transaction remains `NEW_ORDER_CREATED` until webhook handler executes state transition. | `src/routes/webhooks.ts`<br>`tests/gate-a.test.ts` (Gate A-7 to A-12) | `LIVE TEST MODE` / `UNIT TEST` | "State transitions to PAID strictly upon verified payment.captured webhook" | **LOW** |
| **3** | **Idempotency** | Duplicate webhook events are detected and ignored without state mutation. | In-memory `processedEvents` Set checks `event_id` and returns 200 OK idempotent response. | `src/routes/webhooks.ts`<br>`tests/gate-a.test.ts` (Gate A-13 to A-16) | `LIVE TEST MODE` / `UNIT TEST` | "Deterministic webhook event deduplication and replay protection" | **LOW** |
| **4** | **Policy Containment** | AI recommendations exceeding user price tolerance or budget are blocked with 0 orders. | `PolicyEngine.evaluateCandidate` returns `PASS: false` when delta > mandate tolerance; relay halts before order creation. | `src/policy/policyEngine.ts`<br>`tests/gate-b2.test.ts`<br>`tests/gate-b3.test.ts` | `UNIT TEST` | "Deterministic policy gate prevents order creation when user or merchant constraints are breached" | **LOW** |
| **5** | **Precedence** | Effective authorization is the mathematical intersection ($UserMandate \cap MerchantPolicy$). | `resolveEffectivePolicy()` computes $\min(\text{max\_budget})$, $\min(\text{price\_delta})$, and category intersection. | `src/policy/merchantPolicy.ts`<br>`tests/c3-merchant-policy.test.ts` | `UNIT TEST` | "Dual bounded authorization where user mandate strictly bounds merchant policy" | **LOW** |
| **6** | **Authoritative Revalidation** | Inventory and catalog price are rechecked at the instant of order creation. | `inventorySimulator.checkStock()` and `CatalogService.getProduct()` called after policy evaluation before Razorpay order API. | `src/recovery/recoveryRelay.ts`<br>`tests/gate-b3.test.ts` (B3-5) | `UNIT TEST` | "Second authoritative revalidation immediately before Razorpay order creation" | **LOW** |
| **7** | **Order Replacement** | Failed transactions are superseded by creating a new Razorpay order. | Initial order marked `SUPERSEDED_UNPAID`, new order created via Razorpay Orders API with `supersedes_transaction_id`. | `src/recovery/recoveryRelay.ts`<br>`tests/gate-b3.test.ts` (B3-6) | `LIVE TEST MODE` / `UNIT TEST` | "Autonomous replacement order creation superseding broken checkout" | **LOW** |
| **8** | **Economic Recovery** | Recovered 59.64% of failed checkouts in a 500-session synthetic benchmark. | 201 autonomous recoveries out of 337 eligible failure sessions (Seed: 42026). | `benchmarks/recovery-benchmark.ts`<br>`docs/c1-benchmark-results.md` | `SYNTHETIC` | "Recovered 59.64% (201/337) of eligible checkout failures in a controlled 500-session synthetic benchmark" | **LOW** *(Safe with qualifier)* |
| **9** | **GMV Recovery** | Recovered ₹1,045,200 simulated GMV in benchmark. | ₹1,045,200 recovered out of ₹1,651,200 lost baseline GMV (63.30% recovery rate). | `benchmarks/recovery-benchmark.ts`<br>`docs/c1-benchmark-results.md` | `SYNTHETIC` | "Recovered ₹1,045,200 simulated GMV (63.30% GMV recovery rate) in synthetic benchmark" | **LOW** *(Safe with qualifier)* |
| **10** | **Unauthorized Actions** | Zero unauthorized transactions occurred across all tests and benchmarks. | 0 unauthorized transactions across 500 benchmark sessions, 75 holdout scenarios, and 109 automated unit tests. | `docs/c1-benchmark-results.md`<br>`tests/gate-b2.test.ts` | `SYNTHETIC` / `UNIT TEST` | "0 unauthorized financial transactions across 500 benchmark sessions and 109 automated tests" | **LOW** |
| **11** | **Prompt Injections** | 100% containment on adversarial prompt/catalog injection attacks. | 11 adversarial attack test cases (budget overrides, brand hijack, prompt jailbreaks) contained by deterministic engine. | `tests/gate-b2.test.ts` (B2-13 to B2-24) | `UNIT TEST` | "100% containment (11/11) against adversarial prompt and catalog injection attacks" | **LOW** |
| **12** | **Engine Latency** | Deterministic engine latency is sub-millisecond (p50: 0.03ms, p95: 0.08ms). | In-memory candidate retrieval, policy intersection, and revalidation benchmarked over 1,000 runs. | `benchmarks/latency-audit.ts`<br>`docs/c1.5-results.md` | `SYNTHETIC` | "Deterministic policy & revalidation engine latency: p50 0.03ms / p95 0.08ms" | **LOW** *(Must separate from LLM)* |
| **13** | **Gemini Live Latency** | Live Gemini decision latency is ~6.2s to 7.1s. | Real API calls to `gemini-2.0-flash` timed over 50 live evaluations (avg: 6,480ms, p50: 6,257ms, p95: 7,110ms). | `docs/c1.5-results.md`<br>`src/metrics/metricsService.ts` | `LIVE GEMINI API` | "Remote Google Gemini 2.0 Flash inference latency: p50 6,257ms / p95 7,110ms" | **LOW** |
| **14** | **Timeout Safety** | Relay halts and escalates safely if LLM exceeds timeout budget. | `Promise.race` with 8,000ms timeout triggers `ESCALATION_REQUIRED` and creates 0 orders. | `src/agent/providers/geminiProvider.ts`<br>`tests/c2-timeout-safety.test.ts` | `UNIT TEST` | "Bounded 8,000ms timeout safety guard with automatic fallback to safe escalation" | **LOW** |
| **15** | **Holdout Quality** | 100% practical acceptance rate on 75 unseen evaluation scenarios. | 71 Good (94.67%), 4 Acceptable (5.33%), 0 Poor, 0 Invalid selections on independent holdout set (Seed: 54321). | `benchmarks/c2.6-practical-eval.ts`<br>`docs/c2.6-results.md` | `SYNTHETIC` | "100% practical acceptance rate (94.67% Good, 5.33% Acceptable) across 75 unseen holdout scenarios" | **LOW** |
| **16** | **Merchant Margin** | Preserves merchant gross margin threshold (e.g. min 10%). | `cost_inr` and `cost_paise` tracked in catalog; `PolicyEngine` enforces $(Price - Cost)/Price \ge \text{min\_margin}$. | `src/commerce/catalog.ts`<br>`tests/c3.5-metrics.test.ts` | `UNIT TEST` | "Authoritative catalog product cost tracking with automated merchant margin floor enforcement" | **LOW** |
| **17** | **Zero Secret Leak** | Zero API keys, webhook secrets, or private tokens leaked to client or logs. | Supertest assertions verify `RAZORPAY_KEY_SECRET`, `WEBHOOK_SECRET`, and `GEMINI_API_KEY` are absent from HTML/API responses. | `tests/d1-demo-api.test.ts` (D1-8)<br>`tests/d2-demo-ui.test.ts` (D2.7-7) | `UNIT TEST` | "Verified zero secret leakage across all client-facing APIs and HTML responses" | **LOW** |

---

## 3. Live vs Synthetic Disaggregation Protocol

### Live-Verified Capabilities (Real-Time Test Rails):
- Razorpay Orders API order generation (`order_...`).
- Razorpay Standard Checkout client-to-server payment signature validation.
- Authoritative `payment.captured` webhook delivery and raw-body HMAC SHA256 validation.
- Transaction state transition to `PAID` with recorded Payment ID and Event ID.
- Live Google Gemini 2.0 Flash prompt completion and structured JSON recommendation.

### Synthetic Benchmark Capabilities (Controlled Offline Simulations):
- 500-session economic recovery benchmark (₹1,045,200 GMV recovered, 59.64% recovery rate).
- 75-scenario unseen holdout evaluation (50.67% Oracle Top-1, 89.33% Oracle Top-2, 100% Practical Acceptance).
- 11 adversarial catalog/prompt injection attacks.
- Disaggregated deterministic engine latency benchmark (0.03ms p50).

> **CRITICAL RULE**: Synthetic benchmark figures (e.g., ₹1,045,200 GMV) must **always** be labeled as `[SYNTHETIC BENCHMARK]` and never represented as real production merchant GMV.

---

## 4. Key Metric Wording Guardrails

| Metric | Accurate Safe Phrasing | ❌ Prohibited / Risky Phrasing |
| :--- | :--- | :--- |
| **59.64% Recovery Rate** | *"Autonomous recovery rate of 59.64% across 337 eligible failure sessions in a 500-session synthetic benchmark."* | ❌ *"Recovers 60% of all e-commerce checkout failures."* |
| **₹1,045,200 GMV** | *"Recovered ₹1,045,200 in simulated GMV (63.30% of lost baseline GMV) in synthetic benchmark."* | ❌ *"Generated ₹10 Lakhs of real merchant revenue."* |
| **0 Unauthorized Txns** | *"Zero unauthorized transactions across 500 synthetic benchmark sessions and 109 automated test suites."* | ❌ *"Guarantees 100% unhackable security against all future attacks."* |
| **Engine Latency** | *"Deterministic policy and revalidation engine latency is sub-millisecond (p50: 0.03ms / p95: 0.08ms)."* | ❌ *"End-to-end AI recovery happens in 0.03 milliseconds."* |
| **Gemini Latency** | *"Live remote Gemini 2.0 Flash inference decision takes approximately 6.2 to 7.1 seconds."* | ❌ *"Gemini is instantaneous."* |
| **100% Practical Quality** | *"100% practical acceptance rate (94.67% Good, 5.33% Acceptable) across 75 unseen holdout scenarios."* | ❌ *"Gemini is 100% perfect on every shopping query."* |

---

## 5. Security & Settlement Terminology Audit

### ❌ Prohibited Term: *"Cryptographic Settlement"*
- **Reason**: "Cryptographic settlement" technically refers to atomic clearing on decentralized ledgers or interbank RTGS cryptographic networks.
- **Approved Replacement**: **"Cryptographically verified Razorpay webhook settlement"** or **"Cryptographically authenticated payment verification lifecycle"**.

### ✅ Verified Security Invariants:
1. **AI Cannot Directly Authorize Payment**: The LLM output is strictly an advisory suggestion. The deterministic `PolicyEngine` evaluates the candidate and grants or denies authority.
2. **Policy Rejection Means Zero Order Creation**: If Policy Gate 1 fails, the relay halts immediately. No call is made to Razorpay's `/v1/orders` endpoint.
3. **Raw-Body HMAC Verification**: The webhook handler verifies `x-razorpay-signature` against the raw unparsed request buffer using HMAC SHA256 before any JSON parsing.
4. **Idempotency Guard**: Webhook event IDs are stored in-memory; duplicate deliveries return 200 OK without re-processing.
5. **Authoritative `PAID` State**: The application never transitions a transaction to `PAID` based on client checkout callbacks; it requires the authoritative webhook `payment.captured` event.

---

## 6. Categorized Claim Taxonomy

### A. MUST SAY (Core Value & Differentiators):
- "Resilient-Agent-Relay is a transaction reliability layer for agentic commerce that provides autonomous checkout recovery with bounded authorization."
- "The LLM is strictly an advisory semantic ranker; deterministic code enforces all financial constraints (User Mandate $\cap$ Merchant Policy)."
- "Payment verification is cryptographically authenticated via raw-body HMAC SHA256 Razorpay webhooks."
- "In a 500-session controlled synthetic benchmark, the relay recovered 59.64% of failed checkouts (₹1,045,200 simulated GMV) with zero unauthorized transactions."
- "The entire codebase is verified by 109 automated tests passing with zero regressions."

### B. SAFE TO SAY:
- "The system supports dual bounded authorization, ensuring the merchant policy cannot expand user budget tolerance."
- "Inventory stock and authoritative catalog pricing are revalidated at the exact millisecond of replacement order creation."
- "Failed checkouts are superseded by new Razorpay orders without duplicate charging."
- "Deterministic policy evaluation runs in 0.03ms p50, while live Gemini inference takes ~6.2s."

### C. SAY ONLY WITH QUALIFIERS:
- "Recovered ₹1,045,200 GMV" $\rightarrow$ *Must qualify: "in a 500-session synthetic benchmark (Seed: 42026)"*.
- "59.64% recovery rate" $\rightarrow$ *Must qualify: "on 337 eligible failure scenarios in benchmark"*.
- "100% practical acceptance" $\rightarrow$ *Must qualify: "across a 75-scenario independent holdout evaluation set"*.

### D. DO NOT SAY:
- ❌ *"We implemented cryptographic settlement."* (Use "cryptographically verified webhook settlement").
- ❌ *"Our AI autonomously moves money."* (AI suggests candidates; deterministic policy gates authorize orders).
- ❌ *"WhatsApp and n8n are integrated in the core MVP."* (They are external integration points).
- ❌ *"The system recovers 100% of all failures."* (Recovers valid substitutes within bounds; safely escalates 40.36% when constraints cannot be met).

---

## 7. Judge Q&A Defense Master Sheet

#### 1. Why isn't this just an AI shopping bot?
> *"A shopping bot is a conversational recommendation tool that operates before checkout and has no financial authority or state guarantees. Resilient-Agent-Relay is a transaction-grade reliability layer that activates at the moment of runtime checkout failure (stockout/price shift), autonomously finds a replacement within strict mathematical bounds, and programmatically replaces the order on Razorpay with cryptographic webhook verification."*

#### 2. Why can't Gemini directly spend money or authorize payments?
> *"Because LLMs are probabilistic and vulnerable to hallucination and prompt injection. In our architecture, Gemini is strictly a semantic scoring engine that suggests candidate product IDs. All financial authorization is enforced deterministically in TypeScript by our Policy Engine. If Gemini recommends a product that breaches the User Mandate by even 1 rupee, the system halts with zero orders created."*

#### 3. What happens when the AI is wrong or recommends a bad product?
> *"Two protective layers exist: First, the deterministic Policy Engine immediately rejects candidates that breach budget, brand, category, or price tolerance. Second, if a candidate is policy-valid but sub-optimal, our practical evaluation proved that 100% of selections were acceptable to human reviewers, and in ambiguous cases, the relay escalates to the user for explicit confirmation."*

#### 4. What happens when inventory stock changes again during recovery?
> *"We enforce a second authoritative revalidation immediately before Razorpay order creation. After Gemini selects a candidate and after Policy Gate 1 passes, the relay re-queries the live inventory and authoritative catalog pricing at the exact instant before calling Razorpay's API. If the substitute sold out in that millisecond, order creation is aborted."*

#### 5. What happens when the candidate product is too expensive?
> *"If the candidate price exceeds the User Mandate maximum budget or price delta tolerance (e.g. +10%), Policy Gate 1 fails instantly with a `POLICY_REJECTED` event. The relay halts execution, creates ZERO Razorpay orders, and safely escalates the transaction for user review."*

#### 6. How do you know the payment really happened?
> *"We do not trust the client browser checkout callback. The transaction remains in `NEW_ORDER_CREATED` state until Razorpay's servers send an authoritative `payment.captured` webhook. Our backend validates the raw request buffer against our webhook secret using HMAC SHA256. Only upon valid cryptographic signature does the transaction transition to `PAID`."*

#### 7. Which results are real and which are synthetic?
> *"We have demonstrated live Gemini inference and a live Razorpay Test Mode transaction, including Checkout verification and payment.captured webhook verification. Our 500-session economic recovery benchmark (₹10.45L GMV, 59.64% recovery) and 75-scenario holdout quality evaluations are controlled SYNTHETIC benchmarks designed to measure statistical performance under reproducible conditions."*

#### 8. What is the biggest current limitation?
> *"The remote Gemini 2.0 Flash API call introduces ~6.2 seconds of network inference latency. While acceptable for asynchronous checkout recovery where the user would otherwise face a total order failure, local/edge inference is a future optimization; it has not been demonstrated in this prototype."*

#### 9. Why does the merchant care about this product?
> *"Checkout stockouts and price volatility represent unrecovered high-intent revenue. In our 500-session benchmark, 337 checkouts failed, and the relay recovered ₹1,045,200 in GMV ($63.30\%$ of lost revenue) while protecting merchant margins above 10% and incurring zero unauthorized financial actions in controlled tests."*

#### 10. Where would WhatsApp fit in this architecture?
> *"WhatsApp is an optional conversational client transport layer. If connected, user purchase intents and out-of-band `ESCALATION_REQUIRED` approval requests would route through WhatsApp via webhooks to our backend, while all policy, recovery, and Razorpay logic remains in our core TypeScript relay."*

#### 11. Where would n8n fit in this architecture?
> *"n8n is an external merchant operations and notification dispatcher. When our relay logs an `ESCALATION_REQUIRED` event or `PAYMENT_CAPTURED` settlement, an outbound webhook can trigger an n8n workflow to alert the merchant in Slack, update ERP inventory, or dispatch customer support tickets."*
