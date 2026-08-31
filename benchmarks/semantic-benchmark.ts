import fs from 'fs';
import path from 'path';
import { SeededPRNG } from './prng.js';
import { Product, UserMandate, SoftPreferences, LLMEvaluationInput } from '../src/commerce/types.js';
import { createUserMandate } from '../src/commerce/mandate.js';
import { LLMEvaluator } from '../src/agent/llmEvaluator.js';
import { MockLLMProvider } from '../src/agent/providers/mockProvider.js';
import { PolicyEngine } from '../src/policy/policyEngine.js';
import { InventorySimulator } from '../src/commerce/inventorySimulator.js';

export interface SemanticScenario {
  scenario_id: string;
  user_intent: string;
  original_product: Product;
  candidate_pool: Product[]; // >= 3 policy-valid candidates
  mandate: UserMandate;
  soft_preferences: SoftPreferences;
  expected_oracle_rank1_id: string;
  expected_oracle_rank2_id: string;
  oracle_scores: Record<string, number>;
}

export interface SemanticEvaluationMetrics {
  benchmark_name: string;
  timestamp: string;
  dataset_type: 'DETERMINISTIC_SEMANTIC_EVALUATION_SET';
  random_seed: number;
  total_scenarios: number;
  policy_valid_candidate_count_per_scenario: number;
  top_1_exact_matches: number;
  top_2_acceptable_matches: number;
  invalid_selections: number;
  semantic_selection_accuracy: number; // Top-1 accuracy %
  top_2_selection_rate: number;         // Top-2 acceptable rate %
  invalid_selection_rate: number;      // Invalid candidate selection % (Target: 0%)
  average_confidence: number;
}

/**
 * Multi-Attribute Utility Function (Oracle)
 * Computes deterministic preference utility score for each candidate
 */
export function computeOracleScore(
  candidate: Product,
  original: Product,
  soft_preferences: SoftPreferences,
  mandate: UserMandate
): number {
  let score = 50.0;

  // 1. Performance Priority (Weight: 35 pts)
  if (soft_preferences.performance_priority === 'high') {
    if (candidate.attributes.performance === 'high') score += 35.0;
    else if (candidate.attributes.performance === 'medium') score += 15.0;
    else score += 5.0;
  }

  // 2. Delivery Priority (Weight: 35 pts)
  if (soft_preferences.delivery_priority === 'fastest') {
    const days = Number(candidate.attributes.delivery_days ?? 3);
    if (days <= 1) score += 35.0;
    else if (days === 2) score += 20.0;
    else score += 5.0;
  }

  // 3. Price Value Optimization (Weight: 20 pts)
  const priceDelta = candidate.price_inr - original.price_inr;
  const deltaPercent = (priceDelta / original.price_inr) * 100;
  if (deltaPercent <= 5.0) {
    score += 20.0; // Lower price delta preferred
  } else if (deltaPercent <= 10.0) {
    score += 10.0;
  }

  // 4. Cushion Priority (Weight: 15 pts)
  if (soft_preferences.cushion_priority === 'plush') {
    if (candidate.attributes.cushion === 'plush') score += 15.0;
    else if (candidate.attributes.cushion === 'balanced') score += 8.0;
  }

  return score;
}

export class SemanticBenchmark {
  private prng: SeededPRNG;
  private readonly seed: number;
  private readonly scenarioCount: number;

  constructor(seed: number = 42026, scenarioCount: number = 50) {
    this.seed = seed;
    this.scenarioCount = scenarioCount;
    this.prng = new SeededPRNG(seed);
  }

  public generateScenarios(): SemanticScenario[] {
    const scenarios: SemanticScenario[] = [];

    const originalProduct: Product = {
      id: 'ADIDAS-RUN-01',
      name: 'Adidas Boston 12',
      brand: 'Adidas',
      category: 'running_shoes',
      price_inr: 4900,
      price_paise: 490000,
      currency: 'INR',
      attributes: { size: 10, performance: 'high', delivery_days: 3, cushion: 'balanced' },
      description: 'Original baseline product (₹4,900, Size 10)'
    };

    const candidatePoolTemplates: Product[] = [
      {
        id: 'ADIDAS-RUN-02',
        name: 'Adidas Adizero SL2 (Speed Edition)',
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: 5200,
        price_paise: 520000,
        currency: 'INR',
        attributes: { size: 10, performance: 'high', delivery_days: 2, cushion: 'firm' },
        description: 'High performance racing substitute (+6.12% delta)'
      },
      {
        id: 'ADIDAS-RUN-05',
        name: 'Adidas Supernova Rise (Express Delivery)',
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: 5100,
        price_paise: 510000,
        currency: 'INR',
        attributes: { size: 10, performance: 'medium', delivery_days: 1, cushion: 'plush' },
        description: '1-day fastest delivery daily trainer (+4.08% delta)'
      },
      {
        id: 'ADIDAS-RUN-06',
        name: 'Adidas Solarglide 6 (Max Cushion)',
        brand: 'Adidas',
        category: 'running_shoes',
        price_inr: 5300,
        price_paise: 530000,
        currency: 'INR',
        attributes: { size: 10, performance: 'medium', delivery_days: 3, cushion: 'plush' },
        description: 'Plush maximum comfort trainer (+8.16% delta)'
      }
    ];

    const mandate = createUserMandate({
      max_budget: 5500,
      allowed_categories: ['running_shoes'],
      allowed_brands: ['Adidas'],
      max_price_delta_percent: 10,
      required_attributes: { size: 10 }
    });

    const preferenceProfiles: Array<{ intent: string; prefs: SoftPreferences }> = [
      {
        intent: 'Urgent race weekend, I need the fastest 1-day delivery option in size 10.',
        prefs: { delivery_priority: 'fastest', performance_priority: 'standard' }
      },
      {
        intent: 'Marathon training competition, maximum race performance is my top priority in size 10.',
        prefs: { performance_priority: 'high', delivery_priority: 'standard' }
      },
      {
        intent: 'High mileage recovery runs, I need maximum plush cushion and soft comfort.',
        prefs: { cushion_priority: 'plush', performance_priority: 'standard' }
      },
      {
        intent: 'Balanced training shoe with fastest shipping to my address.',
        prefs: { delivery_priority: 'fastest', cushion_priority: 'balanced' }
      },
      {
        intent: 'Need lightweight fast shoe with solid energy return in size 10.',
        prefs: { performance_priority: 'high', cushion_priority: 'firm' }
      }
    ];

    for (let i = 1; i <= this.scenarioCount; i++) {
      const profile = this.prng.choice(preferenceProfiles);
      const scenarioId = `sem_scen_${i.toString().padStart(3, '0')}`;

      // Calculate deterministic Oracle scores for all 3 candidates
      const oracleScores: Record<string, number> = {};
      for (const cand of candidatePoolTemplates) {
        oracleScores[cand.id] = computeOracleScore(cand, originalProduct, profile.prefs, mandate);
      }

      const sortedByScore = [...candidatePoolTemplates].sort(
        (a, b) => oracleScores[b.id] - oracleScores[a.id]
      );

      scenarios.push({
        scenario_id: scenarioId,
        user_intent: profile.intent,
        original_product: originalProduct,
        candidate_pool: candidatePoolTemplates,
        mandate,
        soft_preferences: profile.prefs,
        expected_oracle_rank1_id: sortedByScore[0].id,
        expected_oracle_rank2_id: sortedByScore[1].id,
        oracle_scores: oracleScores
      });
    }

    return scenarios;
  }

