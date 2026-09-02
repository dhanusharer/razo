import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';
import { recoveryRouter } from './routes/recovery.js';
import { adversarialRouter } from './routes/adversarial.js';
import { transactionStore } from './state/transactionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ─────────────────────────────────────────────
// Raw body capture for webhook route ONLY.
// Must be registered BEFORE express.json() for /api/webhooks/razorpay.
// This attaches rawBody to req so the HMAC can be computed on the
// unmodified wire bytes — never reconstruct raw body from parsed JSON.
// ─────────────────────────────────────────────
app.use(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
    next();
  }
);

// Standard JSON + CORS for all other routes
app.use(cors());
app.use(express.json());

// Serve static checkout page
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/recovery', recoveryRouter);
app.use('/api/adversarial', adversarialRouter);

// ─────────────────────────────────────────────
// GET /api/status
// Reports credential availability so Gate A can be diagnosed quickly
// ─────────────────────────────────────────────
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    service: 'resilient-agent-relay',
    phase: 'gate-a',
    model: config.geminiModel,
    llm_provider: config.llmProvider,
    credentials_configured: config.hasCredentials,
    key_id_present: Boolean(config.razorpayKeyId),
    key_secret_present: Boolean(config.razorpayKeySecret),
    webhook_secret_present: Boolean(config.razorpayWebhookSecret),
    ...(!config.hasCredentials && {
      warning: 'Razorpay credentials not set. Live test mode is BLOCKED until .env is populated.'
    })
  });
});

import { MetricsService } from './metrics/metricsService.js';
import { CatalogService } from './commerce/catalog.js';
import { DEFAULT_MERCHANT_POLICY, resolveEffectivePolicy } from './policy/merchantPolicy.js';
import { DEFAULT_TEST_MANDATE } from './commerce/mandate.js';

// ─────────────────────────────────────────────
// GET /api/policy
// Active merchant recovery policy & effective rules
// ─────────────────────────────────────────────
app.get('/api/policy', (_req: Request, res: Response) => {
  const effective = resolveEffectivePolicy(DEFAULT_TEST_MANDATE, DEFAULT_MERCHANT_POLICY);
  res.json({
    provenance: 'LIVE',
    active_policy: DEFAULT_MERCHANT_POLICY,
    effective_rules: {
      max_budget: effective.effective_max_budget,
      max_price_delta_percent: effective.effective_max_price_delta_percent,
      allowed_brands: effective.effective_allowed_brands,
      allowed_categories: effective.effective_allowed_categories,
      minimum_margin_percent: effective.effective_minimum_margin_percent,
      max_recovery_attempts: effective.effective_max_recovery_attempts,
      auto_recovery_enabled: effective.auto_recovery_enabled,
      escalation_on_llm_timeout: effective.escalation_on_llm_timeout
    }
  });
});

// ─────────────────────────────────────────────
// GET /api/catalog
// Safe product catalog for merchant demo UI
// ─────────────────────────────────────────────
app.get('/api/catalog', (_req: Request, res: Response) => {
  const products = CatalogService.getAllProducts().map((p) => {
    const margin = CatalogService.getAuthoritativeMargin(p.id);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price_inr: p.price_inr,
      cost_inr: p.cost_inr,
      margin_inr: margin?.margin_inr,
      margin_percent: margin?.margin_percent,
      currency: p.currency,
      attributes: p.attributes,
      description: p.description
    };
  });

  res.json({
    provenance: 'LIVE',
    total_products: products.length,
    products
  });
});

// ─────────────────────────────────────────────
// GET /api/metrics
// Authoritative merchant business & recovery metrics
// ─────────────────────────────────────────────
app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json(MetricsService.getMetrics());
});

// ─────────────────────────────────────────────
// GET /api/events
// Full event log for evidence collection
// ─────────────────────────────────────────────
app.get('/api/events', (_req: Request, res: Response) => {
  res.json({ events: transactionStore.getEvents() });
});

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ─────────────────────────────────────────────
// Start server (only when run directly, not when imported by tests)
// ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`\n🚀  Resilient-Agent-Relay — Gate A`);
    console.log(`   Server: http://localhost:${config.port}`);
    console.log(`   Checkout UI: http://localhost:${config.port}/index.html`);
    console.log(`   Status: http://localhost:${config.port}/api/status`);
    if (!config.hasCredentials) {
      console.warn('\n⚠️  WARNING: Razorpay credentials not configured.');
      console.warn('   Live test mode BLOCKED. Populate .env to enable.\n');
    } else {
      console.log('\n✅  Razorpay credentials loaded. Test Mode ready.\n');
    }
  });
}

export default app;
