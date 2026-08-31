import { LLMEvaluationInput, LLMEvaluationResult } from '../../commerce/types.js';

export interface LLMProvider {
  readonly name: string;
  readonly isMock: boolean;
  evaluate(input: LLMEvaluationInput): Promise<LLMEvaluationResult>;
}