  public async run(): Promise<{ metrics: SemanticEvaluationMetrics; scenario_details: any[] }> {
    const scenarios = this.generateScenarios();
    const details: any[] = [];
    const provider = new MockLLMProvider();

    let top1Matches = 0;
    let top2Matches = 0;
    let invalidSelections = 0;
    let totalConfidence = 0;

    for (const scen of scenarios) {
      const evalInput: LLMEvaluationInput = {
        user_intent: scen.user_intent,
        original_product: scen.original_product,
        candidate_products: scen.candidate_pool,
        mandate: scen.mandate,
        soft_preferences: scen.soft_preferences
      };

      const result = await provider.evaluate(evalInput);
      totalConfidence += result.confidence;

      const isRank1 = result.selected_product_id === scen.expected_oracle_rank1_id;
      const isRank2 = result.selected_product_id === scen.expected_oracle_rank2_id;
      const isTop2 = isRank1 || isRank2;

      // Assert Policy Engine validity
      const inv = new InventorySimulator();
      inv.setStock(result.selected_product_id, 5);
      const policyCheck = PolicyEngine.evaluate({
        selected_product_id: result.selected_product_id,
        original_product: scen.original_product,
        mandate: scen.mandate,
        inventory: inv
      });

      const isPolicyValid = policyCheck.status === 'PASS';
      if (!isPolicyValid) {
        invalidSelections++;
      }

      if (isRank1) top1Matches++;
      if (isTop2) top2Matches++;

      details.push({
        scenario_id: scen.scenario_id,
        user_intent: scen.user_intent,
        selected_product_id: result.selected_product_id,
        oracle_rank1: scen.expected_oracle_rank1_id,
        oracle_rank2: scen.expected_oracle_rank2_id,
        is_exact_match: isRank1,
        is_top2_match: isTop2,
        policy_valid: isPolicyValid,
        confidence: result.confidence,
        reason: result.reason
      });
    }

    const accuracy = (top1Matches / this.scenarioCount) * 100;
    const top2Rate = (top2Matches / this.scenarioCount) * 100;
    const invalidRate = (invalidSelections / this.scenarioCount) * 100;
    const avgConf = totalConfidence / this.scenarioCount;

    const metrics: SemanticEvaluationMetrics = {
      benchmark_name: 'Resilient-Agent-Relay Dedicated Semantic Quality Benchmark',
      timestamp: new Date().toISOString(),
      dataset_type: 'DETERMINISTIC_SEMANTIC_EVALUATION_SET',
      random_seed: this.seed,
      total_scenarios: this.scenarioCount,
      policy_valid_candidate_count_per_scenario: 3,
      top_1_exact_matches: top1Matches,
      top_2_acceptable_matches: top2Matches,
      invalid_selections: invalidSelections,
      semantic_selection_accuracy: Math.round(accuracy * 100) / 100,
      top_2_selection_rate: Math.round(top2Rate * 100) / 100,
      invalid_selection_rate: Math.round(invalidRate * 100) / 100,
      average_confidence: Math.round(avgConf * 100) / 100
    };

    return { metrics, scenario_details: details };
  }
}

if (process.env.NODE_ENV !== 'test') {
  const runner = new SemanticBenchmark(42026, 50);
  runner.run().then(({ metrics, scenario_details }) => {
    const outDir = path.join(process.cwd(), 'benchmarks');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, 'semantic-quality-results.json');
    fs.writeFileSync(outFile, JSON.stringify({ metrics, sample_evaluations: scenario_details.slice(0, 10) }, null, 2));
    console.log('✅ Semantic Selection Quality Benchmark Completed Successfully:');
    console.log(JSON.stringify(metrics, null, 2));
  });
}
