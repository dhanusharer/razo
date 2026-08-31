import { Product, UserMandate, SoftPreferences, LLMEvaluationResult, PolicyEvaluationResult } from '../commerce/types.js';
import { TransactionState } from '../types.js';
import { RazorpayOrderResult } from '../razorpay/razorpayAdapter.js';
import { MerchantRecoveryPolicy } from '../policy/merchantPolicy.js';

export type RecoveryOutcome =
  | 'VALID_SUBSTITUTE'
  | 'SUBSTITUTE_OUTSIDE_MANDATE'
  | 'NO_VALID_SUBSTITUTE'
  | 'REVALIDATION_FAILED'
  | 'RECOVERY_TIMEOUT'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'AUTO_RECOVERY_DISABLED'
  | 'ORIGINAL_IN_STOCK';

export type RecoveryDecisionType = 'AUTONOMOUS_RECOVERY' | 'ESCALATION_REQUIRED' | 'HARD_STOP';

export interface RecoveryRequest {
  user_intent: string;
  original_product_id: string;
  mandate: UserMandate;
  merchant_policy?: MerchantRecoveryPolicy;
  soft_preferences?: SoftPreferences;
  initial_transaction_id?: string;
  simulate_initial_oos?: boolean;
  recovery_attempt?: number;
}

export interface RecoveryResult {
  success: boolean;
  outcome: RecoveryOutcome;
  decision_type?: RecoveryDecisionType;
  status: TransactionState;
  original_transaction_id: string;
  recovered_transaction_id?: string;
  original_product_id: string;
  selected_product_id?: string;
  selected_product?: Product;
  authoritative_price_inr?: number;
  authoritative_price_paise?: number;
  razorpay_order?: RazorpayOrderResult;
  semantic_decision?: LLMEvaluationResult;
  policy_decision?: PolicyEvaluationResult;
  merchant_policy_id?: string;
  merchant_policy_version?: number;
  effective_constraints?: Record<string, unknown>;
  reasons?: string[];
}
