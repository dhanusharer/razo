import { Router, Request, Response } from 'express';
import { processWebhookEvent, RazorpayWebhookPayload } from '../razorpay/webhookVerifier.js';
import { transactionStore } from '../state/transactionStore.js';

export const webhooksRouter = Router();

// ─────────────────────────────────────────────
// POST /api/webhooks/razorpay
webhooksRouter.post('/razorpay', (req: Request, res: Response) => {
  // Raw body attached by express.raw() in server.ts
  const rawBody: Buffer | undefined = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!rawBody) {
    return res.status(400).json({ error: 'Raw body not available — middleware misconfiguration' });
  }

  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  const webhookEventId = (req.headers['x-razorpay-event-id'] as string | undefined) ?? '';

  if (!signature) {
    return res.status(400).json({ error: 'x-razorpay-signature header is required' });
  }

  let parsedPayload: RazorpayWebhookPayload;
  try {
    parsedPayload = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookPayload;
  } catch {
    return res.status(400).json({ error: 'Webhook body is not valid JSON' });
  }

  const result = processWebhookEvent({
    rawBody,
    signature,
    webhookEventId,
    parsedPayload
  });

  return res.status(result.statusCode).json({
    status: result.status,
    message: result.message,
    webhook_event_id: result.webhook_event_id,
    event_type: result.event_type,
    internal_transaction_id: result.internal_transaction_id
  });
});

// ─────────────────────────────────────────────
// GET /api/webhooks/events
// Returns the full Gate A event log (for inspection/evidence)
// ─────────────────────────────────────────────
webhooksRouter.get('/events', (_req: Request, res: Response) => {
  return res.json({ events: transactionStore.getEvents() });
});
