import { CatalogService } from '../commerce/catalog.js';
import { inventorySimulator, InventorySimulator } from '../commerce/inventorySimulator.js';
import { CandidateRetrieval } from '../commerce/candidateRetrieval.js';
import { LLMEvaluator } from '../agent/llmEvaluator.js';
import { PolicyEngine } from '../policy/policyEngine.js';
import {
  DEFAULT_MERCHANT_POLICY,
  resolveEffectivePolicy,
  EffectivePolicy,
  MerchantRecoveryPolicy
} from '../policy/merchantPolicy.js';
import { transactionStore } from '../state/transactionStore.js';
import { createRazorpayOrder, generateReceipt, RazorpayOrderResult } from '../razorpay/razorpayAdapter.js';
import { RecoveryRequest, RecoveryResult } from './types.js';
import { config } from '../config.js';
import { LLMProvider } from '../agent/providers/types.js';

export class RecoveryRelay {
  /**
   * Executes the autonomous recovery workflow:
   * 1. Validates original product in authoritative catalog
   * 2. Checks runtime inventory and detects failure (OOS)
   * 3. Resolves effective policy (UserMandate ∩ MerchantRecoveryPolicy)
   * 4. Enforces bounded retry limit (max_recovery_attempts)
   * 5. Performs Candidate Retrieval from authoritative catalog
   * 6. Invokes AI Semantic Trade-off Evaluator
   * 7. Runs Deterministic Policy Gate 1 (Hard Mandate + Merchant Constraints)
   * 8. Performs Live Revalidation Gate 2 (Stock + Authoritative Pricing)
   * 9. Places new Razorpay Test Mode Order and supersedes failed transaction
   * 10. Emits complete auditable state transitions
   */
  public static async executeRecovery(
    request: RecoveryRequest,
    options?: {
      provider?: LLMProvider;
      forceMock?: boolean;
      inventory?: InventorySimulator;
    }
  ): Promise<RecoveryResult> {
    const {
      user_intent,
      original_product_id,
      mandate,
      merchant_policy = DEFAULT_MERCHANT_POLICY,
      soft_preferences,
      initial_transaction_id,
      simulate_initial_oos,
      recovery_attempt = 1
    } = request;

    const inv = options?.inventory ?? inventorySimulator;

    // 0. Resolve Effective Policy (User Mandate ∩ Merchant Policy)
    const effective: EffectivePolicy = resolveEffectivePolicy(mandate, merchant_policy);

    // 1. Authoritative original product check
    const originalProduct = CatalogService.getProduct(original_product_id);
    if (!originalProduct) {
      throw new Error(`Original product '${original_product_id}' not found in authoritative catalog.`);
    }

    // 2. Resolve or create initial transaction
    let originalTxn = initial_transaction_id
      ? transactionStore.getTransaction(initial_transaction_id)
      : undefined;

    if (!originalTxn) {
      originalTxn = transactionStore.createTransaction({
        amount_paise: originalProduct.price_paise,
        currency: originalProduct.currency,
        receipt: generateReceipt('orig'),
        product_id: original_product_id
      });
    }

    const initialTxnId = originalTxn.internal_transaction_id;
    transactionStore.updateTransactionStatus(initialTxnId, 'CHECKOUT_STARTED');

    // 2a. Check if automated recovery is enabled by merchant
    if (!effective.auto_recovery_enabled) {
      transactionStore.updateTransactionStatus(initialTxnId, 'RECOVERY_EXHAUSTED');
      transactionStore.recordEvent('RECOVERY_FAILED', {
        internal_transaction_id: initialTxnId,
        result: 'FAILURE',
        details: {
          reason: 'AUTO_RECOVERY_DISABLED',
          decision_type: 'HARD_STOP',
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: effective.merchant_policy.policy_version
        }
      });

      return {
        success: false,
        outcome: 'AUTO_RECOVERY_DISABLED',
        decision_type: 'HARD_STOP',
        status: 'RECOVERY_EXHAUSTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        reasons: ['Merchant policy has disabled automated recovery (auto_recovery_enabled: false).']
      };
    }

    // 2b. Bounded Retry Guard: Enforce maximum recovery attempts
    if (recovery_attempt > effective.effective_max_recovery_attempts) {
      transactionStore.updateTransactionStatus(initialTxnId, 'POLICY_REJECTED');
      transactionStore.recordEvent('RECOVERY_FAILED', {
        internal_transaction_id: initialTxnId,
        result: 'FAILURE',
        details: {
          reason: 'MAX_ATTEMPTS_EXCEEDED',
          attempt: recovery_attempt,
          max_attempts: effective.effective_max_recovery_attempts
        }
      });

      return {
        success: false,
        outcome: 'MAX_ATTEMPTS_EXCEEDED',
        decision_type: 'ESCALATION_REQUIRED',
        status: 'POLICY_REJECTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        reasons: [
          `Recovery attempts (${recovery_attempt}) exceeded maximum allowed budget (${effective.effective_max_recovery_attempts}). Safe escalation triggered.`
        ]
      };
    }

