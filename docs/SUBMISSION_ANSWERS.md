# 🏆 Razorpay AI Buildathon 2026 — Official Submission Kit
**Project Name**: Resilient-Agent-Relay  
**Track**: Track 1 — Agentic Commerce & Payment Reliability  
**GitHub Repository**: [https://github.com/dhanusharer/razo](https://github.com/dhanusharer/razo)  
**Primary Language / Stack**: TypeScript, Node.js, Express, Razorpay Checkout SDK, Google Gemini 2.5 Flash, Vitest  

---

## 📋 Field-by-Field Submission Copy-Paste Guide

Use these pre-crafted, high-impact responses when filling out the hackathon portal (Devfolio, HackerEarth, or Razorpay direct submission form).

---

### 1. Project Title
```text
Resilient-Agent-Relay
```

### 2. Project Tagline (One-Liner)
```text
Autonomous checkout recovery with bounded authorization: the transaction reliability layer for agentic commerce.
```

### 3. Core Product Philosophy / Elevator Pitch
```text
AI recommends. Policy authorizes. Razorpay executes. Audit proves.
```

---

### 4. Inspiration & The Problem Statement
**Prompt**: *What inspired you to build this project? What problem does it solve?*

```text
By 2026, autonomous AI buyer agents are beginning to transact directly across e-commerce platforms. However, traditional payment gateways and checkout APIs were engineered for humans, not autonomous software agents. 

When an AI buyer attempts to complete a purchase and encounters an abrupt mid-flight stockout, price surge, or catalog discontinuation, the session crashes—causing a devastating ~40% cart abandonment rate for merchants.

Worse yet, the naive solution—giving an LLM unconstrained access to a merchant's payment rails—leads to the "Hallucination Catastrophe": an AI agent purchasing unauthorized, out-of-budget, or predatory substitutes without financial accountability.

We built Resilient-Agent-Relay to solve this fundamental trust gap: providing an autonomous transaction reliability layer that recovers failed checkouts while mathematically bounding every single rupee before payment execution.
```

---

### 5. What It Does (Core Flow & Features)
**Prompt**: *Describe your solution and how it works.*

```text
Resilient-Agent-Relay decouples advisory semantic intelligence from monetary authorization:

1. Autonomous Failure Detection: When an AI checkout session encounters an OUT_OF_STOCK error, the Relay captures the failed transaction and buyer intent without dropping the session.
2. Advisory Intelligence: Google Gemini 2.5 Flash evaluates the buyer's natural language intent and catalog inventory to propose a contextual candidate substitute (e.g., Adidas Adizero SL2 for an out-of-stock Boston 12).
3. Deterministic Dual-Gate Bounding (0.03ms): Before any order can be created, our deterministic Policy Engine evaluates the exact mathematical intersection of the User Mandate (budget ceiling, brand/category whitelist, max price delta tolerance) and Merchant Policy (minimum gross margin floor).
4. Authoritative Revalidation: Live inventory levels (units available) and wholesale cost floors are verified against the authoritative database, preventing stale-state hallucinations.
5. Razorpay Native Settlement: A brand-new Razorpay test order is registered, verified via client-side Standard Checkout SDK signatures and server-side raw wire-body HMAC webhook verification (payment.captured) before reaching PAID.
6. Safe Escalation Guarantee: If an AI candidate breaches constraints by even 0.01%, the Relay triggers ESCALATION_REQUIRED, guaranteeing EXACTLY ZERO Razorpay orders or duplicate financial mutations.
```

---

### 6. How We Built It (Architecture & Deep Razorpay Rails Usage)
**Prompt**: *What technologies did you use? How is Razorpay integrated?*

```text
We engineered Resilient-Agent-Relay in strict TypeScript with a modular, security-first architecture:

• Payment Infrastructure (Razorpay):
  - Razorpay Orders API: Generates isolated, cryptographically tracked orders for recovered transactions.
  - Razorpay Standard Checkout SDK: Integrated into our Light FinTech Control Plane for real-time customer/agent payment authorization.
  - Timing-Safe Verification: Employs Node.js crypto.timingSafeEqual for server-side checkout signature verification to reduce timing side-channel leakage during verification.
  - Raw Wire-Byte Webhook Engine: Custom raw buffer tap in Express that verifies x-razorpay-signature against untouched wire-bytes before any JSON parsing.
  - Event Idempotency: Deduplicates x-razorpay-event-id to protect against duplicate order state mutations.

• Advisory Intelligence Layer:
  - Google Gemini 2.5 Flash: Structured schema outputs enforcing typed candidate selection within bounded latency budgets (≤ 8.0s timeout with graceful fallback).

• Deterministic Policy Engine:
  - Mathematical intersection engine executing in 0.03ms—completely independent of AI non-determinism.

• Frontend Control Plane:
  - Custom Light FinTech Dashboard adhering to DESIGN.md v2.1 (#F8F9FA canvas, Mercury restraint, ClickUp density) featuring 6 interactive tabs: Live Recovery, Policies & Mandates, Economic Benchmark, Audit Ledger, Product Catalog, and Adversarial Containment Matrix.
```

---

### 7. Technical Challenges Overcome
**Prompt**: *What was the most challenging part of building this project, and how did you overcome it?*

```text
1. The Express Raw-Body Webhook Mutation Trap:
Standard Express JSON parsers (express.json()) reconstruct parsed objects, altering key order and whitespace. This subtly mutates the wire payload, causing Razorpay's HMAC SHA256 webhook verification to fail intermittently. We solved this by implementing a custom raw buffer capture tap on the /api/webhooks route, preserving byte-for-byte fidelity for cryptographic hashing.

2. Enforcing the "Separation of Powers":
Preventing LLM non-determinism from translating into unauthorized financial transactions was our paramount challenge. We architected a strict boundary: the LLM is completely blind to payment credentials and has zero execution privilege. It can only propose candidate IDs; our deterministic code gates every order creation.

3. Live Checkout Key Synchronization:
When launching the Razorpay Standard Checkout modal dynamically from an autonomous recovery flow, the frontend checkout options must authenticate against the matching Razorpay merchant account that generated the order. We engineered a dynamic public key binding that links the order to the active test rails without ever leaking secret credentials into the DOM.
```

---

### 8. Accomplishments That We're Proud Of
**Prompt**: *What achievements in this project are you most proud of?*

```text
1. 115 / 115 Passing Automated Tests: 100% green coverage across 10 test suites in ~2.4 seconds, rigorously proving state transitions, signature verification, timeout boundaries, and interactive adversarial containment.
2. 500-Session Controlled Benchmark & Illustrative ROI Simulator: Evaluated autonomous recovery performance (59.64% recovery of eligible failures in controlled synthetic benchmark) with an interactive tool modeling scenario-based GMV recovery estimates.
3. Sub-Millisecond Policy Containment & Adversarial Matrix: Deterministic financial policy checks that intercept prompt injection jailbreaks and webhook replays with zero Razorpay orders created for blocked scenarios.
4. Production-Ready Design System: A bespoke, light-themed FinTech Transaction Control Plane with standardized SVG icons, 6 interactive tabs, and full auditability.
```

---

### 9. What We Learned
**Prompt**: *What key insights did you gain during development?*

```text
1. AI should advise; code must authorize. In financial workflows, non-deterministic models should never hold the purse strings.
2. Webhook verification must be treated as the sole source of truth for payment capture—client callbacks can be dropped, interrupted, or forged.
3. Transparent provenance is essential for enterprise trust. Labeling data as LIVE vs DEMO FIXTURE vs SYNTHETIC BENCHMARK builds immediate credibility with payment operations teams.
```

---

### 10. What's Next for Resilient-Agent-Relay
**Prompt**: *What are the future plans for this project?*

```text
1. Multi-Merchant Network Relay: Expanding bounded autonomous recovery across merchant syndicates when an item is out of stock across the primary retailer.
2. Razorpay Subscriptions & Mandates (UPI Autopay): Integrating recurring agent allowances with pre-authorized spending caps.
3. Open-Source Agent Adapter SDK: Publishing lightweight SDKs for LangChain, CrewAI, and AutoGen to enable agent developers to add resilient checkout recovery in 3 lines of code.
```

---

## 🎯 Track 1 Scoring Rubric Alignment Matrix

| Evaluation Pillar | Hackathon Weight | How Resilient-Agent-Relay Wins |
| :--- | :---: | :--- |
| **Innovation & Concept** | 25% | Decouples advisory LLM intelligence from deterministic monetary authorization for autonomous agentic commerce. |
| **Technical Execution** | 25% | 115 / 115 passing tests across 10 suites, 10-step financial state machine, raw wire-byte HMAC verification, timing-safe equality. |
| **Razorpay Integration** | 20% | Deep native usage of Razorpay Orders API, Standard Checkout SDK, and Webhook capture event verifier. |
| **Business Value & GMV** | 15% | Controlled benchmark demonstrates 59.64% recovery of eligible checkout failures without margin degradation. |
| **UX & Product Polish** | 15% | High-density Light FinTech Control Plane (`DESIGN.md` v2.1) with 6 interactive tabs and zero secret leakage. |
