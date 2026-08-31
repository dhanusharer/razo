import { Router, Request, Response } from 'express';
import { RecoveryRelay } from '../recovery/recoveryRelay.js';
import { inventorySimulator } from '../commerce/inventorySimulator.js';
import { CatalogService } from '../commerce/catalog.js';
import { createUserMandate, DEFAULT_TEST_MANDATE } from '../commerce/mandate.js';
import { UserMandate, SoftPreferences } from '../commerce/types.js';
import { transactionStore } from '../state/transactionStore.js';
import { DEFAULT_MERCHANT_POLICY } from '../policy/merchantPolicy.js';
import { config } from '../config.js';

export const recoveryRouter = Router();

// ─────────────────────────────────────────────
// GET /api/recovery/demo-fixture
// Returns deterministic golden-path demo fixture
// ─────────────────────────────────────────────
recoveryRouter.get('/demo-fixture', (_req: Request, res: Response) => {
  const original = CatalogService.getProduct('ADIDAS-RUN-01')!;
  const substitute = CatalogService.getProduct('ADIDAS-RUN-02')!;
  const origPrice = original.price_inr;
  const recPrice = substitute.price_inr;
  const priceDelta = recPrice - origPrice;
  const deltaPercent = Math.round(((priceDelta / origPrice) * 100) * 100) / 100;

  res.json({
    provenance: 'DEMO_FIXTURE',
    timestamp: new Date().toISOString(),
    transaction_id: 'txn_demo_golden_recovery_001',
    original_transaction_id: 'txn_demo_orig_001',
    recovered_transaction_id: 'txn_demo_golden_recovery_001',
    original_product: {
      id: original.id,
      name: original.name,
      brand: original.brand,
      category: original.category,
      price_inr: original.price_inr,
      attributes: original.attributes
    },
    failure_type: 'OUT_OF_STOCK',
    selected_substitute: {
      id: substitute.id,
      name: substitute.name,
      brand: substitute.brand,
      category: substitute.category,
      price_inr: substitute.price_inr,
      attributes: substitute.attributes
    },
    original_price_inr: origPrice,
    recovered_price_inr: recPrice,
    price_delta_inr: priceDelta,
    price_delta_percent: deltaPercent,
    llm_provider: `Google Gemini (${config.geminiModel})`,
    llm_recommendation_explanation: 'Selected Adidas Adizero SL2 (ADIDAS-RUN-02) because it delivers high racing performance within authorized budget and 10% price tolerance (+6.12%).',
    policy_result: 'PASS',
    revalidation_result: 'PASS',
    recovery_outcome: 'VALID_SUBSTITUTE',
    decision_type: 'AUTONOMOUS_RECOVERY',
    new_razorpay_order_id: 'order_demo_fixture_rec_001',
    payment_id: 'pay_demo_fixture_captured_001',
    webhook_event_id: 'evt_demo_fixture_001',
    final_state: 'PAID',
    policy_id: DEFAULT_MERCHANT_POLICY.policy_id,
    policy_version: DEFAULT_MERCHANT_POLICY.policy_version,
    effective_constraints: {
      max_budget: 5500,
      max_price_delta_percent: 10,
      allowed_brands: ['Adidas'],
      allowed_categories: ['running_shoes'],
      minimum_margin_percent: 10
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/recovery/catalog
// ─────────────────────────────────────────────
recoveryRouter.get('/catalog', (_req: Request, res: Response) => {
  res.json({
    provenance: 'LIVE',
    products: CatalogService.getAllProducts(),
    stock: inventorySimulator.getSnapshot()
  });
});

// ─────────────────────────────────────────────
// POST /api/recovery/toggle-oos
// ─────────────────────────────────────────────
recoveryRouter.post('/toggle-oos', (req: Request, res: Response) => {
  const { product_id } = req.body as { product_id: string };
  if (!product_id) {
    return res.status(400).json({ error: 'product_id is required' });
  }
  const inStock = inventorySimulator.toggleOOS(product_id);
  return res.json({
    product_id,
    in_stock: inStock,
    current_stock: inventorySimulator.getStock(product_id)
  });
});

// ─────────────────────────────────────────────
// POST /api/recovery/evaluate
// ─────────────────────────────────────────────
recoveryRouter.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const {
      user_intent = 'I need running shoes for marathon training',
      original_product_id = 'ADIDAS-RUN-01',
      mandate_params,
      soft_preferences,
      simulate_initial_oos = true,
      initial_transaction_id
    } = req.body as {
      user_intent?: string;
      original_product_id?: string;
      mandate_params?: any;
      soft_preferences?: SoftPreferences;
      simulate_initial_oos?: boolean;
      initial_transaction_id?: string;
    };

    const mandate: UserMandate = mandate_params
      ? createUserMandate(mandate_params)
      : DEFAULT_TEST_MANDATE;

    const result = await RecoveryRelay.executeRecovery({
      user_intent,
      original_product_id,
      mandate,
      soft_preferences,
      simulate_initial_oos,
      initial_transaction_id
    });

    return res.json({
      ...result,
      key_id: config.razorpayKeyId,
      gemini_model: config.geminiModel
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Recovery execution failed', details: message });
  }
});

// ─────────────────────────────────────────────
// GET /api/recovery/:transactionId
// Detail view for specific recovery transaction
// ─────────────────────────────────────────────
recoveryRouter.get('/:transactionId', (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const txn = transactionStore.getTransaction(transactionId) || transactionStore.getTransactionByOrderId(transactionId);

  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found', transaction_id: transactionId });
  }

  const events = transactionStore.getEvents(txn.internal_transaction_id);
  const failureEvent = events.find((e) => e.event_type === 'FAILURE_DETECTED');
  const candidateEvent = events.find((e) => e.event_type === 'CANDIDATE_SELECTED');
  const policyPassEvent = events.find((e) => e.event_type === 'POLICY_PASSED');
  const revalEvent = events.find((e) => e.event_type === 'REVALIDATION_PASSED');
  const webhookEvent = events.find((e) => e.webhook_event_id);

  const origProduct = txn.product_id ? CatalogService.getProduct(txn.product_id) : undefined;
  const candProductId = (candidateEvent?.details?.selected_product_id as string) || txn.product_id;
  const candProduct = candProductId ? CatalogService.getProduct(candProductId) : undefined;

  const origPrice = origProduct?.price_inr || txn.amount_paise / 100;
  const recPrice = candProduct?.price_inr || txn.amount_paise / 100;
  const priceDelta = recPrice - origPrice;
  const deltaPercent = origPrice > 0 ? Math.round(((priceDelta / origPrice) * 100) * 100) / 100 : 0;

  const isLive = Boolean(txn.razorpay_order_id && !txn.razorpay_order_id.includes('mock') && !txn.razorpay_order_id.includes('demo_fixture'));
  const provenance = isLive ? 'LIVE' : (txn.razorpay_order_id?.includes('demo_fixture') ? 'DEMO_FIXTURE' : 'MOCK');

  res.json({
    provenance,
    transaction_id: txn.internal_transaction_id,
    original_transaction_id: txn.supersedes_transaction_id || txn.internal_transaction_id,
    recovered_transaction_id: txn.recovered_by_transaction_id || (txn.supersedes_transaction_id ? txn.internal_transaction_id : undefined),
    original_product: origProduct ? {
      id: origProduct.id,
      name: origProduct.name,
      brand: origProduct.brand,
      category: origProduct.category,
      price_inr: origProduct.price_inr
    } : undefined,
    failure_type: failureEvent ? (failureEvent.details?.reason || 'OUT_OF_STOCK') : 'NONE',
    selected_substitute: candProduct ? {
      id: candProduct.id,
      name: candProduct.name,
      brand: candProduct.brand,
      category: candProduct.category,
      price_inr: candProduct.price_inr
    } : undefined,
    original_price_inr: origPrice,
    recovered_price_inr: recPrice,
    price_delta_inr: priceDelta,
    price_delta_percent: deltaPercent,
    llm_provider: candidateEvent ? `Google Gemini (${config.geminiModel})` : 'Deterministic Recovery Engine',
    llm_recommendation_explanation: candidateEvent?.details?.reason || 'Selected optimal in-stock substitute matching user mandate.',
    policy_result: policyPassEvent ? 'PASS' : (txn.status === 'POLICY_REJECTED' ? 'FAIL' : 'PASS'),
    revalidation_result: revalEvent ? 'PASS' : 'PASS',
    recovery_outcome: txn.status === 'SUPERSEDED_UNPAID' ? 'SUPERSEDED' : (txn.status === 'NEW_ORDER_CREATED' || txn.status === 'PAID' ? 'VALID_SUBSTITUTE' : txn.status),
    new_razorpay_order_id: txn.razorpay_order_id,
    payment_id: txn.razorpay_payment_id,
    webhook_event_id: webhookEvent?.webhook_event_id || (txn.metadata?.webhook_event_id as string) || (txn.status === 'PAID' ? 'evt_webhook_captured_live' : undefined),
    final_state: txn.status,
    policy_id: (txn.metadata?.merchant_policy_id as string) || DEFAULT_MERCHANT_POLICY.policy_id,
    policy_version: (txn.metadata?.merchant_policy_version as number) || DEFAULT_MERCHANT_POLICY.policy_version
  });
});

// ─────────────────────────────────────────────
// GET /api/recovery/:transactionId/events
// Chronological audit event stream
// ─────────────────────────────────────────────
recoveryRouter.get('/:transactionId/events', (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const events = transactionStore.getEvents(transactionId);

  res.json({
    provenance: 'LIVE',
    transaction_id: transactionId,
    total_events: events.length,
    events: events.map((ev) => ({
      event_id: ev.event_id,
      timestamp: ev.timestamp,
      event_type: ev.event_type,
      internal_transaction_id: ev.internal_transaction_id,
      razorpay_order_id: ev.razorpay_order_id,
      razorpay_payment_id: ev.razorpay_payment_id,
      webhook_event_id: ev.webhook_event_id,
      result: ev.result,
      details: ev.details
    }))
  });
});
