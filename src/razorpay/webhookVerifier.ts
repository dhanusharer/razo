import crypto from 'crypto';
import { config } from '../config.js';
import { transactionStore } from '../state/transactionStore.js';
import { WebhookProcessingResult } from '../types.js';

// ─────────────────────────────────────────────
// Webhook HMAC-SHA256 verification
// Uses RAW request body (Buffer) — never parsed JSON
// ─────────────────────────────────────────────

export interface WebhookSignatureResult {
  valid: boolean;
  reason?: string;
}

export function verifyWebhookSignature(params: {
  rawBody: Buffer;
  signature: string;
}): WebhookSignatureResult {
  if (!config.razorpayWebhookSecret) {
    return { valid: false, reason: 'Webhook secret not configured' };
  }
  if (!params.signature) {
    return { valid: false, reason: 'x-razorpay-signature header is missing' };
  }

  const expected = crypto
    .createHmac('sha256', config.razorpayWebhookSecret)
    .update(params.rawBody)
    .digest('hex');

  const provided = Buffer.from(params.signature, 'hex');
  const computed = Buffer.from(expected, 'hex');

  // Reject if lengths differ — timingSafeEqual would throw otherwise
  if (provided.length !== computed.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  const match = crypto.timingSafeEqual(computed, provided);
  return match
    ? { valid: true }
    : { valid: false, reason: 'HMAC signature mismatch' };
}

// ─────────────────────────────────────────────
// Process a verified payment.captured webhook event
// ─────────────────────────────────────────────

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        [key: string]: unknown;
      };
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function processWebhookEvent(params: {
  rawBody: Buffer;
  signature: string;
  webhookEventId: string;  // from x-razorpay-event-id header
  parsedPayload: RazorpayWebhookPayload;
}): WebhookProcessingResult {
  const { rawBody, signature, webhookEventId, parsedPayload } = params;

  // STEP 1 — Verify HMAC on raw body
  const sigResult = verifyWebhookSignature({ rawBody, signature });
  if (!sigResult.valid) {
    transactionStore.recordEvent('WEBHOOK_SIGNATURE_REJECTED', {
      webhook_event_id: webhookEventId || '(none)',
      result: 'FAILURE',
      details: { reason: sigResult.reason }
    });
    return {
      status: 'REJECTED',
      statusCode: 400,
      message: `Webhook signature invalid: ${sigResult.reason}`
    };
  }

  // STEP 2 — Signature verified: log receipt
  transactionStore.recordEvent('WEBHOOK_SIGNATURE_VERIFIED', {
    webhook_event_id: webhookEventId,
    result: 'SUCCESS',
    details: { event_type: parsedPayload.event }
  });

  // STEP 3 — Idempotency: primary key is x-razorpay-event-id
  if (webhookEventId && transactionStore.isWebhookEventProcessed(webhookEventId)) {
    const payment = parsedPayload.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const txn = orderId ? transactionStore.getTransactionByOrderId(orderId) : undefined;

    transactionStore.recordEvent('DUPLICATE_EVENT_IGNORED', {
      webhook_event_id: webhookEventId,
      razorpay_order_id: orderId,
      razorpay_payment_id: payment?.id,
      internal_transaction_id: txn?.internal_transaction_id,
      result: 'IGNORED',
      details: { reason: 'x-razorpay-event-id already processed' }
    });

    return {
      status: 'DUPLICATE_IGNORED',
      statusCode: 200,
      message: 'Duplicate webhook event — already processed',
      webhook_event_id: webhookEventId
    };
  }

  // STEP 4 — Only handle payment.captured; acknowledge others without business effect
  transactionStore.recordEvent('WEBHOOK_RECEIVED', {
    webhook_event_id: webhookEventId,
    result: 'SUCCESS',
    details: { event_type: parsedPayload.event }
  });

  if (parsedPayload.event !== 'payment.captured') {
    // Mark event processed so duplicate deliveries of non-captured events don't re-execute
    if (webhookEventId) transactionStore.markWebhookEventProcessed(webhookEventId);
    return {
      status: 'ACCEPTED',
      statusCode: 200,
      message: `Event '${parsedPayload.event}' acknowledged — no business action required`,
      webhook_event_id: webhookEventId,
      event_type: parsedPayload.event
    };
  }

  // STEP 5 — Process payment.captured
  const payment = parsedPayload.payload?.payment?.entity;
  if (!payment) {
    return {
      status: 'REJECTED',
      statusCode: 400,
      message: 'payment.captured webhook missing payment entity'
    };
  }

  const paymentId = payment.id;
  const orderId = payment.order_id;

  // STEP 6 — Secondary defensive check on payment ID
  if (transactionStore.isPaymentProcessed(paymentId)) {
    transactionStore.recordEvent('DUPLICATE_EVENT_IGNORED', {
      webhook_event_id: webhookEventId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      result: 'IGNORED',
      details: { reason: 'razorpay_payment_id already processed (defensive)' }
    });
    if (webhookEventId) transactionStore.markWebhookEventProcessed(webhookEventId);
    return {
      status: 'DUPLICATE_IGNORED',
      statusCode: 200,
      message: 'Payment already processed (defensive dedup on payment ID)',
      webhook_event_id: webhookEventId
    };
  }

  // STEP 7 — Find internal transaction
  const txn = transactionStore.getTransactionByOrderId(orderId);
  if (!txn) {
    // No matching transaction — accept webhook gracefully but log warning
    if (webhookEventId) transactionStore.markWebhookEventProcessed(webhookEventId);
    transactionStore.markPaymentProcessed(paymentId);
    return {
      status: 'ACCEPTED',
      statusCode: 200,
      message: `No internal transaction found for order ${orderId} — may be from another session`,
      webhook_event_id: webhookEventId
    };
  }

  // STEP 8 — Transition to PAID (this is the ONLY place PAID is set)
  transactionStore.updateTransactionStatus(txn.internal_transaction_id, 'PAID', {
    razorpay_payment_id: paymentId
  });

  transactionStore.recordEvent('PAYMENT_CAPTURED', {
    internal_transaction_id: txn.internal_transaction_id,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    webhook_event_id: webhookEventId,
    result: 'SUCCESS',
    details: { amount: payment.amount, currency: payment.currency, status: payment.status }
  });

  // STEP 9 — Mark both idempotency keys processed
  if (webhookEventId) transactionStore.markWebhookEventProcessed(webhookEventId);
  transactionStore.markPaymentProcessed(paymentId);

  return {
    status: 'ACCEPTED',
    statusCode: 200,
    message: 'payment.captured processed — transaction is now PAID',
    webhook_event_id: webhookEventId,
    event_type: 'payment.captured',
    internal_transaction_id: txn.internal_transaction_id
  };
}
