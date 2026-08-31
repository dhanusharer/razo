import { UserMandate } from './types.js';

export interface CreateMandateParams {
  max_budget: number;
  allowed_categories: string[];
  allowed_brands: string[];
  max_price_delta_percent: number;
  required_attributes: Record<string, unknown>;
}

/**
 * Creates an immutable UserMandate object.
 * Applies Object.freeze deeply to ensure runtime immutability.
 */
export function createUserMandate(params: CreateMandateParams): UserMandate {
  if (params.max_budget <= 0) {
    throw new Error('max_budget must be a positive number');
  }
  if (params.max_price_delta_percent < 0) {
    throw new Error('max_price_delta_percent cannot be negative');
  }

  const frozenMandate: UserMandate = Object.freeze({
    max_budget: params.max_budget,
    allowed_categories: Object.freeze([...params.allowed_categories]),
    allowed_brands: Object.freeze([...params.allowed_brands]),
    max_price_delta_percent: params.max_price_delta_percent,
    required_attributes: Object.freeze({ ...params.required_attributes })
  });

  return frozenMandate;
}

/**
 * Default Gate B test mandate:
 * - max_budget = 5500
 * - allowed_categories = ["running_shoes"]
 * - allowed_brands = ["Adidas"]
 * - max_price_delta_percent = 10
 * - required_attributes = { size: 10 }
 */
export const DEFAULT_TEST_MANDATE: UserMandate = createUserMandate({
  max_budget: 5500,
  allowed_categories: ['running_shoes'],
  allowed_brands: ['Adidas'],
  max_price_delta_percent: 10,
  required_attributes: { size: 10 }
});
