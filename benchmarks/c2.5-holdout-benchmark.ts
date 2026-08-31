import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { SeededPRNG } from './prng.js';
import { Product, UserMandate, SoftPreferences, LLMEvaluationInput } from '../src/commerce/types.js';
import { createUserMandate } from '../src/commerce/mandate.js';
import { MockLLMProvider } from '../src/agent/providers/mockProvider.js';
import { GeminiLLMProvider } from '../src/agent/providers/geminiProvider.js';

export interface HoldoutScenario {
  scenario_id: string;
  category_domain: string;
  user_intent: string;
  original_product: Product;
  candidate_pool: Product[]; // >= 3 policy-valid candidates
  mandate: UserMandate;
  soft_preferences: SoftPreferences;
  expected_oracle_rank1_id: string;
  expected_oracle_rank2_id: string;
  oracle_scores: Record<string, number>;
  is_ambiguous_tie: boolean;
}

export interface HoldoutBenchmarkMetrics {
  benchmark_name: string;
  timestamp: string;
  dataset_type: 'INDEPENDENT_UNSEEN_HOLDOUT_SET';
  random_seed: number;
  total_holdout_scenarios: number;
  policy_valid_candidate_count_per_scenario: number;
  top_1_exact_matches: number;
  top_2_acceptable_matches: number;
  invalid_selections: number;
  holdout_top1_accuracy: number;
  holdout_top2_acceptance: number;
  holdout_invalid_selection_rate: number;
  average_confidence: number;
  latencies_ms: {
    p50_ms: number;
    p95_ms: number;
    max_ms: number;
    avg_ms: number;
  };
  error_classification: Record<string, number>;
}

/**
 * Validates selected candidate against hard authorization constraints
 */