    // 3. Runtime inventory check & failure detection
    const isOriginalInStock = simulate_initial_oos ? false : inv.isAvailable(original_product_id, 1);

    if (isOriginalInStock) {
      return {
        success: true,
        outcome: 'ORIGINAL_IN_STOCK',
        status: 'CHECKOUT_STARTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        reasons: ['Original product is in stock; recovery relay not required.']
      };
    }

    // Record FAILURE_DETECTED
    transactionStore.updateTransactionStatus(initialTxnId, 'FAILURE_DETECTED');
    transactionStore.recordEvent('FAILURE_DETECTED', {
      internal_transaction_id: initialTxnId,
      result: 'FAILURE',
      details: {
        reason: 'OUT_OF_STOCK',
        product_id: original_product_id,
        product_name: originalProduct.name,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version
      }
    });

    // 4. Candidate Retrieval
    transactionStore.updateTransactionStatus(initialTxnId, 'RECOVERY_EVALUATING');
    transactionStore.recordEvent('RECOVERY_EVALUATING', {
      internal_transaction_id: initialTxnId,
      result: 'SUCCESS',
      details: {
        original_product_id,
        user_mandate: mandate,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        effective_constraints: {
          max_budget: effective.effective_max_budget,
          max_delta_percent: effective.effective_max_price_delta_percent,
          allowed_brands: effective.effective_allowed_brands,
          allowed_categories: effective.effective_allowed_categories,
          minimum_margin_percent: effective.effective_minimum_margin_percent
        }
      }
    });

    const candidates = CandidateRetrieval.getCandidates(original_product_id, {
      excludeOriginal: true,
      inventory: inv
    });

    if (candidates.length === 0) {
      transactionStore.updateTransactionStatus(initialTxnId, 'RECOVERY_EXHAUSTED');
      transactionStore.recordEvent('RECOVERY_FAILED', {
        internal_transaction_id: initialTxnId,
        result: 'FAILURE',
        details: { reason: 'No candidate products available in catalog' }
      });

      return {
        success: false,
        outcome: 'NO_VALID_SUBSTITUTE',
        decision_type: 'ESCALATION_REQUIRED',
        status: 'RECOVERY_EXHAUSTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        reasons: ['No candidate products found in catalog.']
      };
    }

    // 5. AI Semantic Trade-off Evaluation
    let semanticDecision;
    try {
      semanticDecision = await LLMEvaluator.evaluate(
        {
          user_intent,
          original_product: originalProduct,
          candidate_products: candidates,
          mandate,
          soft_preferences
        },
        {
          provider: options?.provider,
          forceMock: options?.forceMock
        }
      );
    } catch (err: any) {
      if (err.message?.includes('RECOVERY_TIMEOUT') || err.name === 'TimeoutError') {
        transactionStore.updateTransactionStatus(initialTxnId, 'POLICY_REJECTED');
        transactionStore.recordEvent('RECOVERY_FAILED', {
          internal_transaction_id: initialTxnId,
          result: 'FAILURE',
          details: {
            reason: 'RECOVERY_TIMEOUT: AI evaluation exceeded configured time budget',
            merchant_policy_id: effective.merchant_policy.policy_id,
            merchant_policy_version: effective.merchant_policy.policy_version
          }
        });

        const decisionType = effective.escalation_on_llm_timeout ? 'ESCALATION_REQUIRED' : 'HARD_STOP';

        return {
          success: false,
          outcome: 'RECOVERY_TIMEOUT',
          decision_type: decisionType,
          status: 'POLICY_REJECTED',
          original_transaction_id: initialTxnId,
          original_product_id,
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: effective.merchant_policy.policy_version,
          reasons: ['AI evaluation timed out within configured recovery budget. Safe escalation triggered. Zero orders created.']
        };
      }
      throw err;
    }

