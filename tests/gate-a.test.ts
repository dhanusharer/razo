import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { verifyWebhookSignature, processWebhookEvent, RazorpayWebhookPayload } from '../src/razorpay/webhookVerifier.js';
import { verifyCheckoutCallbackSignature, validateOrderInput } from '../src/razorpay/razorpayAdapter.js';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test_webhook_secret_gate_a';
const KEY_SECRET     = 'test_key_secret_gate_a';

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
          amount: 490000,
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: creates a store wired to the webhook verifier
// We override config to inject test secrets
// ─────────────────────────────────────────────────────────────

import { config } from '../src/config.js';

function withTestConfig<T>(fn: () => T): T {
  const origSecret = config.razorpayWebhookSecret;
  const origKeySecret = config.razorpayKeySecret;
  config.razorpayWebhookSecret = WEBHOOK_SECRET;
  config.razorpayKeySecret = KEY_SECRET;
  try {
    return fn();
  } finally {
    config.razorpayWebhookSecret = origSecret;
    config.razorpayKeySecret = origKeySecret;
  }
}

// ─────────────────────────────────────────────────────────────
// TEST A1: Valid webhook signature is accepted
// ─────────────────────────────────────────────────────────────
describe('TEST A1 — Valid webhook signature is accepted', () => {
  it('should return valid:true for correctly signed raw body', () => {
    const raw = makeRawBody({ event: 'payment.captured' });
    const sig = sign(raw, WEBHOOK_SECRET);

    const result = withTestConfig(() =>
      verifyWebhookSignature({ rawBody: raw, signature: sig })
    );

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A2: Invalid webhook signature is rejected
// ─────────────────────────────────────────────────────────────
describe('TEST A2 — Invalid webhook signature is rejected', () => {
  it('should return valid:false for tampered body', () => {
    const raw = makeRawBody({ event: 'payment.captured', tamper: false });
    const sig = sign(raw, WEBHOOK_SECRET);
    const tampered = makeRawBody({ event: 'payment.captured', tamper: true });

    const result = withTestConfig(() =>
      verifyWebhookSignature({ rawBody: tampered, signature: sig })
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should return valid:false for wrong secret', () => {
    const raw = makeRawBody({ event: 'payment.captured' });
    const sig = sign(raw, 'wrong_secret');

    const result = withTestConfig(() =>
      verifyWebhookSignature({ rawBody: raw, signature: sig })
    );

    expect(result.valid).toBe(false);
  });

  it('should return valid:false for empty signature', () => {
    const raw = makeRawBody({ event: 'payment.captured' });

    const result = withTestConfig(() =>
      verifyWebhookSignature({ rawBody: raw, signature: '' })
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A3: Duplicate x-razorpay-event-id is ignored
// ─────────────────────────────────────────────────────────────
describe('TEST A3 — Duplicate x-razorpay-event-id causes zero side effects', () => {

  it('first event is processed, second is DUPLICATE_IGNORED', () => {
    // Use a unique order + payment ID to isolate from other tests
    const orderId   = `order_a3_${Date.now()}`;
    const paymentId = `pay_a3_${Date.now()}`;
    const eventId   = `evt_a3_${Date.now()}`;

    // Pre-seed: create an internal transaction so processWebhookEvent can find it
    const txn = transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: `rcpt_a3_${Date.now()}`,
      razorpay_order_id: orderId
    });

    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw     = makeRawBody(payload);
    const sig     = sign(raw, WEBHOOK_SECRET);

    // First delivery
    const r1 = withTestConfig(() =>
      processWebhookEvent({ rawBody: raw, signature: sig, webhookEventId: eventId, parsedPayload: payload })
    );
    expect(r1.status).toBe('ACCEPTED');

    // Verify PAID state set after first delivery
    const updatedTxn = transactionStore.getTransaction(txn.internal_transaction_id);
    expect(updatedTxn?.status).toBe('PAID');

    // Second delivery — same event ID
    const r2 = withTestConfig(() =>
      processWebhookEvent({ rawBody: raw, signature: sig, webhookEventId: eventId, parsedPayload: payload })
    );
    expect(r2.status).toBe('DUPLICATE_IGNORED');
    expect(r2.statusCode).toBe(200);

    // State must remain PAID — no second transition
    const finalTxn = transactionStore.getTransaction(txn.internal_transaction_id);
    expect(finalTxn?.status).toBe('PAID');
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A4: Valid payment.captured event transitions to PAID
// ─────────────────────────────────────────────────────────────
describe('TEST A4 — Valid payment.captured transitions transaction to PAID', () => {
  it('transaction reaches PAID state after verified webhook', () => {
    const orderId   = `order_a4_${Date.now()}`;
    const paymentId = `pay_a4_${Date.now()}`;
    const eventId   = `evt_a4_${Date.now()}`;

    const txn = transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: `rcpt_a4_${Date.now()}`,
      razorpay_order_id: orderId
    });

    // Confirm initial state
    expect(transactionStore.getTransaction(txn.internal_transaction_id)?.status).toBe('ORDER_CREATED');

    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw     = makeRawBody(payload);
    const sig     = sign(raw, WEBHOOK_SECRET);

    const result = withTestConfig(() =>
      processWebhookEvent({ rawBody: raw, signature: sig, webhookEventId: eventId, parsedPayload: payload })
    );

    expect(result.status).toBe('ACCEPTED');
    expect(result.statusCode).toBe(200);

    const finalTxn = transactionStore.getTransaction(txn.internal_transaction_id);
    expect(finalTxn?.status).toBe('PAID');
    expect(finalTxn?.razorpay_payment_id).toBe(paymentId);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A5: Invalid webhook — transaction state unchanged
// ─────────────────────────────────────────────────────────────
describe('TEST A5 — Invalid webhook signature leaves state unchanged', () => {
  it('transaction state is NOT mutated by invalid webhook', () => {
    const orderId   = `order_a5_${Date.now()}`;
    const paymentId = `pay_a5_${Date.now()}`;
    const eventId   = `evt_a5_${Date.now()}`;

    const txn = transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: `rcpt_a5_${Date.now()}`,
      razorpay_order_id: orderId
    });
    transactionStore.updateTransactionStatus(txn.internal_transaction_id, 'CHECKOUT_STARTED');

    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw     = makeRawBody(payload);
    const badSig  = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const result = withTestConfig(() =>
      processWebhookEvent({ rawBody: raw, signature: badSig, webhookEventId: eventId, parsedPayload: payload })
    );

    expect(result.status).toBe('REJECTED');
    expect(result.statusCode).toBe(400);

    const unchangedTxn = transactionStore.getTransaction(txn.internal_transaction_id);
    expect(unchangedTxn?.status).toBe('CHECKOUT_STARTED');  // NOT PAID
    expect(unchangedTxn?.razorpay_payment_id).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A6: Checkout callback signature verification
// ─────────────────────────────────────────────────────────────
describe('TEST A6 — Checkout callback payment signature', () => {
  it('accepts a correctly computed checkout signature', () => {
    const orderId   = 'order_callback_valid';
    const paymentId = 'pay_callback_valid';
    const body      = `${orderId}|${paymentId}`;
    const sig       = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');

    const result = withTestConfig(() =>
      verifyCheckoutCallbackSignature({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig })
    );

    expect(result.valid).toBe(true);
  });

  it('rejects a tampered checkout signature', () => {
    const orderId   = 'order_callback_tamper';
    const paymentId = 'pay_callback_tamper';
    const body      = `${orderId}|${paymentId}`;
    const sig       = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');
    // Flip first char to tamper
    const tampered  = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);

    const result = withTestConfig(() =>
      verifyCheckoutCallbackSignature({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: tampered })
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('rejects mismatched payment ID in signature', () => {
    const orderId        = 'order_callback_mismatch';
    const realPaymentId  = 'pay_real';
    const fakePaymentId  = 'pay_fake';
    const body           = `${orderId}|${realPaymentId}`;
    const sig            = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');

    const result = withTestConfig(() =>
      verifyCheckoutCallbackSignature({ razorpay_order_id: orderId, razorpay_payment_id: fakePaymentId, razorpay_signature: sig })
    );

    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A7: Order creation input validation
// ─────────────────────────────────────────────────────────────
describe('TEST A7 — Order creation validates amount and currency', () => {
  it('accepts valid paise amount and INR currency', () => {
    const result = validateOrderInput({ amount_paise: 490000, currency: 'INR' });
    expect(result.valid).toBe(true);
  });

  it('accepts amount_inr and converts to paise', () => {
    const result = validateOrderInput({ amount_inr: 4900, currency: 'INR' });
    expect(result.valid).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = validateOrderInput({ amount_paise: 0, currency: 'INR' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  it('rejects negative amount', () => {
    const result = validateOrderInput({ amount_paise: -100, currency: 'INR' });
    expect(result.valid).toBe(false);
  });

  it('rejects non-integer paise amount', () => {
    const result = validateOrderInput({ amount_paise: 490000.5, currency: 'INR' });
    expect(result.valid).toBe(false);
  });

  it('rejects non-INR currency', () => {
    const result = validateOrderInput({ amount_paise: 490000, currency: 'USD' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/INR/);
  });

  it('rejects missing amount', () => {
    const result = validateOrderInput({ currency: 'INR' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/amount/i);
  });
});

// ─────────────────────────────────────────────────────────────
// TEST A8: HTTP Route canonical /api/webhooks/razorpay & 404 on /api/webhooks/razopay
// ─────────────────────────────────────────────────────────────
describe('TEST A8 — HTTP Webhook Route handling', () => {
  it('POST /api/webhooks/razorpay reaches webhook handler and processes valid event', async () => {
    const orderId = `order_http_${Date.now()}`;
    const paymentId = `pay_http_${Date.now()}`;
    const eventId = `evt_http_${Date.now()}`;

    transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: `rcpt_http_${Date.now()}`,
      razorpay_order_id: orderId
    });

    const payload = makeCapturedWebhookPayload(orderId, paymentId);
    const raw = makeRawBody(payload);
    const sig = sign(raw, WEBHOOK_SECRET);

    const origSecret = config.razorpayWebhookSecret;
    config.razorpayWebhookSecret = WEBHOOK_SECRET;

    try {
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', sig)
        .set('x-razorpay-event-id', eventId)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.event_type).toBe('payment.captured');
    } finally {
      config.razorpayWebhookSecret = origSecret;
    }
  });

  it('POST /api/webhooks/razorpay returns 400 if signature header is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .send({ test: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });

  it('POST /api/webhooks/razopay returns 404 (typo path is not supported)', async () => {
    const res = await request(app)
      .post('/api/webhooks/razopay')
      .set('Content-Type', 'application/json')
      .send({ test: 1 });

    expect(res.status).toBe(404);
  });

  it('POST /api/orders/verify-callback does not downgrade a PAID transaction', async () => {
    const orderId = `order_cb_paid_${Date.now()}`;
    const paymentId = `pay_cb_paid_${Date.now()}`;

    const txn = transactionStore.createTransaction({
      amount_paise: 490000,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      razorpay_order_id: orderId
    });

    // Simulate webhook already marked transaction PAID
    transactionStore.updateTransactionStatus(txn.internal_transaction_id, 'PAID', {
      razorpay_payment_id: paymentId
    });

    const body = `${orderId}|${paymentId}`;
    const sig = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex');

    const origKeySecret = config.razorpayKeySecret;
    config.razorpayKeySecret = KEY_SECRET;

    try {
      const res = await request(app)
        .post('/api/orders/verify-callback')
        .send({
          internal_transaction_id: txn.internal_transaction_id,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig
        });

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.status).toBe('PAID');

      const updated = transactionStore.getTransaction(txn.internal_transaction_id);
      expect(updated?.status).toBe('PAID');
    } finally {
      config.razorpayKeySecret = origKeySecret;
    }
  });
});