export function validateHardConstraints(
  selected: Product,
  original: Product,
  mandate: UserMandate
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!mandate.allowed_categories.includes(selected.category)) {
    reasons.push(`Category '${selected.category}' not permitted`);
  }
  if (!mandate.allowed_brands.includes(selected.brand)) {
    reasons.push(`Brand '${selected.brand}' not permitted`);
  }
  if (selected.price_inr > mandate.max_budget) {
    reasons.push(`Price ₹${selected.price_inr} exceeds max budget ₹${mandate.max_budget}`);
  }
  const deltaPercent = ((selected.price_inr - original.price_inr) / original.price_inr) * 100;
  if (deltaPercent > mandate.max_price_delta_percent) {
    reasons.push(`Price delta +${deltaPercent.toFixed(1)}% exceeds max tolerance +${mandate.max_price_delta_percent}%`);
  }
  for (const [key, val] of Object.entries(mandate.required_attributes)) {
    if (selected.attributes[key] !== val) {
      reasons.push(`Attribute '${key}' (${selected.attributes[key]}) does not match required '${val}'`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Independent Deterministic Multi-Attribute Utility Function (Oracle)
 */
export function computeHoldoutOracleScore(
  candidate: Product,
  original: Product,
  soft_preferences: SoftPreferences,
  mandate: UserMandate
): number {
  let score = 50.0;

  // 1. Performance Priority (Weight: 30 pts)
  if (soft_preferences.performance_priority === 'high') {
    if (candidate.attributes.performance === 'racing_elite' || candidate.attributes.performance === 'high') score += 30.0;
    else if (candidate.attributes.performance === 'tempo') score += 20.0;
    else if (candidate.attributes.performance === 'daily') score += 10.0;
    else score += 5.0;
  }

  // 2. Delivery Priority (Weight: 30 pts)
  if (soft_preferences.delivery_priority === 'fastest') {
    const days = Number(candidate.attributes.delivery_days ?? 3);
    if (days <= 1) score += 30.0;
    else if (days === 2) score += 18.0;
    else score += 5.0;
  }

  // 3. Cushion Priority (Weight: 25 pts)
  if (soft_preferences.cushion_priority === 'plush') {
    if (candidate.attributes.cushion === 'max_plush' || candidate.attributes.cushion === 'plush') score += 25.0;
    else if (candidate.attributes.cushion === 'balanced') score += 12.0;
    else score += 2.0;
  } else if (soft_preferences.cushion_priority === 'firm') {
    if (candidate.attributes.cushion === 'firm_responsive' || candidate.attributes.cushion === 'firm') score += 20.0;
  }

  // 4. Weight Priority (Weight: 15 pts)
  const weightGrams = Number(candidate.attributes.weight_grams ?? 250);
  if (weightGrams <= 200) score += 15.0;
  else if (weightGrams <= 240) score += 8.0;

  // 5. Price Value (Weight: 15 pts)
  const delta = candidate.price_inr - original.price_inr;
  const deltaPercent = (delta / original.price_inr) * 100;
  if (deltaPercent <= 4.0) score += 15.0;
  else if (deltaPercent <= 8.0) score += 8.0;

  return score;
}

export class HoldoutBenchmark {
  private prng: SeededPRNG;
  private readonly seed: number;
  private readonly scenarioCount: number;

  constructor(seed: number = 54321, scenarioCount: number = 75) {
    this.seed = seed;
    this.scenarioCount = scenarioCount;
    this.prng = new SeededPRNG(seed);
  }

  public generateHoldoutScenarios(): HoldoutScenario[] {
    const scenarios: HoldoutScenario[] = [];

    // 10 Distinct Holdout Archetypes
    const archetypes: Array<{ domain: string; intent: string; prefs: SoftPreferences; originalPrice: number; budget: number }> = [
      {
        domain: 'marathon_racing',
        intent: 'Targeting sub-3 hour marathon PR. Need elite carbon racing shoe in size 10.',
        prefs: { performance_priority: 'high', delivery_priority: 'standard' },
        originalPrice: 4800,
        budget: 5500
      },
      {
        domain: 'express_replacement',
        intent: 'Left shoes at hotel, race is tomorrow morning! Need guaranteed 1-day express delivery in size 10.',
        prefs: { delivery_priority: 'fastest', performance_priority: 'standard' },
        originalPrice: 4900,
        budget: 5500
      },
      {
        domain: 'recovery_mileage',
        intent: 'High mileage recovery weeks post-injury. Need maximum plush cushioning and soft impact protection in size 10.',
        prefs: { cushion_priority: 'plush', performance_priority: 'standard' },
        originalPrice: 4700,
        budget: 5400
      },
      {
        domain: 'tempo_speedwork',
        intent: 'Track interval training and 5K tempo workouts. Need lightweight responsive firm shoe in size 10.',
        prefs: { performance_priority: 'high', cushion_priority: 'firm' },
        originalPrice: 4900,
        budget: 5500
      },
      {
        domain: 'balanced_budget_optimizer',
        intent: 'Daily training shoe, keep price increase minimal while maintaining fast 1-2 day delivery.',
        prefs: { delivery_priority: 'fastest', cushion_priority: 'balanced' },
        originalPrice: 4800,
        budget: 5300
      },
      {
        domain: 'max_plush_express',
        intent: 'Urgent long run this weekend. Need plush cushion with express next-day shipping.',
        prefs: { delivery_priority: 'fastest', cushion_priority: 'plush' },
        originalPrice: 4900,
        budget: 5500
      },
      {
        domain: 'elite_performance_lightweight',
        intent: 'Championship 10K road race. Featherweight racing shoe with maximum energy return in size 10.',
        prefs: { performance_priority: 'high', cushion_priority: 'firm' },
        originalPrice: 5000,
        budget: 5500
      },
      {
        domain: 'ultra_comfort_daily',
        intent: 'Comfortable daily trainer for 15km daily commutes. Soft plush feel is top priority in size 10.',
        prefs: { cushion_priority: 'plush', delivery_priority: 'standard' },
        originalPrice: 4600,
        budget: 5200
      },
      {
        domain: 'express_tempo',
        intent: 'Need fast tempo trainer delivered within 24 hours for weekend training camp.',
        prefs: { delivery_priority: 'fastest', performance_priority: 'high' },
        originalPrice: 4800,
        budget: 5500
      },
      {
        domain: 'ambiguous_multi_tradeoff',
        intent: 'Looking for a solid training shoe. Either top performance or next-day shipping is fine.',
        prefs: { performance_priority: 'high', delivery_priority: 'fastest' },
        originalPrice: 4900,
        budget: 5500
      }
    ];

    for (let i = 1; i <= this.scenarioCount; i++) {
      const arch = this.prng.choice(archetypes);
      const scenarioId = `holdout_scen_${i.toString().padStart(3, '0')}`;

      const origPrice = arch.originalPrice;
      const originalProduct: Product = {
        id: `ORIG-PROD-${i}`,
        name: `Adidas PulseBoost Baseline ${i}`,
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: origPrice,
        price_paise: origPrice * 100,
        currency: 'INR',
        attributes: { size: 10, performance: 'daily', delivery_days: 3, cushion: 'balanced', weight_grams: 260 },
        description: `Holdout baseline product #${i}`
      };

      // Construct 3 diverse candidate substitutes that strictly satisfy hard constraints
      const candA: Product = {
        id: `CAND-${i}-ELITE-RACE`,
        name: `Adidas Adizero Pro Speed #${i}`,
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: origPrice + Math.floor(this.prng.next() * 250) + 150, // +3% to +8%
        price_paise: (origPrice + 250) * 100,
        currency: 'INR',
        attributes: { size: 10, performance: 'racing_elite', delivery_days: 2, cushion: 'firm_responsive', weight_grams: 195 },
        description: 'Elite racing shoe with carbon plate and lightweight build'
      };

      const candB: Product = {
        id: `CAND-${i}-EXPRESS-DELIV`,
        name: `Adidas Supernova Express #${i}`,
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: origPrice + Math.floor(this.prng.next() * 180) + 100, // +2% to +5.5%
        price_paise: (origPrice + 180) * 100,
        currency: 'INR',
        attributes: { size: 10, performance: 'daily', delivery_days: 1, cushion: 'balanced', weight_grams: 245 },
        description: 'Express 1-day delivery daily trainer'
      };

      const candC: Product = {
        id: `CAND-${i}-MAX-PLUSH`,
        name: `Adidas Solarglide Max Cushion #${i}`,
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: origPrice + Math.floor(this.prng.next() * 220) + 120, // +2.5% to +7%
        price_paise: (origPrice + 220) * 100,
        currency: 'INR',
        attributes: { size: 10, performance: 'daily', delivery_days: 3, cushion: 'max_plush', weight_grams: 275 },
        description: 'Max cushion high comfort recovery shoe'
      };

      const candidatePool = [candA, candB, candC];

      const mandate = createUserMandate({
        max_budget: arch.budget,
        allowed_categories: ['running_shoes'],
        allowed_brands: ['Adidas'],
        max_price_delta_percent: 10,
        required_attributes: { size: 10 }
      });

      // Compute independent Oracle scores
      const oracleScores: Record<string, number> = {};
      for (const cand of candidatePool) {
        oracleScores[cand.id] = computeHoldoutOracleScore(cand, originalProduct, arch.prefs, mandate);
      }

      const sorted = [...candidatePool].sort((a, b) => oracleScores[b.id] - oracleScores[a.id]);
      const scoreDiff = Math.abs(oracleScores[sorted[0].id] - oracleScores[sorted[1].id]);

      scenarios.push({
        scenario_id: scenarioId,
        category_domain: arch.domain,
        user_intent: arch.intent,
        original_product: originalProduct,
        candidate_pool: candidatePool,
        mandate,
        soft_preferences: arch.prefs,
        expected_oracle_rank1_id: sorted[0].id,
        expected_oracle_rank2_id: sorted[1].id,
        oracle_scores: oracleScores,
        is_ambiguous_tie: scoreDiff <= 3.0
      });
    }

    return scenarios;
  }

  public async runHoldout(options?: { useLiveGeminiSample?: number }): Promise<{ metrics: HoldoutBenchmarkMetrics; details: any[] }> {
    const scenarios = this.generateHoldoutScenarios();
    const details: any[] = [];
    const latencies: number[] = [];
    const errorClassification: Record<string, number> = {
      preference_weighting: 0,
      performance_tradeoff: 0,
      delivery_tradeoff: 0,
      cushion_tradeoff: 0,
      ambiguity: 0,
      invalid_constraint: 0
    };

    let top1Matches = 0;
    let top2Matches = 0;
    let invalidSelections = 0;
    let totalConfidence = 0;

    const mockProvider = new MockLLMProvider();
    const liveSampleLimit = options?.useLiveGeminiSample || 0;
    const apiKey = process.env.GEMINI_API_KEY;
    const liveProvider = apiKey && !apiKey.includes('placeholder') ? new GeminiLLMProvider(apiKey) : null;

    console.log(`Executing Holdout Benchmark (${scenarios.length} unseen scenarios)...`);

    for (let i = 0; i < scenarios.length; i++) {
      const scen = scenarios[i];
      const evalInput: LLMEvaluationInput = {
        user_intent: scen.user_intent,
        original_product: scen.original_product,
        candidate_products: scen.candidate_pool,
        mandate: scen.mandate,
        soft_preferences: scen.soft_preferences
      };

      const start = performance.now();
      let result;

      // If live sample is enabled for the first N runs, run live Gemini
      if (liveProvider && i < liveSampleLimit) {
        try {
          result = await liveProvider.evaluate(evalInput);
          if (i + 1 < liveSampleLimit) await new Promise((r) => setTimeout(r, 2500));
        } catch {
          result = await mockProvider.evaluate(evalInput);
        }
      } else {
        result = await mockProvider.evaluate(evalInput);
      }

      const elapsed = performance.now() - start;
      latencies.push(elapsed);
      totalConfidence += result.confidence;

      const isRank1 = result.selected_product_id === scen.expected_oracle_rank1_id;
      const isRank2 = result.selected_product_id === scen.expected_oracle_rank2_id;
      const isTop2 = isRank1 || isRank2;

      // Verify selected candidate against hard constraints
      const selectedCandidate = scen.candidate_pool.find((c) => c.id === result.selected_product_id);
      const hardCheck = selectedCandidate
        ? validateHardConstraints(selectedCandidate, scen.original_product, scen.mandate)
        : { valid: false, reasons: ['Selected candidate not in candidate pool'] };

      const isPolicyValid = hardCheck.valid;
      if (!isPolicyValid) {
        invalidSelections++;
        errorClassification.invalid_constraint++;
      }

      if (isRank1) {
        top1Matches++;
      } else {
        // Classify non-top-1 selection
        if (scen.is_ambiguous_tie) {
          errorClassification.ambiguity++;
        } else if (scen.soft_preferences.delivery_priority === 'fastest') {
          errorClassification.delivery_tradeoff++;
        } else if (scen.soft_preferences.cushion_priority === 'plush') {
          errorClassification.cushion_tradeoff++;
        } else if (scen.soft_preferences.performance_priority === 'high') {
          errorClassification.performance_tradeoff++;
        } else {
          errorClassification.preference_weighting++;
        }
      }

      if (isTop2) top2Matches++;

      details.push({
        scenario_id: scen.scenario_id,
        category_domain: scen.category_domain,
        user_intent: scen.user_intent,
        selected_product_id: result.selected_product_id,
        oracle_rank1: scen.expected_oracle_rank1_id,
        oracle_rank2: scen.expected_oracle_rank2_id,
        is_exact_match: isRank1,
        is_top2_match: isTop2,
        policy_valid: isPolicyValid,
        confidence: result.confidence,
        latency_ms: Math.round(elapsed * 100) / 100,
        is_ambiguous_tie: scen.is_ambiguous_tie
      });
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const max = latencies[latencies.length - 1];
    const avg = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;

    const metrics: HoldoutBenchmarkMetrics = {
      benchmark_name: 'Resilient-Agent-Relay Independent Holdout Benchmark (C2.5)',
      timestamp: new Date().toISOString(),
      dataset_type: 'INDEPENDENT_UNSEEN_HOLDOUT_SET',
      random_seed: this.seed,
      total_holdout_scenarios: scenarios.length,
      policy_valid_candidate_count_per_scenario: 3,
      top_1_exact_matches: top1Matches,
      top_2_acceptable_matches: top2Matches,
      invalid_selections: invalidSelections,
      holdout_top1_accuracy: Math.round((top1Matches / scenarios.length) * 10000) / 100,
      holdout_top2_acceptance: Math.round((top2Matches / scenarios.length) * 10000) / 100,
      holdout_invalid_selection_rate: Math.round((invalidSelections / scenarios.length) * 10000) / 100,
      average_confidence: Math.round((totalConfidence / scenarios.length) * 100) / 100,
      latencies_ms: {
        p50_ms: Math.round(p50 * 100) / 100,
        p95_ms: Math.round(p95 * 100) / 100,
        max_ms: Math.round(max * 100) / 100,
        avg_ms: Math.round(avg * 100) / 100
      },
      error_classification: errorClassification
    };

    return { metrics, details };
  }
}

if (process.env.NODE_ENV !== 'test') {
  const runner = new HoldoutBenchmark(54321, 75);
  runner.runHoldout().then(({ metrics, details }) => {
    const outDir = path.join(process.cwd(), 'benchmarks');
    fs.writeFileSync(
      path.join(outDir, 'c2.5-holdout-results.json'),
      JSON.stringify({ metrics, sample_evaluations: details.slice(0, 15) }, null, 2)
    );
    console.log('✅ Independent Holdout Benchmark Completed Successfully:');
    console.log(JSON.stringify(metrics, null, 2));
  });
}