    const selectedProductId = semanticDecision.selected_product_id;
    transactionStore.updateTransactionStatus(initialTxnId, 'CANDIDATE_SELECTED');
    transactionStore.recordEvent('CANDIDATE_SELECTED', {
      internal_transaction_id: initialTxnId,
      result: 'SUCCESS',
      details: {
        selected_product_id: selectedProductId,
        reason: semanticDecision.reason,
        confidence: semanticDecision.confidence,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version
      }
    });

    // 6. Policy Gate 1: Deterministic Effective Policy Authorization
    const policyResult = PolicyEngine.evaluate({
      selected_product_id: selectedProductId,
      original_product: originalProduct,
      mandate,
      merchant_policy: effective.merchant_policy,
      inventory: inv
    });

    if (policyResult.status !== 'PASS') {
      transactionStore.updateTransactionStatus(initialTxnId, 'POLICY_REJECTED');
      transactionStore.recordEvent('POLICY_REJECTED', {
        internal_transaction_id: initialTxnId,
        result: 'FAILURE',
        details: {
          selected_product_id: selectedProductId,
          reasons: policyResult.reasons,
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: effective.merchant_policy.policy_version
        }
      });

      return {
        success: false,
        outcome: 'SUBSTITUTE_OUTSIDE_MANDATE',
        decision_type: 'ESCALATION_REQUIRED',
        status: 'POLICY_REJECTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        selected_product_id: selectedProductId,
        semantic_decision: semanticDecision,
        policy_decision: policyResult,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        reasons: policyResult.reasons
      };
    }

    transactionStore.recordEvent('POLICY_PASSED', {
      internal_transaction_id: initialTxnId,
      result: 'SUCCESS',
      details: {
        selected_product_id: selectedProductId,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version
      }
    });

    // 7. Live Revalidation Gate 2: Real-time inventory and price verification
    const isLiveAvailable = inv.isAvailable(selectedProductId, 1);
    const authPrice = CatalogService.getAuthoritativePrice(selectedProductId);

    if (!isLiveAvailable || !authPrice) {
      transactionStore.updateTransactionStatus(initialTxnId, 'RECOVERY_EXHAUSTED');
      transactionStore.recordEvent('REVALIDATION_FAILED', {
        internal_transaction_id: initialTxnId,
        result: 'FAILURE',
        details: {
          selected_product_id: selectedProductId,
          isLiveAvailable,
          hasAuthoritativePrice: Boolean(authPrice),
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: effective.merchant_policy.policy_version
        }
      });

      return {
        success: false,
        outcome: 'REVALIDATION_FAILED',
        decision_type: 'HARD_STOP',
        status: 'RECOVERY_EXHAUSTED',
        original_transaction_id: initialTxnId,
        original_product_id,
        selected_product_id: selectedProductId,
        semantic_decision: semanticDecision,
        policy_decision: policyResult,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        reasons: ['Selected substitute failed live inventory or authoritative price revalidation.']
      };
    }

    transactionStore.recordEvent('REVALIDATION_PASSED', {
      internal_transaction_id: initialTxnId,
      result: 'SUCCESS',
      details: {
        selected_product_id: selectedProductId,
        authoritative_price_inr: authPrice.price_inr,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version
      }
    });

    // 8. Place NEW Razorpay Order for Recovered Transaction
    const receipt = generateReceipt('rec');
    let razorpayOrder: RazorpayOrderResult;

