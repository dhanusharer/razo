import { UserMandate } from '../commerce/types.js';

export interface MerchantRecoveryPolicy {
  readonly policy_id: string;
  readonly policy_version: number;
  readonly created_at: string;
  readonly max_substitution_price_delta_percent?: number;
  readonly max_recovery_amount_inr?: number;
  readonly allowed_brands?: readonly string[];
  readonly allowed_categories?: readonly string[];
  readonly max_recovery_attempts?: number;
  readonly minimum_margin_percent?: number;
  readonly auto_recovery_enabled: boolean;
  readonly escalation_on_llm_timeout: boolean;
}

export interface EffectivePolicy {
  readonly user_mandate: UserMandate;
  readonly merchant_policy: MerchantRecoveryPolicy;
  readonly effective_max_budget: number;
  readonly effective_max_price_delta_percent: number;
  readonly effective_allowed_brands: readonly string[];
  readonly effective_allowed_categories: readonly string[];
  readonly effective_required_attributes: Readonly<Record<string, unknown>>;
  readonly effective_minimum_margin_percent: number;
  readonly effective_max_recovery_attempts: number;
  readonly auto_recovery_enabled: boolean;
  readonly escalation_on_llm_timeout: boolean;
}

export const DEFAULT_MERCHANT_POLICY: MerchantRecoveryPolicy = Object.freeze({
  policy_id: 'pol_default_merchant_v1',
  policy_version: 1,
  created_at: '2026-08-31T00:00:00.000Z',
  max_substitution_price_delta_percent: 10,
  max_recovery_amount_inr: 5500,
  allowed_brands: Object.freeze(['Adidas']),
  allowed_categories: Object.freeze(['running_shoes']),
  max_recovery_attempts: 2,
  minimum_margin_percent: 10,
  auto_recovery_enabled: true,
  escalation_on_llm_timeout: true
});

/**
 * Resolves the effective policy by calculating the strict intersection (most restrictive combination)
 * between the UserMandate and the MerchantRecoveryPolicy.
 * 
 * INVARIANT: Merchant policy can NEVER expand authority granted by UserMandate.
 */
export function resolveEffectivePolicy(
  userMandate: UserMandate,
  merchantPolicy: MerchantRecoveryPolicy = DEFAULT_MERCHANT_POLICY
): EffectivePolicy {
  // 1. Budget: Minimum of user budget and merchant maximum recovery amount
  const effectiveMaxBudget = Math.min(
    userMandate.max_budget,
    merchantPolicy.max_recovery_amount_inr ?? Infinity
  );

  // 2. Price Delta: Minimum of user tolerance and merchant tolerance
  const effectiveMaxDelta = Math.min(
    userMandate.max_price_delta_percent,
    merchantPolicy.max_substitution_price_delta_percent ?? Infinity
  );

  // 3. Brands: Strict Intersection (User ∩ Merchant)
  const effectiveBrands = userMandate.allowed_brands.filter((brand) =>
    merchantPolicy.allowed_brands ? merchantPolicy.allowed_brands.includes(brand) : true
  );

  // 4. Categories: Strict Intersection (User ∩ Merchant)
  const effectiveCategories = userMandate.allowed_categories.filter((cat) =>
    merchantPolicy.allowed_categories ? merchantPolicy.allowed_categories.includes(cat) : true
  );

  return Object.freeze({
    user_mandate: userMandate,
    merchant_policy: merchantPolicy,
    effective_max_budget: effectiveMaxBudget,
    effective_max_price_delta_percent: effectiveMaxDelta,
    effective_allowed_brands: Object.freeze(effectiveBrands),
    effective_allowed_categories: Object.freeze(effectiveCategories),
    effective_required_attributes: userMandate.required_attributes,
    effective_minimum_margin_percent: merchantPolicy.minimum_margin_percent ?? 0,
    effective_max_recovery_attempts: merchantPolicy.max_recovery_attempts ?? 2,
    auto_recovery_enabled: merchantPolicy.auto_recovery_enabled ?? true,
    escalation_on_llm_timeout: merchantPolicy.escalation_on_llm_timeout ?? true
  });
}

export function createMerchantPolicy(params: Partial<MerchantRecoveryPolicy> & { policy_id?: string }): MerchantRecoveryPolicy {
  return Object.freeze({
    policy_id: params.policy_id || `pol_merchant_${Date.now()}`,
    policy_version: params.policy_version || 1,
    created_at: params.created_at || new Date().toISOString(),
    max_substitution_price_delta_percent: params.max_substitution_price_delta_percent ?? 10,
    max_recovery_amount_inr: params.max_recovery_amount_inr ?? 5500,
    allowed_brands: params.allowed_brands ? Object.freeze([...params.allowed_brands]) : Object.freeze(['Adidas']),
    allowed_categories: params.allowed_categories ? Object.freeze([...params.allowed_categories]) : Object.freeze(['running_shoes']),
    max_recovery_attempts: params.max_recovery_attempts ?? 2,
    minimum_margin_percent: params.minimum_margin_percent ?? 10,
    auto_recovery_enabled: params.auto_recovery_enabled ?? true,
    escalation_on_llm_timeout: params.escalation_on_llm_timeout ?? true
  });
}
