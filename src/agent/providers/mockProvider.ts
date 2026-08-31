import { LLMEvaluationInput, LLMEvaluationResult } from '../../commerce/types.js';
import { LLMProvider } from './types.js';

export class MockLLMProvider implements LLMProvider {
  public readonly name = 'Mock Semantic Trade-off Engine';
  public readonly isMock = true;

  public async evaluate(input: LLMEvaluationInput): Promise<LLMEvaluationResult> {
    const { candidate_products, mandate, soft_preferences, original_product } = input;

    if (!candidate_products || candidate_products.length === 0) {
      throw new Error('No candidate products provided for evaluation');
    }

    // Score each candidate product across semantic dimensions
    const scoredCandidates = candidate_products.map((candidate) => {
      let score = 50.0;
      const reasons: string[] = [];

      // 1. Brand Alignment
      if (mandate.allowed_brands.includes(candidate.brand)) {
        score += 20.0;
        reasons.push(`matches authorized brand ${candidate.brand}`);
      } else {
        score -= 40.0;
        reasons.push(`unauthorized brand ${candidate.brand}`);
      }

      // 2. Category Alignment
      if (mandate.allowed_categories.includes(candidate.category)) {
        score += 15.0;
        reasons.push(`matches category ${candidate.category}`);
      } else {
        score -= 30.0;
      }

      // 3. Required Attributes (Size, etc.)
      for (const [key, val] of Object.entries(mandate.required_attributes)) {
        if (candidate.attributes[key] === val) {
          score += 15.0;
          reasons.push(`matches ${key} ${val}`);
        } else {
          score -= 35.0;
          reasons.push(`mismatched ${key} (${candidate.attributes[key]} vs required ${val})`);
        }
      }

      // 4. Performance Alignment (Default / Soft Preference)
      const isPerfRequested = soft_preferences?.performance_priority === 'high' || !soft_preferences?.cushion_priority && !soft_preferences?.delivery_priority;
      if (candidate.attributes.performance === 'high') {
        score += isPerfRequested ? 30.0 : 15.0;
        reasons.push('delivers high performance');
      } else if (candidate.attributes.performance === 'medium') {
        score += 10.0;
      }

      // 5. Soft Preferences — Delivery Priority
      if (soft_preferences?.delivery_priority === 'fastest') {
        const deliveryDays = Number(candidate.attributes.delivery_days ?? 3);
        if (deliveryDays <= 1) {
          score += 35.0;
          reasons.push('provides fastest 1-day delivery');
        } else if (deliveryDays === 2) {
          score += 20.0;
          reasons.push('provides 2-day delivery');
        } else {
          score += 5.0;
        }
      }

      // 6. Soft Preferences — Cushion Priority
      if (soft_preferences?.cushion_priority === 'plush') {
        if (candidate.attributes.cushion === 'plush') {
          score += 35.0;
          reasons.push('provides maximum plush cushion');
        } else if (candidate.attributes.cushion === 'balanced') {
          score += 10.0;
        }
      } else if (soft_preferences?.cushion_priority === 'firm') {
        if (candidate.attributes.cushion === 'firm') {
          score += 20.0;
          reasons.push('provides responsive firm cushion');
        }
      }

      // 7. Price Value & Tolerance
      const priceDelta = candidate.price_inr - original_product.price_inr;
      const deltaPercent = (priceDelta / original_product.price_inr) * 100;
      if (candidate.price_inr <= mandate.max_budget && deltaPercent <= mandate.max_price_delta_percent) {
        score += 10.0;
        reasons.push(`within budget at ₹${candidate.price_inr} (+${deltaPercent.toFixed(1)}%)`);
      } else {
        score -= 30.0;
        reasons.push(`exceeds price criteria (₹${candidate.price_inr})`);
      }

      const keyReasons = reasons.filter((r) => !r.startsWith('matches category')).slice(0, 3);
      if (keyReasons.length === 0) keyReasons.push(...reasons.slice(0, 2));

      return {
        candidate,
        score,
        reasonSummary: keyReasons.join(', ')
      };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);
    const winner = scoredCandidates[0];
    const confidence = Math.min(Math.max(winner.score / 170, 0.55), 0.98);

    return {
      selected_product_id: winner.candidate.id,
      reason: `[MOCK MODE] Selected ${winner.candidate.name} (${winner.candidate.id}) because it ${winner.reasonSummary}.`,
      confidence: Math.round(confidence * 100) / 100
    };
  }
}
