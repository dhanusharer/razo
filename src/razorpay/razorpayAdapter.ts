import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config.js';
import { CreateOrderRequest } from '../types.js';

// ─────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────

export interface OrderParams {
  amount_paise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
  notes?: Record<string, string>;
}

export function validateOrderInput(req: CreateOrderRequest): { valid: boolean; error?: string } {
  // Accept either amount_paise or amount_inr
  const paise = req.amount_paise !== undefined
    ? req.amount_paise
    : req.amount_inr !== undefined
    ? Math.round(req.amount_inr * 100)
    : undefined;

  if (paise === undefined) {
    return { valid: false, error: 'amount_paise or amount_inr is required' };
  }
  if (!Number.isInteger(paise) || paise <= 0) {
    return { valid: false, error: 'amount must be a positive integer in paise' };
  }

  const currency = req.currency ?? 'INR';
  if (currency !== 'INR') {
    return { valid: false, error: 'only INR is supported in Gate A' };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────
// Razorpay client (lazy — errors clearly if creds missing)
// ─────────────────────────────────────────────

let _client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!config.hasCredentials) {
    throw new Error(
      'Razorpay credentials are missing. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, ' +
      'and RAZORPAY_WEBHOOK_SECRET in your .env file.'
    );
  }
  if (!_client) {
    _client = new Razorpay({
      key_id: config.razorpayKeyId,
      key_secret: config.razorpayKeySecret
    });
  }
  return _client;
}

// ─────────────────────────────────────────────
// Create a Test Mode Order
// ─────────────────────────────────────────────

export async function createRazorpayOrder(params: OrderParams): Promise<RazorpayOrderResult> {
  const client = getRazorpayClient();

  const order = await client.orders.create({
    amount: params.amount_paise,   // must be integer paise
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes ?? {}
  }) as RazorpayOrderResult;

  return order;
}

// ─────────────────────────────────────────────
// Verify the checkout callback payment signature
// HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
// ─────────────────────────────────────────────

export interface CallbackVerificationResult {
  valid: boolean;
  reason?: string;
}

export function verifyCheckoutCallbackSignature(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): CallbackVerificationResult {
  if (!config.razorpayKeySecret) {
    return { valid: false, reason: 'Key secret not configured' };
  }

  const body = `${params.razorpay_order_id}|${params.razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', config.razorpayKeySecret)
    .update(body)
    .digest('hex');

  const provided = Buffer.from(params.razorpay_signature, 'hex');
  const computed = Buffer.from(expected, 'hex');

  // Guard against length mismatch before timing-safe compare
  if (provided.length !== computed.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  const match = crypto.timingSafeEqual(computed, provided);
  return match
    ? { valid: true }
    : { valid: false, reason: 'Signature does not match' };
}

// ─────────────────────────────────────────────
// Generate a unique receipt ID
// ─────────────────────────────────────────────

export function generateReceipt(prefix = 'rcpt'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}_${ts}_${rand}`;
}
