import { Product, UserMandate, PolicyEvaluationResult } from '../commerce/types.js';
import { CatalogService } from '../commerce/catalog.js';
import { inventorySimulator, InventorySimulator } from '../commerce/inventorySimulator.js';
import {
  MerchantRecoveryPolicy,
  EffectivePolicy,
  resolveEffectivePolicy,
  DEFAULT_MERCHANT_POLICY
} from './merchantPolicy.js';

export interface PolicyValidationParams {
  selected_product_id: string;
  original_product: Product;
  mandate: UserMandate;
  merchant_policy?: MerchantRecoveryPolicy;
  inventory?: InventorySimulator;
}

export class PolicyEngine {
  /**
   * Evaluates a candidate product recommendation against both UserMandate and MerchantRecoveryPolicy.
   * AUTHORITATIVE DATA RULE: Always resolves the selected_product_id against ground-truth
   * catalog and inventory simulator. Never trusts external prices, attributes, or claims.
   */
  public static evaluate(params: PolicyValidationParams): PolicyEvaluationResult {
    const { selected_product_id, original_product, mandate, merchant_policy } = params;
    const inv = params.inventory ?? inventorySimulator;
    const failureReasons: string[] = [];

    // 0. Resolve Effective Policy (User Mandate ∩ Merchant Policy)
    const effective: EffectivePolicy = resolveEffectivePolicy(
      mandate,
      merchant_policy ?? DEFAULT_MERCHANT_POLICY
    );

    // 0a. Check if merchant has enabled auto-recovery
    if (!effective.auto_recovery_enabled) {
      return {
        status: 'FAIL',
        reasons: ['Merchant has disabled automated recovery (auto_recovery_enabled: false).']
      };
    }

    // 1. Resolve product against authoritative catalog
    const catalogProduct = CatalogService.getProduct(selected_product_id);
    if (!catalogProduct) {
      return {
        status: 'FAIL',
        reasons: [`Product '${selected_product_id}' does not exist in authoritative catalog.`]
      };
    }

    // 2. Authoritative Inventory check (must be in stock)
    if (!inv.isAvailable(selected_product_id, 1)) {
      failureReasons.push(
        `Product '${selected_product_id}' is OUT OF STOCK (available: ${inv.getStock(selected_product_id)}).`
      );
    }

    // 3. Category constraint check (Effective intersection)
    if (!effective.effective_allowed_categories.includes(catalogProduct.category)) {
      failureReasons.push(
        `Category '${catalogProduct.category}' is not permitted by effective policy (allowed: [${effective.effective_allowed_categories.join(', ')}]).`
      );
    }

    // 4. Brand constraint check (Effective intersection)
    if (!effective.effective_allowed_brands.includes(catalogProduct.brand)) {
      failureReasons.push(
        `Brand '${catalogProduct.brand}' is not permitted by effective policy (allowed: [${effective.effective_allowed_brands.join(', ')}]).`
      );
    }

    // 5. Required attributes check (e.g. size)
    if (effective.effective_required_attributes) {
      for (const [key, expectedValue] of Object.entries(effective.effective_required_attributes)) {
        const actualValue = catalogProduct.attributes[key];
        if (actualValue !== expectedValue) {
          failureReasons.push(
            `Attribute '${key}' mismatch: required ${expectedValue}, but product has ${actualValue ?? 'undefined'}.`
          );
        }
      }
    }

    // 6. Max Budget constraint check (Effective minimum budget)
    if (catalogProduct.price_inr > effective.effective_max_budget) {
      failureReasons.push(
        `Authoritative price ₹${catalogProduct.price_inr} exceeds maximum budget ₹${effective.effective_max_budget}.`
      );
    }

    // 7. Max Price Delta constraint check (Effective minimum tolerance)
    const priceDeltaInr = catalogProduct.price_inr - original_product.price_inr;
    const priceDeltaPercent = (priceDeltaInr / original_product.price_inr) * 100;
    if (priceDeltaPercent > effective.effective_max_price_delta_percent) {
      failureReasons.push(
        `Price delta +${priceDeltaPercent.toFixed(2)}% (₹${priceDeltaInr}) exceeds allowed effective maximum +${effective.effective_max_price_delta_percent}%.`
      );
    }

    // 8. Minimum Margin constraint check
    const productMargin = Number(catalogProduct.attributes.margin_percent ?? 25); // Default catalog margin
    if (productMargin < effective.effective_minimum_margin_percent) {
      failureReasons.push(
        `Product margin (${productMargin}%) is below merchant minimum margin requirement (${effective.effective_minimum_margin_percent}%).`
      );
    }

    if (failureReasons.length > 0) {
      return {
        status: 'FAIL',
        reasons: failureReasons
      };
    }

    return {
      status: 'PASS',
      reasons: ['All effective mandate and merchant policy constraints satisfied by authoritative catalog data.'],
      authorized_product: catalogProduct
    };
  }
}
