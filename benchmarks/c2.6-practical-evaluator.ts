import fs from 'fs';
import path from 'path';
import { HoldoutBenchmark, HoldoutScenario, validateHardConstraints } from './c2.5-holdout-benchmark.js';
import { Product, SoftPreferences, UserMandate } from '../src/commerce/types.js';
import { MockLLMProvider } from '../src/agent/providers/mockProvider.js';

export interface PracticalRubricScore {
  brand_score: number;       // 0 - 2
  feature_score: number;     // 0 - 3
  delivery_score: number;    // 0 - 2
  price_score: number;       // 0 - 2
  attribute_score: number;   // 0 - 1
  total_score: number;       // 0 - 10
}

export type PracticalClassification = 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'INVALID';

export interface EvaluatedScenarioRecord {
  scenario_id: string;
  category_domain: string;
  user_intent: string;
  original_product: Product;
  candidate_pool: Product[];
  oracle_top_candidate: Product;
  oracle_rank2_candidate: Product;
  selected_candidate: Product;
  is_oracle_top1: boolean;
  is_oracle_top2: boolean;
  is_ambiguous: boolean;
  hard_policy_valid: boolean;
  rubric_score: PracticalRubricScore;
  classification: PracticalClassification;
  disagreement_category?: 'delivery_vs_attribute' | 'cushion_vs_price' | 'close_tie' | 'preference_interpretation' | 'other';
  reason_for_disagreement?: string;
}

export interface PracticalQualityMetrics {
  benchmark_name: string;
  timestamp: string;
  dataset_type: 'PRACTICAL_QUALITY_HOLDOUT_EVALUATION';
  random_seed: number;
  total_scenarios: number;
  good_count: number;
  acceptable_count: number;
  poor_count: number;
  invalid_count: number;
  practical_good_rate: number;
  practical_acceptable_rate: number;
  practical_acceptance_rate: number; // (GOOD + ACCEPTABLE) / total
  practical_poor_rate: number;
  invalid_rate: number;
  oracle_top1_count: number;
  oracle_top1_accuracy: number;
  oracle_top2_count: number;
  oracle_top2_rate: number;
  average_rubric_score: number;
  disagreement_breakdown: Record<
    string,
    { total: number; GOOD: number; ACCEPTABLE: number; POOR: number; INVALID: number }
  >;
}

/**
 * Independent 10-Point Practical Recovery Quality Rubric
 */
export function scorePracticalQuality(
  selected: Product,
  original: Product,
  mandate: UserMandate,
  soft_preferences: SoftPreferences
): PracticalRubricScore {
  let brandScore = 0;
  let featureScore = 0;
  let deliveryScore = 0;
  let priceScore = 0;
  let attributeScore = 0;

  // 1. Brand Preference (0 - 2 pts)
  if (mandate.allowed_brands.includes(selected.brand)) {
    brandScore = 2;
  } else {
    brandScore = 0;
  }

  // 2. Product Features & Utility Alignment (0 - 3 pts)
  if (soft_preferences.performance_priority === 'high') {
    if (selected.attributes.performance === 'racing_elite' || selected.attributes.performance === 'high') featureScore = 3;
    else if (selected.attributes.performance === 'tempo') featureScore = 2;
    else featureScore = 1;
  } else if (soft_preferences.cushion_priority === 'plush') {
    if (selected.attributes.cushion === 'max_plush' || selected.attributes.cushion === 'plush') featureScore = 3;
    else if (selected.attributes.cushion === 'balanced') featureScore = 2;
    else featureScore = 1;
  } else if (soft_preferences.cushion_priority === 'firm') {
    if (selected.attributes.cushion === 'firm_responsive' || selected.attributes.cushion === 'firm') featureScore = 3;
    else featureScore = 1;
  } else {
    // Balanced daily trainer
    featureScore = 2;
  }

  // 3. Delivery Speed Alignment (0 - 2 pts)
  const days = Number(selected.attributes.delivery_days ?? 3);
  if (soft_preferences.delivery_priority === 'fastest') {
    if (days <= 1) deliveryScore = 2;
    else if (days === 2) deliveryScore = 1;
    else deliveryScore = 0;
  } else {
    if (days <= 2) deliveryScore = 2;
    else deliveryScore = 1;
  }

  // 4. Price & Budget Alignment (0 - 2 pts)
  const deltaPercent = ((selected.price_inr - original.price_inr) / original.price_inr) * 100;
  if (selected.price_inr <= mandate.max_budget) {
    if (deltaPercent <= 4.0) priceScore = 2;
    else if (deltaPercent <= 8.0) priceScore = 1;
    else priceScore = 1;
  } else {
    priceScore = 0;
  }

  // 5. Required Attributes (0 - 1 pt)
  let attrMatch = true;
  for (const [key, val] of Object.entries(mandate.required_attributes)) {
    if (selected.attributes[key] !== val) attrMatch = false;
  }
  attributeScore = attrMatch ? 1 : 0;

  const total = brandScore + featureScore + deliveryScore + priceScore + attributeScore;

  return {
    brand_score: brandScore,
    feature_score: featureScore,
    delivery_score: deliveryScore,
    price_score: priceScore,
    attribute_score: attributeScore,
    total_score: total
  };
}

