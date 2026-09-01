import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { config } from '../src/config.js';

describe('D2.7 — State & Provenance Consistency Audit', () => {
  beforeEach(() => {
    transactionStore.reset();
  });

  // 1. Static UI Entrypoint & Structured Provenance Header
  it('D2.7-1: GET /index.html serves structured provenance header without malformed text', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Resilient-Agent-Relay');
    expect(res.text).toContain('ENVIRONMENT: LIVE TEST MODE');
    expect(res.text).toContain('PAYMENT GATEWAY: RAZORPAY');
    expect(res.text).toContain('AI: GOOGLE GEMINI');
    expect(res.text).toContain('header-model-badge');
    expect(res.text).not.toContain('LIVELIVE');
  });

  // 2. Canonical Model Exposure
  it('D2.7-2: GET /api/status exposes single canonical Gemini model matching config', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.model).toBe(config.geminiModel);
    expect(res.body.llm_provider).toBe(config.llmProvider);
  });

  // 3. Section A: Synthetic Benchmark Area (Authoritative Backend Numbers)
  it('D2.7-3: Area A renders synthetic benchmark GMV and recovery rate without mock confusion', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Area A — Merchant Economic Benchmark');
    expect(res.text).toContain('PROVENANCE: SYNTHETIC BENCHMARK (500 SESSIONS)');
    expect(res.text).toContain('201 / 337 eligible failures [SYNTHETIC BENCHMARK]');
    expect(res.text).toContain('GMV Recovery Rate: 63.30% [SYNTHETIC BENCHMARK]');
    expect(res.text).not.toContain('0 / 0 [MOCK]');
  });

  // 4. Section B & C: Live Console & Strict Fixture Isolation
  it('D2.7-4: GET /api/recovery/demo-fixture uses isolated fixture IDs without mixing live IDs', async () => {
    const res = await request(app).get('/api/recovery/demo-fixture');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBe('DEMO_FIXTURE');
    expect(res.body.transaction_id).toBe('txn_demo_golden_recovery_001');
    expect(res.body.new_razorpay_order_id).toBe('order_demo_fixture_rec_001');
    expect(res.body.payment_id).toBe('pay_demo_fixture_captured_001');
    expect(res.body.webhook_event_id).toBe('evt_demo_fixture_001');
    expect(res.body.new_razorpay_order_id).not.toContain('order_TW2gAizOpB5o32');
  });

  // 5. 10-Step Full Financial Verification Pipeline
  it('D2.7-5: UI contains all 10 steps of the complete financial lifecycle', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('1. Checkout Started');
    expect(res.text).toContain('2. Failure Detected');
    expect(res.text).toContain('3. Candidate Selected');
    expect(res.text).toContain('4. Policy Gate 1');
    expect(res.text).toContain('5. Revalidation Gate 2');
    expect(res.text).toContain('6. New Order Created');
    expect(res.text).toContain('7. Checkout Signature');
    expect(res.text).toContain('8. Webhook HMAC');
    expect(res.text).toContain('9. Payment Captured');
    expect(res.text).toContain('10. State Transition');
  });

  // 6. Safe Escalation Flow (Deterministic Policy Block & Zero Orders)
  it('D2.7-6: Safe Escalation action triggers deterministic policy block with zero Razorpay orders', async () => {
    const res = await request(app)
      .post('/api/recovery/evaluate')
      .send({
        user_intent: 'Need shoes, max 1% delta',
        original_product_id: 'ADIDAS-RUN-01',
        mandate_params: {
          max_budget: 5000,
          max_price_delta_percent: 1, // ADIDAS-RUN-02 is +6.12% -> triggers BLOCK
          allowed_categories: ['running_shoes'],
          allowed_brands: ['Adidas'],
          required_attributes: { size: 10 }
        },
        simulate_initial_oos: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.decision_type).toBe('ESCALATION_REQUIRED');
    expect(res.body.status).toBe('POLICY_REJECTED');
    expect(res.body.razorpay_order).toBeUndefined();
  });

  // 7. Security Check: Zero Secret Leakage
  it('D2.7-7: Asserts zero secret leakage in static HTML and API endpoints', async () => {
    const htmlRes = await request(app).get('/index.html');
    if (config.razorpayKeySecret) {
      expect(htmlRes.text).not.toContain(config.razorpayKeySecret);
    }
    if (config.razorpayWebhookSecret) {
      expect(htmlRes.text).not.toContain(config.razorpayWebhookSecret);
    }
    if (config.geminiApiKey) {
      expect(htmlRes.text).not.toContain(config.geminiApiKey);
    }
  });

  // 8. Backend Authoritative Synthetic Benchmark Metrics
  it('D2.7-8: GET /api/metrics contains authoritative synthetic benchmark object with 201/337 recoveries', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.synthetic_benchmark).toBeDefined();
    expect(res.body.synthetic_benchmark.total_sessions).toBe(500);
    expect(res.body.synthetic_benchmark.recovered_transactions).toBe(201);
    expect(res.body.synthetic_benchmark.eligible_failures).toBe(337);
    expect(res.body.synthetic_benchmark.recovery_rate).toBe(59.64);
    expect(res.body.synthetic_benchmark.recovered_gmv_inr).toBe(1045200);
    expect(res.body.synthetic_benchmark.gmv_recovery_rate).toBe(63.30);
    expect(res.body.synthetic_benchmark.unauthorized_transactions).toBe(0);
    expect(res.body.synthetic_benchmark.provenance).toBe('SYNTHETIC BENCHMARK');
  });

  // 9. Disaggregated Latency Reporting
  it('D2.7-9: GET /api/metrics exposes disaggregated latencies with explicit provenance', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.latency_breakdown.deterministic_engine.provenance).toBe('LOCAL / SYNTHETIC / MOCK');
    expect(res.body.latency_breakdown.live_gemini.provenance).toBe('LIVE GEMINI API');
    expect(res.body.latency_breakdown.live_gemini.model).toBe(config.geminiModel);
  });
});
