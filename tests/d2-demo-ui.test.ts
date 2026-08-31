import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { config } from '../src/config.js';

describe('D2 — Single-Page Merchant Demo Experience & Data Integrity', () => {
  beforeEach(() => {
    transactionStore.reset();
  });

  // 1. Static UI Entrypoint Serving
  it('D2-1: GET /index.html serves the single-page merchant demo experience', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Resilient-Agent-Relay');
    expect(res.text).toContain('View 1 — Merchant Business Overview');
    expect(res.text).toContain('View 2 — Live Recovery Console');
    expect(res.text).toContain('View 3 — Recovery Details & Audit Ledger');
    expect(res.text).toContain('btn-run-golden');
    expect(res.text).toContain('btn-run-escalation');
  });

  // 2. View 1 Data Integration (GET /api/metrics)
  it('D2-2: GET /api/metrics provides complete data foundation for View 1', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.recovered_gmv_inr).toBeDefined();
    expect(res.body.recovery_rate).toBeDefined();
    expect(res.body.unauthorized_transactions).toBe(0);
    expect(res.body.margin_metrics).toBeDefined();
    expect(res.body.provenance).toBeDefined();
  });

  // 3. View 2 Demo Fixture Integration (GET /api/recovery/demo-fixture)
  it('D2-3: GET /api/recovery/demo-fixture populates View 2 pipeline and View 3 details', async () => {
    const res = await request(app).get('/api/recovery/demo-fixture');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBe('DEMO_FIXTURE');
    expect(res.body.original_product.name).toBe('Adidas Boston 12');
    expect(res.body.selected_substitute.name).toBe('Adidas Adizero SL2');
    expect(res.body.policy_result).toBe('PASS');
    expect(res.body.final_state).toBe('PAID');
  });

  // 4. Safe Escalation Flow (Deterministic Policy Block & Zero Orders)
  it('D2-4: Safe Escalation action triggers deterministic policy block with zero Razorpay orders', async () => {
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
    expect(res.body.reasons?.some((r: string) => r.includes('exceeds allowed effective maximum') || r.includes('exceeds maximum budget'))).toBe(true);
  });

  // 5. Active Policy & Effective Constraints Integration (GET /api/policy)
  it('D2-5: GET /api/policy provides active policy rules for merchant inspection', async () => {
    const res = await request(app).get('/api/policy');
    expect(res.status).toBe(200);
    expect(res.body.active_policy.policy_id).toBe('pol_default_merchant_v1');
    expect(res.body.effective_rules.auto_recovery_enabled).toBe(true);
    expect(res.body.effective_rules.max_recovery_attempts).toBe(2);
  });

  // 6. Security Check: Zero Secret Leakage in UI & Responses
  it('D2-6: Asserts zero secret leakage in static HTML and API endpoints', async () => {
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

  // 7. D2.5: Disaggregated Latency Verification
  it('D2-7: GET /api/metrics clearly separates deterministic engine latency from live Gemini latency', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.latency_breakdown).toBeDefined();

    // 1. Deterministic Engine Latency
    const engineLatency = res.body.latency_breakdown.deterministic_engine;
    expect(engineLatency).toBeDefined();
    expect(engineLatency.p50_ms).toBeDefined();
    expect(engineLatency.p95_ms).toBeDefined();
    expect(engineLatency.provenance).toBe('LOCAL / SYNTHETIC / MOCK');

    // 2. Live Gemini Decision Latency
    const geminiLatency = res.body.latency_breakdown.live_gemini;
    expect(geminiLatency).toBeDefined();
    expect(geminiLatency.p50_ms).toBe(6257);
    expect(geminiLatency.p95_ms).toBe(7110);
    expect(geminiLatency.model).toBeDefined();
    expect(geminiLatency.provenance).toBe('LIVE GEMINI API');
  });

  // 8. D2.5: Provenance Labels Verification across UI Surface
  it('D2-8: HTML and UI surface contain explicit provenance badges without mixing sources', async () => {
    const res = await request(app).get('/index.html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SYNTHETIC BENCHMARK');
    expect(res.text).toContain('LIVE TEST MODE');
    expect(res.text).toContain('DEMO_FIXTURE');
    expect(res.text).toContain('LOCAL / SYNTHETIC / MOCK');
    expect(res.text).toContain('LIVE GEMINI API');
    expect(res.text).toContain('Deterministic Engine Latency');
    expect(res.text).toContain('Live Gemini Decision Latency');
  });
});
