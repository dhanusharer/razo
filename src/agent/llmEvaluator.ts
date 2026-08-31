import { LLMEvaluationInput, LLMEvaluationResult } from '../commerce/types.js';
import { LLMProvider, getLLMProvider } from './providers/index.js';

export class LLMEvaluator {
  /**
   * Evaluates candidate products against user intent and preferences.
   * Performs semantic trade-off reasoning across price, delivery, performance, brand, and attributes.
   * Returns ONLY { selected_product_id, reason, confidence }.
   */
  public static async evaluate(
    input: LLMEvaluationInput,
    options?: { provider?: LLMProvider; forceMock?: boolean }
  ): Promise<LLMEvaluationResult> {
    const provider = options?.provider ?? getLLMProvider({ forceMock: options?.forceMock });

    // Execute evaluation through provider (Live Gemini or Mock Semantic Engine)
    const result = await provider.evaluate(input);

    // Validate strictly structured JSON output
    if (!result.selected_product_id || typeof result.selected_product_id !== 'string') {
      throw new Error('LLM Evaluation failed: missing or invalid selected_product_id');
    }
    if (!result.reason || typeof result.reason !== 'string') {
      throw new Error('LLM Evaluation failed: missing or invalid reason');
    }
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error('LLM Evaluation failed: confidence must be a number between 0.0 and 1.0');
    }

    return {
      selected_product_id: result.selected_product_id,
      reason: result.reason,
      confidence: Math.round(result.confidence * 100) / 100
    };
  }
}
