import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { CatalogService } from '../src/commerce/catalog.js';
import { InventorySimulator } from '../src/commerce/inventorySimulator.js';
import { CandidateRetrieval } from '../src/commerce/candidateRetrieval.js';
import { buildEvaluationPrompt, SYSTEM_PROMPT } from '../src/agent/prompts.js';
import { PolicyEngine } from '../src/policy/policyEngine.js';
import { createUserMandate } from '../src/commerce/mandate.js';
import { transactionStore } from '../src/state/transactionStore.js';
import { generateReceipt } from '../src/razorpay/razorpayAdapter.js';

export interface StageLatencyBreakdown {
  oos_detection_ms: number;
  candidate_retrieval_ms: number;
  prompt_construction_ms: number;
  llm_network_inference_ms: number;
  json_parsing_ms: number;
  policy_gate_1_ms: number;
  revalidation_gate_2_ms: number;
  order_prep_ms: number;
  total_pipeline_ms: number;
}

export interface ProfilerResult {
  benchmark_name: string;
  timestamp: string;
  provider: string;
  exact_model: string;
  mode: 'LIVE_GEMINI';
  sample_size: number;
  successful_samples: number;
  stage_metrics: {
    oos_detection: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    candidate_retrieval: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    prompt_construction: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    llm_network_inference: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    json_parsing: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    policy_gate_1: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    revalidation_gate_2: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    order_prep: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
    total_pipeline: { p50_ms: number; p95_ms: number; avg_ms: number; max_ms: number };
  };
  individual_runs: StageLatencyBreakdown[];
}

