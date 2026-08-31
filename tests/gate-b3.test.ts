import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import {
  CatalogService,
  InventorySimulator,
  inventorySimulator,
  createUserMandate,
  DEFAULT_TEST_MANDATE
} from '../src/commerce/index.js';
import { RecoveryRelay } from '../src/recovery/index.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { verifyWebhookSignature, processWebhookEvent, RazorpayWebhookPayload } from '../src/razorpay/webhookVerifier.js';
import { config } from '../src/config.js';
import crypto from 'crypto';

const WEBHOOK_SECRET = 'test_webhook_secret_gate_b3';
const KEY_SECRET = 'test_key_secret_gate_b3';

function makeRawBody(payload: object): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

function sign(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function makeCapturedWebhookPayload(orderId: string, paymentId: string): RazorpayWebhookPayload {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: 520000,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  };
}

describe('GATE B3 — Resilient Transaction Recovery Integration', () => {
  beforeEach(() => {
    inventorySimulator.reset();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-1: Normal checkout remains successful when in stock
  // ─────────────────────────────────────────────────────────────
  it('B3-1: Normal checkout remains successful when product is in stock', async () => {
    expect(inventorySimulator.isAvailable('ADIDAS-RUN-01')).toBe(true);

    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Standard purchase',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: DEFAULT_TEST_MANDATE,
      simulate_initial_oos: false
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe('ORIGINAL_IN_STOCK');
    expect(result.status).toBe('CHECKOUT_STARTED');
  });

  // ─────────────────────────────────────────────────────────────
  // B3-2: OOS -> valid substitute -> policy pass -> recovery decision
  // ─────────────────────────────────────────────────────────────
  it('B3-2: OOS -> valid substitute (ADIDAS-RUN-02) -> policy pass -> recovery decision', async () => {
    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'I need size 10 Adidas running shoes for training',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: DEFAULT_TEST_MANDATE,
      soft_preferences: { performance_priority: 'high' },
      simulate_initial_oos: true
    });

    expect(result.success).toBe(true);
    expect(result.outcome).toBe('VALID_SUBSTITUTE');
    expect(result.status).toBe('NEW_ORDER_CREATED');
    expect(result.selected_product_id).toBe('ADIDAS-RUN-02');
    expect(result.authoritative_price_inr).toBe(5200);
    expect(result.authoritative_price_paise).toBe(520000);
    expect(result.razorpay_order).toBeDefined();
    expect(result.recovered_transaction_id).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-3: OOS -> price tolerance violation -> policy rejection
  // ─────────────────────────────────────────────────────────────
  it('B3-3: OOS -> price tolerance violation -> policy rejection (no order created)', async () => {
    // Mandate with 2% max price delta (original ₹4,900 -> max ₹4,998)
    const tightDeltaMandate = createUserMandate({
      max_budget: 6000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 2,
      required_attributes: { size: 10 }
    });

    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Find replacement',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: tightDeltaMandate,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('SUBSTITUTE_OUTSIDE_MANDATE');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.razorpay_order).toBeUndefined();
    expect(result.recovered_transaction_id).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-4: OOS -> brand violation -> policy rejection
  // ─────────────────────────────────────────────────────────────
  it('B3-4: OOS -> brand violation -> policy rejection (no order created)', async () => {
    const pumaOnlyMandate = createUserMandate({
      max_budget: 6000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Puma'],
      max_price_delta_percent: 20,
      required_attributes: { size: 10 }
    });

    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Find replacement',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: pumaOnlyMandate,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('SUBSTITUTE_OUTSIDE_MANDATE');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.razorpay_order).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-5: OOS -> size/attribute violation -> policy rejection
  // ─────────────────────────────────────────────────────────────
  it('B3-5: OOS -> size/attribute violation -> policy rejection (no order created)', async () => {
    const size12Mandate = createUserMandate({
      max_budget: 6000,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 20,
      required_attributes: { size: 12 } // Size 12 not in catalog
    });

    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Find replacement in size 12',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: size12Mandate,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('SUBSTITUTE_OUTSIDE_MANDATE');
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.reasons?.some((r) => r.includes('size'))).toBe(true);
    expect(result.razorpay_order).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-6: Valid candidate becomes OOS during revalidation -> rejection
  // ─────────────────────────────────────────────────────────────
  it('B3-6: Valid candidate becomes OOS during revalidation -> rejection (zero Razorpay orders)', async () => {
    const customInv = new InventorySimulator();
    // Simulate initial OOS on original, and make candidate ADIDAS-RUN-02 also OOS
    customInv.setStock('ADIDAS-RUN-01', 0);
    customInv.setStock('ADIDAS-RUN-02', 0);

    const result = await RecoveryRelay.executeRecovery(
      {
        user_intent: 'Find alternative',
        original_product_id: 'ADIDAS-RUN-01',
        mandate: DEFAULT_TEST_MANDATE,
        simulate_initial_oos: true
      },
      { inventory: customInv }
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('POLICY_REJECTED');
    expect(result.razorpay_order).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-7: Invalid candidate never causes Razorpay Order creation
  // ─────────────────────────────────────────────────────────────
  it('B3-7: Invalid candidate never causes Razorpay Order creation', async () => {
    const zeroBudgetMandate = createUserMandate({
      max_budget: 100,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Need shoes',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: zeroBudgetMandate,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(false);
    expect(result.razorpay_order).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // B3-8: Valid recovery creates a NEW Order rather than modifying old order
  // ─────────────────────────────────────────────────────────────
  it('B3-8: Valid recovery creates a NEW Order and supersedes initial attempt', async () => {
    const initialTxn = transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: 'rcpt_initial_b3_8',
      product_id: 'ADIDAS-RUN-01'
    });

    const result = await RecoveryRelay.executeRecovery({
      initial_transaction_id: initialTxn.internal_transaction_id,
      user_intent: 'Need running shoes size 10',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: DEFAULT_TEST_MANDATE,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(true);
    expect(result.original_transaction_id).toBe(initialTxn.internal_transaction_id);
    expect(result.recovered_transaction_id).toBeDefined();
    expect(result.recovered_transaction_id).not.toBe(initialTxn.internal_transaction_id);

    // Verify initial transaction status is SUPERSEDED_UNPAID
    const updatedInitial = transactionStore.getTransaction(initialTxn.internal_transaction_id);
    expect(updatedInitial?.status).toBe('SUPERSEDED_UNPAID');
    expect(updatedInitial?.recovered_by_transaction_id).toBe(result.recovered_transaction_id);

    // Verify recovered transaction status is NEW_ORDER_CREATED
    const recoveredTxn = transactionStore.getTransaction(result.recovered_transaction_id!);
    expect(recoveredTxn?.status).toBe('NEW_ORDER_CREATED');
    expect(recoveredTxn?.supersedes_transaction_id).toBe(initialTxn.internal_transaction_id);
    expect(recoveredTxn?.amount_paise).toBe(520000);
  });

  // ─────────────────────────────────────────────────────────────
  // B3-9: Recovered payment can reach PAID only through verified payment.captured
  // ─────────────────────────────────────────────────────────────
  it('B3-9: Recovered payment reaches PAID only through verified payment.captured webhook', async () => {
    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Need running shoes size 10',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: DEFAULT_TEST_MANDATE,
      simulate_initial_oos: true
    });

    expect(result.success).toBe(true);
    const recoveredTxnId = result.recovered_transaction_id!;
    const orderId = result.razorpay_order!.id;
    const paymentId = `pay_rec_${Date.now()}`;
    const eventId = `evt_rec_${Date.now()}`;

    // Confirm state is NEW_ORDER_CREATED prior to webhook
    expect(transactionStore.getTransaction(recoveredTxnId)?.status).toBe('NEW_ORDER_CREATED');

    // Simulate verified webhook delivery
    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw = makeRawBody(payload);
    const sig = sign(raw, WEBHOOK_SECRET);

    const origSecret = config.razorpayWebhookSecret;
    config.razorpayWebhookSecret = WEBHOOK_SECRET;

    try {
      const webhookResult = processWebhookEvent({
        rawBody: raw,
        signature: sig,
        webhookEventId: eventId,
        parsedPayload: payload
      });

      expect(webhookResult.status).toBe('ACCEPTED');
      expect(webhookResult.statusCode).toBe(200);

      // Verify authoritative PAID state set on recovered transaction
      const finalTxn = transactionStore.getTransaction(recoveredTxnId);
      expect(finalTxn?.status).toBe('PAID');
      expect(finalTxn?.razorpay_payment_id).toBe(paymentId);
    } finally {
      config.razorpayWebhookSecret = origSecret;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // B3-10: Existing webhook idempotency remains intact on recovered transactions
  // ─────────────────────────────────────────────────────────────
  it('B3-10: Existing webhook idempotency remains intact on recovered transactions', async () => {
    const result = await RecoveryRelay.executeRecovery({
      user_intent: 'Need running shoes size 10',
      original_product_id: 'ADIDAS-RUN-01',
      mandate: DEFAULT_TEST_MANDATE,
      simulate_initial_oos: true
    });

    const recoveredTxnId = result.recovered_transaction_id!;
    const orderId = result.razorpay_order!.id;
    const paymentId = `pay_dup_${Date.now()}`;
    const eventId = `evt_dup_${Date.now()}`;

    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw = makeRawBody(payload);
    const sig = sign(raw, WEBHOOK_SECRET);

    const origSecret = config.razorpayWebhookSecret;
    config.razorpayWebhookSecret = WEBHOOK_SECRET;

    try {
      // First webhook delivery
      const r1 = processWebhookEvent({
        rawBody: raw,
        signature: sig,
        webhookEventId: eventId,
        parsedPayload: payload
      });
      expect(r1.status).toBe('ACCEPTED');

      // Second webhook delivery (same event ID)
      const r2 = processWebhookEvent({
        rawBody: raw,
        signature: sig,
        webhookEventId: eventId,
        parsedPayload: payload
      });
      expect(r2.status).toBe('DUPLICATE_IGNORED');
      expect(r2.statusCode).toBe(200);

      // State remains PAID with zero duplicate transitions
      expect(transactionStore.getTransaction(recoveredTxnId)?.status).toBe('PAID');
    } finally {
      config.razorpayWebhookSecret = origSecret;
    }
  });
});
