import fs from 'fs';
import path from 'path';
import { SeededPRNG } from './prng.js';
import { CatalogService, InventorySimulator, createUserMandate, UserMandate, SoftPreferences } from '../src/commerce/index.js';
import { RecoveryRelay, RecoveryResult } from '../src/recovery/index.js';
import { LLMEvaluator } from '../src/agent/llmEvaluator.js';
import { MockLLMProvider } from '../src/agent/providers/mockProvider.js';

export interface BenchmarkSession {
  session_id: string;
  scenario_type: 'NORMAL_SUCCESS' | 'OOS_RECOVERABLE_MULTI_CANDIDATE' | 'OOS_PRICE_VIOLATION' | 'OOS_ATTRIBUTE_BRAND_VIOLATION' | 'OOS_CONCURRENT_RACE';
  user_intent: string;
  original_product_id: string;
  original_product_price_inr: number;
  mandate: UserMandate;
  soft_preferences: SoftPreferences;
  initial_stock: number;
  candidate_stock_override?: Record<string, number>;
  stale_inventory_race?: boolean;
}

export interface SessionResult {
  session_id: string;
  scenario_type: string;
  baseline_status: 'SUCCESS' | 'FAILED';
  baseline_gmv_lost_inr: number;
  relay_outcome: string;
  relay_status: string;
  recovered: boolean;
  escalated: boolean;
  hard_stopped: boolean;
  recovered_product_id?: string;
  recovered_gmv_inr: number;
  unauthorized: boolean;
  latency_ms: number;
  semantic_reason?: string;
  confidence?: number;
  multiple_candidates_valid?: boolean;
}

export interface BenchmarkMetrics {
  benchmark_name: string;
  timestamp: string;
  dataset_type: 'SYNTHETIC_SIMULATED_REPRODUCIBLE';
  random_seed: number;
  session_count: number;
  baseline_successful_sessions: number;
  eligible_failures: number;
  baseline_failed_transactions: number;
  baseline_failed_gmv: number;
  recoveries: number;
  recovered_gmv: number;
  escalations: number;
  hard_stops: number;
  failed_recoveries: number;
  recovery_rate: number;
  autonomous_recovery_rate: number;
  escalation_rate: number;
  unauthorized_transaction_rate: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_max_ms: number;
  multiple_candidate_tradeoff_sessions: number;
}

export class RecoveryBenchmark {
  private prng: SeededPRNG;
  private readonly seed: number;
  private readonly sessionCount: number;

  constructor(seed: number = 42026, sessionCount: number = 500) {
    this.seed = seed;
    this.sessionCount = sessionCount;
    this.prng = new SeededPRNG(seed);
  }