    if (config.hasCredentials && process.env.NODE_ENV !== 'test' && !options?.forceMock) {
      try {
        razorpayOrder = await createRazorpayOrder({
          amount_paise: authPrice.price_paise,
          currency: authPrice.currency,
          receipt,
          notes: {
            recovery_for_transaction: initialTxnId,
            original_product_id,
            recovered_product_id: selectedProductId,
            merchant_policy_id: effective.merchant_policy.policy_id,
            merchant_policy_version: String(effective.merchant_policy.policy_version)
          }
        });
      } catch (err: any) {
        transactionStore.updateTransactionStatus(initialTxnId, 'RECOVERY_FAILED');
        return {
          success: false,
          outcome: 'NO_VALID_SUBSTITUTE',
          decision_type: 'HARD_STOP',
          status: 'RECOVERY_FAILED',
          original_transaction_id: initialTxnId,
          original_product_id,
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: effective.merchant_policy.policy_version,
          reasons: [`Razorpay Order creation failed: ${err.message}`]
        };
      }
    } else {
      // Fast deterministic mock order for testing and benchmark runs
      razorpayOrder = {
        id: `order_rec_mock_${Date.now()}`,
        entity: 'order',
        amount: authPrice.price_paise,
        amount_paid: 0,
        amount_due: authPrice.price_paise,
        currency: authPrice.currency,
        receipt,
        status: 'created',
        attempts: 0,
        notes: {
          recovery_for_transaction: initialTxnId,
          original_product_id,
          recovered_product_id: selectedProductId,
          merchant_policy_id: effective.merchant_policy.policy_id,
          merchant_policy_version: String(effective.merchant_policy.policy_version)
        },
        created_at: Math.floor(Date.now() / 1000)
      };
    }

    // 9. Create NEW Internal Transaction Record
    const recoveredTxn = transactionStore.createTransaction({
      amount_paise: authPrice.price_paise,
      currency: authPrice.currency,
      receipt,
      product_id: selectedProductId,
      razorpay_order_id: razorpayOrder.id,
      supersedes_transaction_id: initialTxnId
    });

    const recoveredTxnId = recoveredTxn.internal_transaction_id;

    // 10. Supersede Initial Transaction and Transition Recovered Transaction to NEW_ORDER_CREATED
    transactionStore.supersedeTransaction(initialTxnId, recoveredTxnId);

    transactionStore.updateTransactionStatus(recoveredTxnId, 'NEW_ORDER_CREATED', {
      razorpay_order_id: razorpayOrder.id,
      metadata: {
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version
      }
    });

    transactionStore.recordEvent('RECOVERY_SUCCEEDED', {
      internal_transaction_id: recoveredTxnId,
      result: 'SUCCESS',
      details: {
        original_transaction_id: initialTxnId,
        recovered_transaction_id: recoveredTxnId,
        new_razorpay_order_id: razorpayOrder.id,
        authoritative_price_inr: authPrice.price_inr,
        merchant_policy_id: effective.merchant_policy.policy_id,
        merchant_policy_version: effective.merchant_policy.policy_version,
        effective_constraints: {
          max_budget: effective.effective_max_budget,
          max_delta_percent: effective.effective_max_price_delta_percent,
          allowed_brands: effective.effective_allowed_brands,
          allowed_categories: effective.effective_allowed_categories,
          minimum_margin_percent: effective.effective_minimum_margin_percent
        }
      }
    });

    return {
      success: true,
      outcome: 'VALID_SUBSTITUTE',
      decision_type: 'AUTONOMOUS_RECOVERY',
      status: 'NEW_ORDER_CREATED',
      original_transaction_id: initialTxnId,
      recovered_transaction_id: recoveredTxnId,
      original_product_id,
      selected_product_id: selectedProductId,
      selected_product: CatalogService.getProduct(selectedProductId),
      authoritative_price_inr: authPrice.price_inr,
      authoritative_price_paise: authPrice.price_paise,
      razorpay_order: razorpayOrder,
      semantic_decision: semanticDecision,
      policy_decision: policyResult,
      merchant_policy_id: effective.merchant_policy.policy_id,
      merchant_policy_version: effective.merchant_policy.policy_version,
      effective_constraints: {
        max_budget: effective.effective_max_budget,
        max_delta_percent: effective.effective_max_price_delta_percent,
        allowed_brands: effective.effective_allowed_brands,
        allowed_categories: effective.effective_allowed_categories,
        minimum_margin_percent: effective.effective_minimum_margin_percent
      },
      reasons: ['Autonomous recovery completed with full deterministic policy authorization.']
    };
  }
}
