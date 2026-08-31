import { describe, it, expect, vi } from 'vitest';
import { RecoveryRelay } from '../src/recovery/recoveryRelay.js';
import { DEFAULT_TEST_MANDATE, createUserMandate } from '../src/commerce/mandate.js';
import { InventorySimulator } from '../src/commerce/inventorySimulator.js';
import { LLMProvider } from '../src/agent/providers/types.js';
import { LLMEvaluationInput, LLMEvaluationResult } from '../src/commerce/types.js';
import * as razorpayAdapter from '../src/razorpay/razorpayAdapter.js';

describe('C2 — Recovery Intelligence, Timeout Boundary & Safety Invariants', () => {
  it('C2-1: Enforces bounded timeout with safe escalation when LLM exceeds budget', async () => {
    // Provider that simulates hanging/slow response
    class SlowHangingProvider implements LLMProvider {
      public readonly name = 'Slow Hanging Mock Provider';
      public readonly isMock = true;

      public async evaluate(input: LLMEvaluationInput): Promise<LLMEvaluationResult> {
        // Sleep for 300ms
        await new Promise((r) => setTimeout(r, 300));
        throw new Error('RECOVERY_TIMEOUT: Live LLM evaluation timed out after 100ms');
      }
    }

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Need running shoes urgently',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { provider: new SlowHangingProvider() }
    );

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('RECOVERY_TIMEOUT');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.razorpay_order).toBeUndefined();
    expect(result.recovered_transaction_id).toBeUndefined();
    expect(result.reasons?.[0]).toContain('timed out');
  });

  it('C2-2: Financial Safety Invariant: createOrder is never invoked if policy is not PASS', async () => {
    const createOrderSpy = vi.spyOn(razorpayAdapter, 'createRazorpayOrder');
    createOrderSpy.mockClear();

    // Mandate with 1% price tolerance (all candidates fail)
    const tightMandate = createUserMandate({
      max_budget: 5000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 1,
      required_attributes: { size: 10 }
    });

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Strict budget test',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: tightMandate,
        simulate_initial_oos: true
      },
      { forceMock: true }
    );

    expect(result.success).toBe(false);
    expect(result.policy_decision?.status).toBe('FAIL');
    expect(createOrderSpy).toHaveBeenCalledTimes(0);
    expect(result.razorpay_order).toBeUndefined();

    createOrderSpy.mockRestore();
  });
});