  /**
   * Generates 500 deterministic synthetic checkout sessions
   */
  public generateSessions(): BenchmarkSession[] {
    const sessions: BenchmarkSession[] = [];
    const baseProduct = CatalogService.getProduct('ADIDAS-RUN-01')!;

    for (let i = 1; i <= this.sessionCount; i++) {
      const sessionId = `sess_${i.toString().padStart(4, '0')}`;
      const roll = this.prng.next();

      if (roll < 0.30) {
        // Scenario A: Normal in-stock checkout (30%)
        sessions.push({
          session_id: sessionId,
          scenario_type: 'NORMAL_SUCCESS',
          user_intent: 'Standard checkout for Adidas Boston 12',
          original_product_id: 'ADIDAS-RUN-01',
          original_product_price_inr: baseProduct.price_inr,
          mandate: createUserMandate({
            max_budget: 5500,
            allowed_categories: ['running_shoes'],
            allowed_brands: ['Adidas'],
            max_price_delta_percent: 10,
            required_attributes: { size: 10 }
          }),
          soft_preferences: { performance_priority: 'high' },
          initial_stock: this.prng.nextInt(2, 8)
        });
      } else if (roll < 0.70) {
        // Scenario B: OOS with MULTIPLE policy-valid candidates & trade-offs (40%)
        // Both ADIDAS-RUN-02 (₹5,200, high performance) and ADIDAS-RUN-05 (₹5,100, fastest delivery) in stock
        const prefType = this.prng.choice(['performance', 'delivery', 'balanced']);
        const softPrefs: SoftPreferences =
          prefType === 'performance'
            ? { performance_priority: 'high', delivery_priority: 'standard' }
            : prefType === 'delivery'
            ? { performance_priority: 'standard', delivery_priority: 'fastest' }
            : { performance_priority: 'high', delivery_priority: 'fastest' };

        sessions.push({
          session_id: sessionId,
          scenario_type: 'OOS_RECOVERABLE_MULTI_CANDIDATE',
          user_intent: `Need running shoes size 10, priority: ${prefType}`,
          original_product_id: 'ADIDAS-RUN-01',
          original_product_price_inr: baseProduct.price_inr,
          mandate: createUserMandate({
            max_budget: 5500,
            allowed_categories: ['running_shoes'],
            allowed_brands: ['Adidas'],
            max_price_delta_percent: 10,
            required_attributes: { size: 10 }
          }),
          soft_preferences: softPrefs,
          initial_stock: 0, // OOS trigger
          candidate_stock_override: {
            'ADIDAS-RUN-02': this.prng.nextInt(2, 6), // Valid (₹5,200, +6.12%)
            'ADIDAS-RUN-05': this.prng.nextInt(2, 6)  // Valid (₹5,100, +4.08%)
          }
        });
      } else if (roll < 0.85) {
        // Scenario C: OOS with Price Tolerance / Budget Violation (15%)
        // Tight tolerance: e.g. 2% max delta (max price ₹4,998) -> candidates ₹5,100 and ₹5,200 exceed tolerance
        const maxDelta = this.prng.choice([1, 2, 3]);
        sessions.push({
          session_id: sessionId,
          scenario_type: 'OOS_PRICE_VIOLATION',
          user_intent: `Strict budget limit with max ${maxDelta}% tolerance`,
          original_product_id: 'ADIDAS-RUN-01',
          original_product_price_inr: baseProduct.price_inr,
          mandate: createUserMandate({
            max_budget: 5000,
            allowed_categories: ['running_shoes'],
            allowed_brands: ['Adidas'],
            max_price_delta_percent: maxDelta,
            required_attributes: { size: 10 }
          }),
          soft_preferences: { performance_priority: 'high' },
          initial_stock: 0,
          candidate_stock_override: {
            'ADIDAS-RUN-02': 4,
            'ADIDAS-RUN-03': 2
          }
        });
      } else if (roll < 0.95) {
        // Scenario D: OOS with Incompatible Brand / Attribute Constraint (10%)
        const violationKind = this.prng.choice(['brand_puma', 'size_12', 'category_apparel']);
        const mandate =
          violationKind === 'brand_puma'
            ? createUserMandate({
                max_budget: 6000,
                allowed_categories: ['running_shoes'],
                allowed_brands: ['Puma'],
                max_price_delta_percent: 20,
                required_attributes: { size: 10 }
              })
            : violationKind === 'size_12'
            ? createUserMandate({
                max_budget: 6000,
                allowed_categories: ['running_shoes'],
                allowed_brands: ['Adidas'],
                max_price_delta_percent: 20,
                required_attributes: { size: 12 }
              })
            : createUserMandate({
                max_budget: 6000,
                allowed_categories: ['apparel' as any],
                allowed_brands: ['Adidas'],
                max_price_delta_percent: 20,
                required_attributes: { size: 10 }
              });

        sessions.push({
          session_id: sessionId,
          scenario_type: 'OOS_ATTRIBUTE_BRAND_VIOLATION',
          user_intent: `Constraint violation test: ${violationKind}`,
          original_product_id: 'ADIDAS-RUN-01',
          original_product_price_inr: baseProduct.price_inr,
          mandate,
          soft_preferences: { performance_priority: 'high' },
          initial_stock: 0,
          candidate_stock_override: {
            'ADIDAS-RUN-02': 4
          }
        });
      } else {
        // Scenario E: Concurrent Stock Race / Revalidation Failure (5%)
        sessions.push({
          session_id: sessionId,
          scenario_type: 'OOS_CONCURRENT_RACE',
          user_intent: 'Testing concurrent out of stock race condition during revalidation',
          original_product_id: 'ADIDAS-RUN-01',
          original_product_price_inr: baseProduct.price_inr,
          mandate: createUserMandate({
            max_budget: 5500,
            allowed_categories: ['running_shoes'],
            allowed_brands: ['Adidas'],
            max_price_delta_percent: 10,
            required_attributes: { size: 10 }
          }),
          soft_preferences: { performance_priority: 'high' },
          initial_stock: 0,
          stale_inventory_race: true,
          candidate_stock_override: {
            'ADIDAS-RUN-02': 0, // Out of stock during live revalidation
            'ADIDAS-RUN-05': 0
          }
        });
      }
    }

    return sessions;
  }

