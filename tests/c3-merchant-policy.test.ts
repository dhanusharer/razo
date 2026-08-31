import { describe, it, expect, vi } from 'vitest';
import { RecoveryRelay } from '../src/recovery/recoveryRelay.js';
import { createUserMandate, DEFAULT_TEST_MANDATE } from '../src/commerce/mandate.js';
import { createMerchantPolicy, DEFAULT_MERCHANT_POLICY, resolveEffectivePolicy } from '../src/policy/merchantPolicy.js';
import { PolicyEngine } from '../src/policy/policyEngine.js';
import { CatalogService } from '../src/commerce/catalog.js';
import { LLMProvider } from '../src/agent/providers/types.js';
import { LLMEvaluationInput, LLMEvaluationResult } from '../src/commerce/types.js';
import * as razorpayAdapter from '../src/razorpay/razorpayAdapter.js';

describe('C3 — Merchant Recovery Control Plane & Authority Precedence', () => {
  const originalProduct = CatalogService.getProduct('ADIDAS-RUN-01')!;

  // 1. User allows + merchant allows -> PASS
  it('C3-1: User allows + merchant allows -> PASS', async () => {
    const userMandate = createUserMandate({
      max_budget: 5500,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const merchantPolicy = createMerchantPolicy({
      max_recovery_amount_inr: 5400,
      max_substitution_price_delta_percent: 8,
      allowed_brands: ['Adidas'],
      allowed_categories: ['running_shoes']
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need size 10 Adidas running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: userMandate,
        merchant_policy: merchantPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(true);
    expect(result.decision_type).toBe('AUTONOMOUS_RECOVERY');
    expect(result.status).toBe('NEW_ORDER_CREATED');
    expect(result.selected_product_id).toBe('ADIDAS-RUN-02');
  });

  // 2. User allows + merchant restricts -> merchant restriction wins
  it('C3-2: User allows + merchant restricts -> merchant restriction wins (Price Delta)', async () => {
    const userMandate = createUserMandate({
      max_budget: 5500,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10, // User allows 10%
      required_attributes: { size: 10 }
    });

    const restrictiveMerchantPolicy = createMerchantPolicy({
      max_substitution_price_delta_percent: 4 // Merchant only allows 4% (ADIDAS-RUN-02 is +6.12%)
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: userMandate,
        merchant_policy: restrictiveMerchantPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.decision_type).toBe('ESCALATION_REQUIRED');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.reasons?.some((r) => r.includes('exceeds allowed effective maximum'))).toBe(true);
  });

  // 3. User blocks + merchant allows -> BLOCK (User authority cannot be expanded)
  it('C3-3: User blocks + merchant allows -> BLOCK (User authority cannot be expanded)', () => {
    const strictUserMandate = createUserMandate({
      max_budget: 5000, // User limits to 5000
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 2, // User limits to 2%
      required_attributes: { size: 10 }
    });

    const generousMerchantPolicy = createMerchantPolicy({
      max_recovery_amount_inr: 10000,
      max_substitution_price_delta_percent: 50,
      allowed_brands: ['Adidas', 'Nike', 'Puma']
    });

    const effective = resolveEffectivePolicy(strictUserMandate, generousMerchantPolicy);

    expect(effective.effective_max_budget).toBe(5000);
    expect(effective.effective_max_price_delta_percent).toBe(2);
    expect(effective.effective_allowed_brands).toEqual(['Adidas']); // Nike/Puma filtered out

    const policyCheck = PolicyEngine.evaluate({
      selected_product_id: 'ADIDAS-RUN-02', // 5200 INR (+6.12%)
      original_product: originalProduct,
      mandate: strictUserMandate,
      merchant_policy: generousMerchantPolicy
    });

    expect(policyCheck.status).toBe('FAIL');
  });

  // 4. Brand mismatch -> BLOCK
  it('C3-4: Brand excluded by merchant policy -> BLOCK', async () => {
    const userMandate = createUserMandate({
      max_budget: 5500,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas', 'Nike'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const merchantPolicy = createMerchantPolicy({
      allowed_brands: ['Puma'] // Merchant does not allow Adidas or Nike
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: userMandate,
        merchant_policy: merchantPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.decision_type).toBe('ESCALATION_REQUIRED');
    expect(result.reasons?.some((r) => r.includes('Brand') && r.includes('not permitted'))).toBe(true);
  });

  // 5. Category mismatch -> BLOCK
  it('C3-5: Category excluded by merchant policy -> BLOCK', async () => {
    const userMandate = createUserMandate({
      max_budget: 5500,
      allowed_categories: ['running_shoes', 'lifestyle'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const merchantPolicy = createMerchantPolicy({
      allowed_categories: ['apparel'] // Only apparel allowed by merchant
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: userMandate,
        merchant_policy: merchantPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.decision_type).toBe('ESCALATION_REQUIRED');
    expect(result.reasons?.some((r) => r.includes('Category') && r.includes('not permitted'))).toBe(true);
  });

  // 6. Price exceeds user limit -> BLOCK
  it('C3-6: Price exceeds user budget -> BLOCK', () => {
    const userMandate = createUserMandate({
      max_budget: 5100, // Budget lower than ADIDAS-RUN-02 (5200)
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const policyCheck = PolicyEngine.evaluate({
      selected_product_id: 'ADIDAS-RUN-02',
      original_product: originalProduct,
      mandate: userMandate
    });

    expect(policyCheck.status).toBe('FAIL');
    expect(policyCheck.reasons.some((r) => r.includes('exceeds maximum budget'))).toBe(true);
  });

  // 7. Price exceeds merchant limit -> BLOCK
  it('C3-7: Price exceeds merchant max recovery amount -> BLOCK', () => {
    const userMandate = createUserMandate({
      max_budget: 6000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const merchantPolicy = createMerchantPolicy({
      max_recovery_amount_inr: 5100 // Merchant cap is 5100 (ADIDAS-RUN-02 is 5200)
    });

    const policyCheck = PolicyEngine.evaluate({
      selected_product_id: 'ADIDAS-RUN-02',
      original_product: originalProduct,
      mandate: userMandate,
      merchant_policy: merchantPolicy
    });

    expect(policyCheck.status).toBe('FAIL');
    expect(policyCheck.reasons.some((r) => r.includes('exceeds maximum budget'))).toBe(true);
  });

  // 8. Minimum margin violation -> BLOCK
  it('C3-8: Minimum margin violation -> BLOCK', () => {
    const highMarginPolicy = createMerchantPolicy({
      minimum_margin_percent: 30 // Catalog default margin is 25%
    });

    const policyCheck = PolicyEngine.evaluate({
      selected_product_id: 'ADIDAS-RUN-02',
      original_product: originalProduct,
      mandate: DEFAULT_TEST_MANDATE,
      merchant_policy: highMarginPolicy
    });

    expect(policyCheck.status).toBe('FAIL');
    expect(policyCheck.reasons.some((r) => r.includes('below merchant minimum margin'))).toBe(true);
  });

  // 9. Max recovery attempts exceeded -> ESCALATION_REQUIRED
  it('C3-9: Max recovery attempts exceeded -> ESCALATION_REQUIRED', async () => {
    const merchantPolicy = createMerchantPolicy({
      max_recovery_attempts: 2
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        merchant_policy: merchantPolicy,
        recovery_attempt: 3, // Attempt 3 > max 2
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(result.decision_type).toBe('ESCALATION_REQUIRED');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.razorpay_order).toBeUndefined();
  });

  // 10. LLM timeout -> safe escalation
  it('C3-10: LLM timeout produces safe escalation with zero orders', async () => {
    class TimeoutProvider implements LLMProvider {
      public readonly name = 'Timeout Mock Provider';
      public readonly isMock = true;
      public async evaluate(input: LLMEvaluationInput): Promise<LLMEvaluationResult> {
        throw new Error('RECOVERY_TIMEOUT: Live LLM evaluation timed out');
      }
    }

    const createOrderSpy = vi.spyOn(razorpayAdapter, 'createRazorpayOrder');
    createOrderSpy.mockClear();

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { provider: new TimeoutProvider() }
    );

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('RECOVERY_TIMEOUT');
    expect(result.decision_type).toBe('ESCALATION_REQUIRED');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(createOrderSpy).toHaveBeenCalledTimes(0);
    expect(result.razorpay_order).toBeUndefined();

    createOrderSpy.mockRestore();
  });

  // 11. Policy ID and version recorded on transaction and audit events
  it('C3-11: Records policy ID and version on successful recovery', async () => {
    const customPolicy = createMerchantPolicy({
      policy_id: 'pol_acme_sports_v3',
      policy_version: 3
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        merchant_policy: customPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(true);
    expect(result.merchant_policy_id).toBe('pol_acme_sports_v3');
    expect(result.merchant_policy_version).toBe(3);
    expect(result.effective_constraints).toBeDefined();
    expect(result.effective_constraints?.max_budget).toBe(5500);
  });

  // 12. Merchant disabled auto-recovery -> HARD_STOP
  it('C3-12: Merchant disabled auto-recovery -> HARD_STOP', async () => {
    const disabledPolicy = createMerchantPolicy({
      auto_recovery_enabled: false
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        merchant_policy: disabledPolicy,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('AUTO_RECOVERY_DISABLED');
    expect(result.decision_type).toBe('HARD_STOP');
    expect(result.status).toBe('RECOVERY_EXHAUSTED');
  });
});
