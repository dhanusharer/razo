import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { RecoveryRelay } from '../src/recovery/recoveryRelay.js';
import { DEFAULT_TEST_MANDATE } from '../src/commerce/mandate.js';
import { config } from '../src/config.js';

describe('D1 — Demo API & Read-Only Product Surface', () => {
  beforeEach(() => {
    transactionStore.reset();
  });

  // 1. GET /api/recovery/demo-fixture
  it('D1-1: GET /api/recovery/demo-fixture returns golden-path demo fixture', async () => {
    const res = await request(app).get('/api/recovery/demo-fixture');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBe('DEMO_FIXTURE');
    expect(res.body.transaction_id).toBe('txn_demo_golden_recovery_001');
    expect(res.body.original_product.id).toBe('ADIDAS-RUN-01');
    expect(res.body.selected_substitute.id).toBe('ADIDAS-RUN-02');
    expect(res.body.original_price_inr).toBe(4900);
    expect(res.body.recovered_price_inr).toBe(5200);
    expect(res.body.price_delta_inr).toBe(300);
    expect(res.body.price_delta_percent).toBe(6.12);
    expect(res.body.policy_result).toBe('PASS');
    expect(res.body.revalidation_result).toBe('PASS');
    expect(res.body.recovery_outcome).toBe('VALID_SUBSTITUTE');
    expect(res.body.decision_type).toBe('AUTONOMOUS_RECOVERY');
  });

  // 2. GET /api/recovery/:transactionId
  it('D1-2: GET /api/recovery/:transactionId returns structured recovery details', async () => {
    const recoveryResult = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const txnId = recoveryResult.recovered_transaction_id!;
    const res = await request(app).get(`/api/recovery/${txnId}`);

    expect(res.status).toBe(200);
    expect(res.body.transaction_id).toBe(txnId);
    expect(res.body.selected_substitute?.id).toBe('ADIDAS-RUN-02');
    expect(res.body.recovered_price_inr).toBe(5200);
    expect(res.body.policy_result).toBe('PASS');
    expect(res.body.provenance).toBeDefined();
    expect(res.body.policy_id).toBeDefined();
  });

  // 3. GET /api/recovery/:transactionId (Not Found)
  it('D1-3: GET /api/recovery/:transactionId returns 404 for unknown transaction', async () => {
    const res = await request(app).get('/api/recovery/txn_non_existent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Transaction not found');
  });

  // 4. GET /api/recovery/:transactionId/events
  it('D1-4: GET /api/recovery/:transactionId/events returns chronological event stream', async () => {
    const recoveryResult = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const txnId = recoveryResult.recovered_transaction_id!;
    const res = await request(app).get(`/api/recovery/${txnId}/events`);

    expect(res.status).toBe(200);
    expect(res.body.transaction_id).toBe(txnId);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.total_events).toBeGreaterThan(0);

    // Verify ordering
    const events = res.body.events;
    for (let i = 1; i < events.length; i++) {
      expect(new Date(events[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(events[i - 1].timestamp).getTime()
      );
    }
  });

  // 5. GET /api/policy
  it('D1-5: GET /api/policy returns active policy and effective rules', async () => {
    const res = await request(app).get('/api/policy');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBe('LIVE');
    expect(res.body.active_policy).toBeDefined();
    expect(res.body.active_policy.policy_id).toBe('pol_default_merchant_v1');
    expect(res.body.effective_rules).toBeDefined();
    expect(res.body.effective_rules.max_budget).toBe(5500);
    expect(res.body.effective_rules.minimum_margin_percent).toBe(10);
  });

  // 6. GET /api/catalog
  it('D1-6: GET /api/catalog returns safe product list with margin metadata', async () => {
    const res = await request(app).get('/api/catalog');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBe('LIVE');
    expect(res.body.total_products).toBe(6);
    expect(Array.isArray(res.body.products)).toBe(true);

    const p = res.body.products.find((item: any) => item.id === 'ADIDAS-RUN-02');
    expect(p).toBeDefined();
    expect(p.price_inr).toBe(5200);
    expect(p.cost_inr).toBe(3900);
    expect(p.margin_inr).toBe(1300);
    expect(p.margin_percent).toBe(25.0);
  });

  // 7. GET /api/metrics
  it('D1-7: GET /api/metrics returns authoritative business metrics', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBeDefined();
    expect(res.body.unauthorized_transactions).toBe(0);
    expect(res.body.failure_breakdown).toBeDefined();
    expect(res.body.margin_metrics).toBeDefined();
  });

  // 8. Security Invariant: Zero Secret Leakage across all endpoints
  it('D1-8: Asserts ZERO secret leakage across all read-only API surfaces', async () => {
    const endpoints = [
      '/api/recovery/demo-fixture',
      '/api/policy',
      '/api/catalog',
      '/api/metrics',
      '/api/events',
      '/api/status'
    ];

    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      const text = JSON.stringify(res.body);
      if (config.razorpayKeySecret) {
        expect(text).not.toContain(config.razorpayKeySecret);
      }
      if (config.razorpayWebhookSecret) {
        expect(text).not.toContain(config.razorpayWebhookSecret);
      }
      if (config.geminiApiKey) {
        expect(text).not.toContain(config.geminiApiKey);
      }
    }
  });

  // 9. Area C Ledger Mapping: Original vs Substitute Product Resolution
  it('D1-9: GET /api/recovery/:id resolves original product and substitute via supersedes_transaction_id', async () => {
    // Execute mock recovery
    const evalRes = await request(app)
      .post('/api/recovery/evaluate')
      .send({
        user_intent: 'Buy me Adidas running shoes, size 10, under ₹5,500.',
        original_product_id: 'ADIDAS-RUN-01',
        simulate_initial_oos: true
      });

    expect(evalRes.status).toBe(200);
    const recTxnId = evalRes.body.recovered_transaction_id;
    expect(recTxnId).toBeDefined();

    // Fetch detail view
    const detailRes = await request(app).get(`/api/recovery/${recTxnId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.original_product).toBeDefined();
    expect(detailRes.body.original_product.id).toBe('ADIDAS-RUN-01');
    expect(detailRes.body.original_product.name).toBe('Adidas Boston 12');
    expect(detailRes.body.original_product.price_inr).toBe(4900);

    expect(detailRes.body.failure_type).toBe('OUT_OF_STOCK');

    expect(detailRes.body.selected_substitute).toBeDefined();
    expect(detailRes.body.selected_substitute.id).toBe('ADIDAS-RUN-02');
    expect(detailRes.body.selected_substitute.name).toBe('Adidas Adizero SL2');
    expect(detailRes.body.selected_substitute.price_inr).toBe(5200);

    expect(detailRes.body.price_delta_inr).toBe(300);
    expect(detailRes.body.price_delta_percent).toBe(6.12);
  });
});
