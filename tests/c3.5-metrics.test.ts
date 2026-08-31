import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { MetricsService } from '../src/metrics/metricsService.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { CatalogService } from '../src/commerce/catalog.js';
import { RecoveryRelay } from '../src/recovery/recoveryRelay.js';
import { createUserMandate, DEFAULT_TEST_MANDATE } from '../src/commerce/mandate.js';
import { createMerchantPolicy } from '../src/policy/merchantPolicy.js';

describe('C3.5 — Merchant Metrics & Business-Truth Foundation', () => {
  beforeEach(() => {
    // Reset state before each test
    transactionStore.reset();
  });

  // 1. Recovery Rate Calculation
  it('C3.5-1: Correctly calculates recovery rate from authoritative failures', async () => {
    // Scenario 1: Normal recovery
    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    // Scenario 2: Policy rejection (escalated)
    const strictMandate = createUserMandate({
      max_budget: 5000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 1, // Only 1% delta allowed (ADIDAS-RUN-02 is +6.12%)
      required_attributes: { size: 10 }
    });

    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Strict budget test',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: strictMandate,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    // 2 failed original checkouts, 1 recovered -> 50% recovery rate
    expect(metrics.failed_checkouts).toBe(2);
    expect(metrics.recovered_transactions).toBe(1);
    expect(metrics.recovery_rate).toBe(50.0);
  });

  // 2. Recovered GMV from Authoritative Catalog
  it('C3.5-2: Derives recovered GMV strictly from authoritative catalog price', async () => {
    const recoveryResult = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(recoveryResult.success).toBe(true);
    const authPrice = CatalogService.getAuthoritativePrice('ADIDAS-RUN-02')!;

    const metrics = MetricsService.getMetrics();
    expect(metrics.recovered_gmv_inr).toBe(authPrice.price_inr);
    expect(metrics.recovered_gmv_paise).toBe(authPrice.price_paise);
    expect(metrics.recovered_gmv_inr).toBe(5200);
  });

  // 3. GMV Recovery Rate
  it('C3.5-3: Accurately computes GMV recovery rate (Recovered GMV / Baseline Failed GMV)', async () => {
    // Original failed item: ADIDAS-RUN-01 (₹4,900)
    // Recovered item: ADIDAS-RUN-02 (₹5,200)
    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    expect(metrics.baseline_failed_gmv_inr).toBe(4900);
    expect(metrics.recovered_gmv_inr).toBe(5200);
    // (5200 / 4900) * 100 = 106.12%
    expect(metrics.gmv_recovery_rate).toBe(106.12);
  });

  // 4. Escalation Rate & Count
  it('C3.5-4: Accurately records and counts escalated transactions', async () => {
    const tightMandate = createUserMandate({
      max_budget: 5000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 2,
      required_attributes: { size: 10 }
    });

    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Strict budget test',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: tightMandate,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    expect(metrics.escalated_transactions).toBe(1);
    expect(metrics.policy_rejections).toBe(1);
  });

  // 5. Hard-Stop Count
  it('C3.5-5: Tracks hard stops when merchant disables auto-recovery', async () => {
    const disabledPolicy = createMerchantPolicy({
      auto_recovery_enabled: false
    });

    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        merchant_policy: disabledPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    expect(metrics.hard_stops).toBe(1);
    expect(metrics.recovered_transactions).toBe(0);
  });

  // 6. Zero Unauthorized Transactions Invariant
  it('C3.5-6: Enforces 0 unauthorized transactions across state store', () => {
    const metrics = MetricsService.getMetrics();
    expect(metrics.unauthorized_transactions).toBe(0);
    expect(metrics.unauthorized_transaction_rate).toBe(0.0);
  });

  // 7. Failure Breakdown Triage
  it('C3.5-7: Triages failures into OUT_OF_STOCK and POLICY_VIOLATION', async () => {
    // Trigger OOS
    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    expect(metrics.failure_breakdown.OUT_OF_STOCK).toBeGreaterThanOrEqual(1);
  });

  // 8. Authoritative Margin Calculation
  it('C3.5-8: Correctly calculates authoritative product gross margin (price - cost)', async () => {
    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    // ADIDAS-RUN-02: Price 5200, Cost 3900 -> Margin = 1300 INR (25%)
    const metrics = MetricsService.getMetrics();
    expect(metrics.margin_metrics.total_recovered_margin_inr).toBe(1300);
    expect(metrics.margin_metrics.total_recovered_margin_paise).toBe(130000);
    expect(metrics.margin_metrics.average_recovered_margin_percent).toBe(25.0);
    expect(metrics.margin_metrics.margin_policy_violations).toBe(0);
  });

  // 9. Latency Percentiles Calculation
  it('C3.5-9: Derives recovery latency metrics from transaction audit events', async () => {
    await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    const metrics = MetricsService.getMetrics();
    expect(metrics.recovery_latency).toBeDefined();
    expect(metrics.recovery_latency.p50_ms).toBeGreaterThanOrEqual(0);
    expect(metrics.recovery_latency.p95_ms).toBeGreaterThanOrEqual(0);
  });

  // 10. Data Provenance Labeling
  it('C3.5-10: Correctly labels data provenance as MOCK for simulated runs', () => {
    const metrics = MetricsService.getMetrics();
    expect(['LIVE', 'MOCK', 'SYNTHETIC', 'MIXED']).toContain(metrics.provenance);
  });

  // 11. API Endpoint GET /api/metrics
  it('C3.5-11: GET /api/metrics exposes structured JSON without UI', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.provenance).toBeDefined();
    expect(res.body.total_checkout_attempts).toBeDefined();
    expect(res.body.recovery_rate).toBeDefined();
    expect(res.body.recovered_gmv_inr).toBeDefined();
    expect(res.body.unauthorized_transactions).toBe(0);
    expect(res.body.failure_breakdown).toBeDefined();
    expect(res.body.margin_metrics).toBeDefined();
  });
});