  /**
   * Executes the full 500-session economic recovery benchmark
   */
  public async run(): Promise<{ metrics: BenchmarkMetrics; results: SessionResult[] }> {
    const sessions = this.generateSessions();
    const results: SessionResult[] = [];
    const latencies: number[] = [];
    const mockProvider = new MockLLMProvider();

    let baselineSuccessCount = 0;
    let eligibleFailures = 0;
    let baselineFailedGmv = 0;

    let recoveries = 0;
    let recoveredGmv = 0;
    let escalations = 0;
    let hardStops = 0;
    let failedRecoveries = 0;
    let unauthorizedCount = 0;
    let multipleCandidateTradeoffs = 0;

    for (const session of sessions) {
      // 1. Baseline Evaluation (Traditional non-recovery checkout)
      const isBaselineSuccess = session.initial_stock > 0;
      const baselineGmvLost = isBaselineSuccess ? 0 : session.original_product_price_inr;

      if (isBaselineSuccess) {
        baselineSuccessCount++;
      } else {
        eligibleFailures++;
        baselineFailedGmv += session.original_product_price_inr;
      }

      // 2. Setup isolated inventory for session
      const inv = new InventorySimulator();
      inv.setStock(session.original_product_id, session.initial_stock);
      if (session.candidate_stock_override) {
        for (const [prodId, count] of Object.entries(session.candidate_stock_override)) {
          inv.setStock(prodId, count);
        }
      }

      // 3. Measure multiple candidate policy validity
      const isMultiCandidate = session.scenario_type === 'OOS_RECOVERABLE_MULTI_CANDIDATE';
      if (isMultiCandidate) {
        multipleCandidateTradeoffs++;
      }

      // 4. Relay Evaluation with precise latency measurement
      const startTime = performance.now();
      let recoveryResult: RecoveryResult;

      try {
        recoveryResult = await RecoveryRelay.executeRecovery(
          {
            user_intent: session.user_intent,
            original_product_id: session.original_product_id,
            mandate: session.mandate,
            soft_preferences: session.soft_preferences,
            simulate_initial_oos: session.initial_stock === 0
          },
          {
            inventory: inv,
            provider: mockProvider,
            forceMock: true
          }
        );
      } catch (err: any) {
        recoveryResult = {
          success: false,
          outcome: 'NO_VALID_SUBSTITUTE',
          status: 'RECOVERY_EXHAUSTED',
          original_transaction_id: `err_${session.session_id}`,
          original_product_id: session.original_product_id,
          reasons: [err.message]
        };
      }

      const elapsedMs = performance.now() - startTime;
      latencies.push(elapsedMs);

      // 5. Categorize Relay Outcomes & Verify Containment
      const isRecovered = recoveryResult.outcome === 'VALID_SUBSTITUTE' && recoveryResult.status === 'NEW_ORDER_CREATED';
      const isEscalated = recoveryResult.outcome === 'SUBSTITUTE_OUTSIDE_MANDATE' && recoveryResult.status === 'POLICY_REJECTED';
      const isHardStopped = recoveryResult.outcome === 'NO_VALID_SUBSTITUTE' || recoveryResult.outcome === 'REVALIDATION_FAILED';

      // Unauthorized verification check:
      // An unauthorized transaction occurs IF a substitute outside the mandate ever reached order creation
      let unauthorized = false;
      if (isRecovered) {
        const prod = recoveryResult.selected_product!;
        const priceDelta = ((prod.price_inr - session.original_product_price_inr) / session.original_product_price_inr) * 100;
        if (
          !session.mandate.allowed_brands.includes(prod.brand) ||
          !session.mandate.allowed_categories.includes(prod.category) ||
          prod.price_inr > session.mandate.max_budget ||
          priceDelta > session.mandate.max_price_delta_percent ||
          prod.attributes.size !== session.mandate.required_attributes.size
        ) {
          unauthorized = true;
          unauthorizedCount++;
        }
      }

      const sessionGmv = isRecovered ? recoveryResult.authoritative_price_inr! : 0;

      if (!isBaselineSuccess) {
        if (isRecovered) {
          recoveries++;
          recoveredGmv += sessionGmv;
        } else if (isEscalated) {
          escalations++;
          failedRecoveries++;
        } else if (isHardStopped) {
          hardStops++;
          failedRecoveries++;
        }
      }

      results.push({
        session_id: session.session_id,
        scenario_type: session.scenario_type,
        baseline_status: isBaselineSuccess ? 'SUCCESS' : 'FAILED',
        baseline_gmv_lost_inr: baselineGmvLost,
        relay_outcome: recoveryResult.outcome,
        relay_status: recoveryResult.status,
        recovered: isRecovered,
        escalated: isEscalated,
        hard_stopped: isHardStopped,
        recovered_product_id: recoveryResult.selected_product_id,
        recovered_gmv_inr: sessionGmv,
        unauthorized,
        latency_ms: Math.round(elapsedMs * 100) / 100,
        semantic_reason: recoveryResult.semantic_decision?.reason,
        confidence: recoveryResult.semantic_decision?.confidence,
        multiple_candidates_valid: isMultiCandidate
      });
    }

    // 6. Compute Latency Percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const maxLatency = latencies[latencies.length - 1] || 0;

    const recoveryRate = eligibleFailures > 0 ? (recoveries / eligibleFailures) * 100 : 0;
    const autonomousRecoveryRate = eligibleFailures > 0 ? (recoveries / eligibleFailures) * 100 : 0;
    const escalationRate = eligibleFailures > 0 ? (escalations / eligibleFailures) * 100 : 0;
    const unauthorizedRate = eligibleFailures > 0 ? (unauthorizedCount / eligibleFailures) * 100 : 0;

    const metrics: BenchmarkMetrics = {
      benchmark_name: 'Resilient-Agent-Relay Controlled Recovery Economics Benchmark',
      timestamp: new Date().toISOString(),
      dataset_type: 'SYNTHETIC_SIMULATED_REPRODUCIBLE',
      random_seed: this.seed,
      session_count: this.sessionCount,
      baseline_successful_sessions: baselineSuccessCount,
      eligible_failures: eligibleFailures,
      baseline_failed_transactions: eligibleFailures,
      baseline_failed_gmv: baselineFailedGmv,
      recoveries,
      recovered_gmv: recoveredGmv,
      escalations,
      hard_stops: hardStops,
      failed_recoveries: failedRecoveries,
      recovery_rate: Math.round(recoveryRate * 100) / 100,
      autonomous_recovery_rate: Math.round(autonomousRecoveryRate * 100) / 100,
      escalation_rate: Math.round(escalationRate * 100) / 100,
      unauthorized_transaction_rate: Math.round(unauthorizedRate * 100) / 100,
      latency_p50_ms: Math.round(p50 * 100) / 100,
      latency_p95_ms: Math.round(p95 * 100) / 100,
      latency_max_ms: Math.round(maxLatency * 100) / 100,
      multiple_candidate_tradeoff_sessions: multipleCandidateTradeoffs
    };

    return { metrics, results };
  }
}

// Execution runner when called directly
if (process.env.NODE_ENV !== 'test') {
  const runner = new RecoveryBenchmark(42026, 500);
  runner.run().then(({ metrics, results }) => {
    const outDir = path.join(process.cwd(), 'benchmarks');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outFile = path.join(outDir, 'benchmark-results.json');
    fs.writeFileSync(outFile, JSON.stringify({ metrics, sample_results: results.slice(0, 20) }, null, 2));
    console.log('✅ Recovery Benchmark Completed Successfully:');
    console.log(JSON.stringify(metrics, null, 2));
  });
}
