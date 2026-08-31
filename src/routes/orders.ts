import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import {
  createRazorpayOrder,
  verifyCheckoutCallbackSignature,
  generateReceipt,
  validateOrderInput
} from '../razorpay/razorpayAdapter.js';
import { transactionStore } from '../state/transactionStore.js';
import { CreateOrderRequest, VerifyCallbackRequest } from '../types.js';

export const ordersRouter = Router();

// ─────────────────────────────────────────────
// POST /api/orders
// Creates a Razorpay Test Mode Order and an internal transaction record
// ─────────────────────────────────────────────
ordersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateOrderRequest;

    // Validate input
    const validation = validateOrderInput(body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const amount_paise = body.amount_paise !== undefined
      ? body.amount_paise
      : Math.round((body.amount_inr ?? 0) * 100);
    const currency = body.currency ?? 'INR';
    const receipt = generateReceipt('gate_a');

    // Fail clearly if credentials are missing
    if (!config.hasCredentials) {
      return res.status(503).json({
        error: 'Razorpay credentials not configured',
        help: 'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET in .env'
      });
    }

    // Create order on Razorpay Test Mode
    const rzpOrder = await createRazorpayOrder({
      amount_paise,
      currency,
      receipt,
      notes: body.notes
    });

    // Create internal transaction record
    const txn = transactionStore.createTransaction({
      amount_paise,
      currency,
      receipt,
      razorpay_order_id: rzpOrder.id,
      metadata: { notes: body.notes }
    });

    // Log CHECKOUT_STARTED event
    transactionStore.recordEvent('CHECKOUT_STARTED', {
      internal_transaction_id: txn.internal_transaction_id,
      razorpay_order_id: rzpOrder.id,
      result: 'SUCCESS',
      details: { amount_paise, currency, receipt }
    });
    transactionStore.updateTransactionStatus(txn.internal_transaction_id, 'CHECKOUT_STARTED');

    // Return only what the frontend needs — KEY_SECRET is NEVER sent
    return res.json({
      internal_transaction_id: txn.internal_transaction_id,
      razorpay_order_id: rzpOrder.id,
      amount_paise: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: rzpOrder.receipt,
      key_id: config.razorpayKeyId,   // public key only
      status: txn.status
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Order creation failed', details: message });
  }
});

// ─────────────────────────────────────────────
// POST /api/orders/verify-callback
// Verifies the Razorpay Checkout payment signature.
// IMPORTANT: This sets PAYMENT_CALLBACK_VERIFIED, NOT PAID.
// PAID is only set by a verified payment.captured webhook.
// ─────────────────────────────────────────────
ordersRouter.post('/verify-callback', async (req: Request, res: Response) => {
  try {
    const {
      internal_transaction_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body as VerifyCallbackRequest;

    if (!internal_transaction_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required fields for callback verification' });
    }

    const txn = transactionStore.getTransaction(internal_transaction_id);
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify checkout callback signature (timing-safe)
    const verificationResult = verifyCheckoutCallbackSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!verificationResult.valid) {
      transactionStore.updateTransactionStatus(internal_transaction_id, 'PAYMENT_CALLBACK_INVALID', {
        razorpay_payment_id
      });
      transactionStore.recordEvent('PAYMENT_CALLBACK_REJECTED', {
        internal_transaction_id,
        razorpay_order_id,
        razorpay_payment_id,
        result: 'FAILURE',
        details: { reason: verificationResult.reason }
      });
      return res.status(400).json({
        verified: false,
        reason: verificationResult.reason,
        status: 'PAYMENT_CALLBACK_INVALID'
      });
    }

    // Signature valid — provisional evidence. If webhook already marked PAID, maintain PAID.
    const isAlreadyPaid = txn.status === 'PAID';
    const newStatus = isAlreadyPaid ? 'PAID' : 'PAYMENT_CALLBACK_VERIFIED';

    transactionStore.updateTransactionStatus(internal_transaction_id, newStatus, {
      razorpay_payment_id
    });
    transactionStore.recordEvent('PAYMENT_CALLBACK_VERIFIED', {
      internal_transaction_id,
      razorpay_order_id,
      razorpay_payment_id,
      result: 'SUCCESS',
      details: {
        note: isAlreadyPaid
          ? 'Provisional callback verified. Transaction is already confirmed PAID via webhook.'
          : 'Provisional callback verification. Awaiting payment.captured webhook for PAID state.'
      }
    });

    return res.json({
      verified: true,
      internal_transaction_id,
      razorpay_order_id,
      razorpay_payment_id,
      status: newStatus,
      note: isAlreadyPaid
        ? 'Transaction is already PAID (confirmed via webhook).'
        : 'Transaction is NOT yet PAID. Awaiting payment.captured webhook.'
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Callback verification failed', details: message });
  }
});

// ─────────────────────────────────────────────
// GET /api/orders/:id
// Returns the current state of an internal transaction
// ─────────────────────────────────────────────
ordersRouter.get('/:id', (req: Request, res: Response) => {
  const txn = transactionStore.getTransaction(req.params.id);
  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  return res.json(txn);
});

// ─────────────────────────────────────────────
// GET /api/orders/:id/events
// Returns the event log for a transaction
// ─────────────────────────────────────────────
ordersRouter.get('/:id/events', (req: Request, res: Response) => {
  const txn = transactionStore.getTransaction(req.params.id);
  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  const events = transactionStore.getEvents(req.params.id);
  return res.json({ internal_transaction_id: req.params.id, events });
});
