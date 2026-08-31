import dotenv from 'dotenv';
dotenv.config();

import { GeminiLLMProvider } from '../src/agent/providers/geminiProvider.js';
import { CatalogService } from '../src/commerce/catalog.js';
import { createUserMandate } from '../src/commerce/mandate.js';
import { LLMEvaluationInput } from '../src/commerce/types.js';

export interface LiveLatencyMetrics {
  sample_size: number;
  model: string;
  mode: 'LIVE_GEMINI';
  latencies_ms: number[];
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  min_ms: number;
  avg_ms: number;
}

export async function measureLiveGeminiLatency(sampleSize: number = 20): Promise<LiveLatencyMetrics> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    throw new Error('GEMINI_API_KEY is not configured for live latency measurement');
  }

  const provider = new GeminiLLMProvider(apiKey, 'gemini-2.5-flash');
  const original = CatalogService.getProduct('ADIDAS-RUN-01')!;
  const candidates = CatalogService.getAllProducts().filter((p) => p.id !== 'ADIDAS-RUN-01');
  const mandate = createUserMandate({
    max_budget: 5500,
    allowed_categories: ['running_shoes'],
    allowed_brands: ['Adidas'],
    max_price_delta_percent: 10,
    required_attributes: { size: 10 }
  });

  const input: LLMEvaluationInput = {
    user_intent: 'I need size 10 Adidas running shoes for training',
    original_product: original,
    candidate_products: candidates,
    mandate,
    soft_preferences: { performance_priority: 'high', delivery_priority: 'fastest' }
  };

  const latencies: number[] = [];

  for (let i = 1; i <= sampleSize; i++) {
    const start = performance.now();
    try {
      await provider.evaluate(input);
      const elapsed = performance.now() - start;
      latencies.push(elapsed);
    } catch (err: any) {
      if (err.message.includes('429')) {
        // If rate limited on free tier, wait 12s and retry
        await new Promise((resolve) => setTimeout(resolve, 12500));
        const retryStart = performance.now();
        await provider.evaluate(input);
        latencies.push(performance.now() - retryStart);
      } else {
        throw err;
      }
    }
    // Small delay between requests to stay within free-tier rate limits
    if (i < sampleSize) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const min = latencies[0] || 0;
  const avg = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;

  return {
    sample_size: latencies.length,
    model: 'gemini-2.5-flash',
    mode: 'LIVE_GEMINI',
    latencies_ms: latencies.map((l) => Math.round(l * 100) / 100),
    p50_ms: Math.round(p50 * 100) / 100,
    p95_ms: Math.round(p95 * 100) / 100,
    max_ms: Math.round(max * 100) / 100,
    min_ms: Math.round(min * 100) / 100,
    avg_ms: Math.round(avg * 100) / 100
  };
}

if (process.env.NODE_ENV !== 'test') {
  console.log('Measuring Live Gemini 2.5 Flash Latency (Sample size: 5 for quick verify)...');
  measureLiveGeminiLatency(5).then((m) => {
    console.log('LIVE GEMINI LATENCY RESULT:');
    console.log(JSON.stringify(m, null, 2));
  });
}
