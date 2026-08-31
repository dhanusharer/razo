export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price_inr: number;
  price_paise: number;
  cost_inr?: number;
  cost_paise?: number;
  currency: string;
  attributes: {
    size?: number | string;
    color?: string;
    performance?: 'high' | 'medium' | 'low';
    delivery_days?: number;
    margin_percent?: number;
    [key: string]: unknown;
  };
  description?: string;
}

export interface CatalogItem extends Product {
  initial_stock: number;
}

export interface UserMandate {
  readonly max_budget: number; // In INR (e.g. 5500)
  readonly allowed_categories: readonly string[];
  readonly allowed_brands: readonly string[];
  readonly max_price_delta_percent: number; // e.g. 10 for 10%
  readonly required_attributes: Readonly<Record<string, unknown>>;
}

export interface SoftPreferences {
  readonly delivery_priority?: 'fastest' | 'standard' | 'flexible';
  readonly performance_priority?: 'high' | 'medium' | 'low';
  readonly comfort_priority?: 'high' | 'medium' | 'low';
  readonly preferred_brand_strength?: 'strict' | 'moderate' | 'flexible';
  readonly preferred_brands?: readonly string[];
  readonly max_delivery_days?: number;
  readonly notes?: string;
  readonly [key: string]: unknown;
}

export interface CandidateRetrievalOptions {
  excludeOriginal?: boolean;
  onlyInStock?: boolean;
}

export interface LLMEvaluationInput {
  user_intent: string;
  original_product: Product;
  candidate_products: Product[];
  mandate: UserMandate;
  soft_preferences?: SoftPreferences;
}

export interface LLMEvaluationResult {
  selected_product_id: string;
  reason: string;
  confidence: number;
}

export interface PolicyEvaluationResult {
  status: 'PASS' | 'FAIL';
  reasons: string[];
  authorized_product?: Product;
}
