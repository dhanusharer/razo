import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('E4 — Adversarial Chaos & Threat Defense Matrix', () => {
  it('E4-1: PROMPT_INJECTION is intercepted in <1ms with zero Razorpay orders created', async () => {
    const res = await request(app)
      .post('/api/adversarial/simulate')
      .send({ attack_type: 'PROMPT_INJECTION' });

    expect(res.status).toBe(200);
    expect(res.body.threat_contained).toBe(true);
    expect(res.body.defense_latency_ms).toBeLessThan(50);
    expect(res.body.failures.length).toBeGreaterThan(0);
    expect(res.body.financial_guarantee).toContain('ZERO RAZORPAY ORDERS');
  });

  it('E4-2: WEBHOOK_REPLAY is defused via cryptographic idempotency deduplication', async () => {
    const res = await request(app)
      .post('/api/adversarial/simulate')
      .send({ attack_type: 'WEBHOOK_REPLAY' });

    expect(res.status).toBe(200);
    expect(res.body.threat_contained).toBe(true);
    expect(res.body.is_duplicate).toBe(true);
    expect(res.body.evaluation_result).toBe('DUPLICATE_EVENT_DETECTED');
    expect(res.body.http_response_code).toBe(200);
  });

  it('E4-3: STALE_INVENTORY_RACE is intercepted by Gate 2 revalidation', async () => {
    const res = await request(app)
      .post('/api/adversarial/simulate')
      .send({ attack_type: 'STALE_INVENTORY_RACE' });

    expect(res.status).toBe(200);
    expect(res.body.threat_contained).toBe(true);
    expect(res.body.evaluation_result).toBe('STALE_INVENTORY_DETECTED');
    expect(res.body.financial_guarantee).toContain('ZERO ORPHANED PAYMENTS');
  });

  it('E4-4: TIMING_ATTACK_FORGERY is repelled via constant-time timingSafeEqual', async () => {
    const res = await request(app)
      .post('/api/adversarial/simulate')
      .send({ attack_type: 'TIMING_ATTACK_FORGERY' });

    expect(res.status).toBe(200);
    expect(res.body.threat_contained).toBe(true);
    expect(res.body.signature_match).toBe(false);
    expect(res.body.evaluation_result).toBe('SIGNATURE_FORGERY_REJECTED');
  });
});