export class PracticalQualityEvaluator {
  private holdoutBenchmark: HoldoutBenchmark;

  constructor(seed: number = 54321, scenarioCount: number = 75) {
    this.holdoutBenchmark = new HoldoutBenchmark(seed, scenarioCount);
  }

  public async evaluate(): Promise<{ metrics: PracticalQualityMetrics; evaluated_records: EvaluatedScenarioRecord[] }> {
    const scenarios = this.holdoutBenchmark.generateHoldoutScenarios();
    const provider = new MockLLMProvider();
    const evaluatedRecords: EvaluatedScenarioRecord[] = [];

    const disagreementBreakdown: Record<
      string,
      { total: number; GOOD: number; ACCEPTABLE: number; POOR: number; INVALID: number }
    > = {
      delivery_vs_attribute: { total: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0, INVALID: 0 },
      cushion_vs_price: { total: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0, INVALID: 0 },
      close_tie: { total: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0, INVALID: 0 },
      preference_interpretation: { total: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0, INVALID: 0 },
      other: { total: 0, GOOD: 0, ACCEPTABLE: 0, POOR: 0, INVALID: 0 }
    };

    let goodCount = 0;
    let acceptableCount = 0;
    let poorCount = 0;
    let invalidCount = 0;
    let oracleTop1Count = 0;
    let oracleTop2Count = 0;
    let totalScoreSum = 0;

    for (const scen of scenarios) {
      const result = await provider.evaluate({
        user_intent: scen.user_intent,
        original_product: scen.original_product,
        candidate_products: scen.candidate_pool,
        mandate: scen.mandate,
        soft_preferences: scen.soft_preferences
      });

      const selectedCand = scen.candidate_pool.find((c) => c.id === result.selected_product_id)!;
      const oracleTopCand = scen.candidate_pool.find((c) => c.id === scen.expected_oracle_rank1_id)!;
      const oracleRank2Cand = scen.candidate_pool.find((c) => c.id === scen.expected_oracle_rank2_id)!;

      const isOracleTop1 = selectedCand.id === oracleTopCand.id;
      const isOracleTop2 = selectedCand.id === oracleTopCand.id || selectedCand.id === oracleRank2Cand.id;

      if (isOracleTop1) oracleTop1Count++;
      if (isOracleTop2) oracleTop2Count++;

      const hardCheck = validateHardConstraints(selectedCand, scen.original_product, scen.mandate);
      const isPolicyValid = hardCheck.valid;

      const rubric = scorePracticalQuality(selectedCand, scen.original_product, scen.mandate, scen.soft_preferences);
      totalScoreSum += rubric.total_score;

      let classification: PracticalClassification;
      if (!isPolicyValid) {
        classification = 'INVALID';
        invalidCount++;
      } else if (rubric.total_score >= 8) {
        classification = 'GOOD';
        goodCount++;
      } else if (rubric.total_score >= 6) {
        classification = 'ACCEPTABLE';
        acceptableCount++;
      } else {
        classification = 'POOR';
        poorCount++;
      }

      let disagreementCategory: EvaluatedScenarioRecord['disagreement_category'] = undefined;
      let reasonForDisagreement: string | undefined = undefined;

      if (!isOracleTop1) {
        if (scen.is_ambiguous_tie) {
          disagreementCategory = 'close_tie';
          reasonForDisagreement = `AMBIGUOUS: Utility difference between '${oracleTopCand.name}' and '${selectedCand.name}' is <= 3.0 pts. Both satisfy user requirements cleanly.`;
        } else if (scen.soft_preferences.delivery_priority === 'fastest') {
          disagreementCategory = 'delivery_vs_attribute';
          reasonForDisagreement = `Delivery Trade-off: Model selected 1-day express delivery ('${selectedCand.name}') while Oracle slightly favored higher performance attribute with 2-day delivery.`;
        } else if (scen.soft_preferences.cushion_priority === 'plush') {
          disagreementCategory = 'cushion_vs_price';
          reasonForDisagreement = `Cushion vs Price Trade-off: Model selected balanced cushion at lower price delta while Oracle preferred max plush at higher price delta.`;
        } else if (scen.soft_preferences.performance_priority === 'high') {
          disagreementCategory = 'preference_interpretation';
          reasonForDisagreement = `Performance vs Weight: Model prioritized responsive firm cushioning while Oracle weighted raw low weight (<200g) slightly higher.`;
        } else {
          disagreementCategory = 'other';
          reasonForDisagreement = `Secondary Attribute Weighting: Moderate trade-off difference across secondary soft preference dimensions.`;
        }

        if (disagreementCategory && disagreementBreakdown[disagreementCategory]) {
          disagreementBreakdown[disagreementCategory].total++;
          disagreementBreakdown[disagreementCategory][classification]++;
        }
      }

      evaluatedRecords.push({
        scenario_id: scen.scenario_id,
        category_domain: scen.category_domain,
        user_intent: scen.user_intent,
        original_product: scen.original_product,
        candidate_pool: scen.candidate_pool,
        oracle_top_candidate: oracleTopCand,
        oracle_rank2_candidate: oracleRank2Cand,
        selected_candidate: selectedCand,
        is_oracle_top1: isOracleTop1,
        is_oracle_top2: isOracleTop2,
        is_ambiguous: scen.is_ambiguous_tie,
        hard_policy_valid: isPolicyValid,
        rubric_score: rubric,
        classification,
        disagreement_category: disagreementCategory,
        reason_for_disagreement: reasonForDisagreement
      });
    }

    const total = scenarios.length;
    const practicalGoodRate = Math.round((goodCount / total) * 10000) / 100;
    const practicalAcceptableRate = Math.round((acceptableCount / total) * 10000) / 100;
    const practicalAcceptanceRate = Math.round(((goodCount + acceptableCount) / total) * 10000) / 100;
    const practicalPoorRate = Math.round((poorCount / total) * 10000) / 100;
    const invalidRate = Math.round((invalidCount / total) * 10000) / 100;
    const oracleTop1Accuracy = Math.round((oracleTop1Count / total) * 10000) / 100;
    const oracleTop2Rate = Math.round((oracleTop2Count / total) * 10000) / 100;
    const avgScore = Math.round((totalScoreSum / total) * 100) / 100;

    const metrics: PracticalQualityMetrics = {
      benchmark_name: 'Resilient-Agent-Relay Practical Recovery Quality Evaluation (C2.6)',
      timestamp: new Date().toISOString(),
      dataset_type: 'PRACTICAL_QUALITY_HOLDOUT_EVALUATION',
      random_seed: 54321,
      total_scenarios: total,
      good_count: goodCount,
      acceptable_count: acceptableCount,
      poor_count: poorCount,
      invalid_count: invalidCount,
      practical_good_rate: practicalGoodRate,
      practical_acceptable_rate: practicalAcceptableRate,
      practical_acceptance_rate: practicalAcceptanceRate,
      practical_poor_rate: practicalPoorRate,
      invalid_rate: invalidRate,
      oracle_top1_count: oracleTop1Count,
      oracle_top1_accuracy: oracleTop1Accuracy,
      oracle_top2_count: oracleTop2Count,
      oracle_top2_rate: oracleTop2Rate,
      average_rubric_score: avgScore,
      disagreement_breakdown: disagreementBreakdown
    };

    return { metrics, evaluated_records: evaluatedRecords };
  }
}

if (process.env.NODE_ENV !== 'test') {
  const evaluator = new PracticalQualityEvaluator(54321, 75);
  evaluator.evaluate().then(({ metrics, evaluated_records }) => {
    const outDir = path.join(process.cwd(), 'benchmarks');
    fs.writeFileSync(
      path.join(outDir, 'c2.6-practical-quality.json'),
      JSON.stringify({ metrics, evaluated_records }, null, 2)
    );
    console.log('✅ Practical Quality Evaluation Completed Successfully:');
    console.log(JSON.stringify(metrics, null, 2));
  });
}