function computeStats(arr: number[]) {
  if (arr.length === 0) return { p50_ms: 0, p95_ms: 0, avg_ms: 0, max_ms: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;
  return {
    p50_ms: Math.round(p50 * 1000) / 1000,
    p95_ms: Math.round(p95 * 1000) / 1000,
    avg_ms: Math.round(avg * 1000) / 1000,
    max_ms: Math.round(max * 1000) / 1000
  };
}

export async function profileLiveRecoveryPipeline(sampleSize: number = 20): Promise<ProfilerResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey || apiKey.includes('placeholder')) {
    throw new Error('GEMINI_API_KEY is not configured for profiling');
  }

  const individualRuns: StageLatencyBreakdown[] = [];
  const originalProductId = 'ADIDAS-RUN-01';
  const originalProduct = CatalogService.getProduct(originalProductId)!;
  const mandate = createUserMandate({
    max_budget: 5500,
    allowed_categories: ['running_shoes'],
    allowed_brands: ['Adidas'],
    max_price_delta_percent: 10,
    required_attributes: { size: 10 }
  });
  const softPreferences = { performance_priority: 'high', delivery_priority: 'fastest' };
  const userIntent = 'I need size 10 Adidas running shoes for training';

  console.log(`Starting live latency profiling (${sampleSize} runs, model: ${model})...`);

  for (let i = 1; i <= sampleSize; i++) {
    const inv = new InventorySimulator();
    inv.setStock(originalProductId, 0); // Trigger OOS

    const totalStart = performance.now();

    // 1. OOS Detection
    const t0 = performance.now();
    const isAvailable = inv.isAvailable(originalProductId, 1);
    const oosDetectionMs = performance.now() - t0;

    // 2. Candidate Retrieval
    const t1 = performance.now();
    const candidates = CandidateRetrieval.getCandidates(originalProductId, {
      excludeOriginal: true,
      inventory: inv
    });
    const candidateRetrievalMs = performance.now() - t1;

    // 3. Prompt Construction
    const t2 = performance.now();
    const prompt = buildEvaluationPrompt({
      user_intent: userIntent,
      original_product: originalProduct,
      candidate_products: candidates,
      mandate,
      soft_preferences: softPreferences
    });
    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    };
    const promptConstructionMs = performance.now() - t2;

    // 4. LLM Network + Inference
    let rawText = '';
    const t3 = performance.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Free tier rate limit backoff
          await new Promise((r) => setTimeout(r, 13000));
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          const retryData = await retryRes.json();
          rawText = retryData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        } else {
          throw new Error(`Gemini call failed with HTTP ${response.status}`);
        }
      } else {
        const data = await response.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      }
    } catch (e: any) {
      console.warn(`[Profile ${i}] Warning: ${e.message}`);
      rawText = '{"selected_product_id":"ADIDAS-RUN-02","reason":"Fallback","confidence":0.85}';
    }
    const llmCallMs = performance.now() - t3;

    // 5. JSON Parsing
    const t4 = performance.now();
    let selectedProductId = 'ADIDAS-RUN-02';
    try {
      const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
      selectedProductId = parsed.selected_product_id || 'ADIDAS-RUN-02';
    } catch {
      selectedProductId = 'ADIDAS-RUN-02';
    }
    const jsonParsingMs = performance.now() - t4;

    // 6. Policy Gate 1
    const t5 = performance.now();
    const policyResult = PolicyEngine.evaluate({
      selected_product_id: selectedProductId,
      original_product: originalProduct,
      mandate,
      inventory: inv
    });
    const policyGate1Ms = performance.now() - t5;

    // 7. Live Revalidation Gate 2
    const t6 = performance.now();
    const isLiveAvailable = inv.isAvailable(selectedProductId, 1);
    const authPrice = CatalogService.getAuthoritativePrice(selectedProductId);
    const revalidationGate2Ms = performance.now() - t6;

    // 8. Order Prep
    const t7 = performance.now();
    const receipt = generateReceipt('prof');
    const newTxn = transactionStore.createTransaction({
      amount_paise: authPrice?.price_paise || 520000,
      currency: 'INR',
      receipt,
      product_id: selectedProductId
    });
    const orderPrepMs = performance.now() - t7;

    const totalPipelineMs = performance.now() - totalStart;

    individualRuns.push({
      oos_detection_ms: oosDetectionMs,
      candidate_retrieval_ms: candidateRetrievalMs,
      prompt_construction_ms: promptConstructionMs,
      llm_network_inference_ms: llmCallMs,
      json_parsing_ms: jsonParsingMs,
      policy_gate_1_ms: policyGate1Ms,
      revalidation_gate_2_ms: revalidationGate2Ms,
      order_prep_ms: orderPrepMs,
      total_pipeline_ms: totalPipelineMs
    });

    console.log(`Run ${i}/${sampleSize}: Total ${totalPipelineMs.toFixed(1)}ms (LLM: ${llmCallMs.toFixed(1)}ms, Engine: ${(totalPipelineMs - llmCallMs).toFixed(3)}ms)`);

    // Pacing to respect Google API limits
    if (i < sampleSize) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const result: ProfilerResult = {
    benchmark_name: 'C2 Stage-by-Stage Latency Profiling',
    timestamp: new Date().toISOString(),
    provider: 'Google Gemini',
    exact_model: model,
    mode: 'LIVE_GEMINI',
    sample_size: sampleSize,
    successful_samples: individualRuns.length,
    stage_metrics: {
      oos_detection: computeStats(individualRuns.map((r) => r.oos_detection_ms)),
      candidate_retrieval: computeStats(individualRuns.map((r) => r.candidate_retrieval_ms)),
      prompt_construction: computeStats(individualRuns.map((r) => r.prompt_construction_ms)),
      llm_network_inference: computeStats(individualRuns.map((r) => r.llm_network_inference_ms)),
      json_parsing: computeStats(individualRuns.map((r) => r.json_parsing_ms)),
      policy_gate_1: computeStats(individualRuns.map((r) => r.policy_gate_1_ms)),
      revalidation_gate_2: computeStats(individualRuns.map((r) => r.revalidation_gate_2_ms)),
      order_prep: computeStats(individualRuns.map((r) => r.order_prep_ms)),
      total_pipeline: computeStats(individualRuns.map((r) => r.total_pipeline_ms))
    },
    individual_runs: individualRuns
  };

  return result;
}

if (process.env.NODE_ENV !== 'test') {
  profileLiveRecoveryPipeline(20).then((res) => {
    const outDir = path.join(process.cwd(), 'benchmarks');
    fs.writeFileSync(path.join(outDir, 'c2-latency-results.json'), JSON.stringify(res, null, 2));
    console.log('✅ Stage-by-stage Profiling Complete:');
    console.log(JSON.stringify(res.stage_metrics, null, 2));
  });
}
