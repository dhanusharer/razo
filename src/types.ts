export type TransactionState =
  | 'ORDER_CREATED'
  | 'CHECKOUT_STARTED'
  | 'FAILURE_DETECTED'
  | 'RECOVERY_EVALUATING'
  | 'CANDIDATE_SELECTED'
  | 'POLICY_VALIDATED'
  | 'REVALIDATING'
  | 'RECOVERY_APPROVED'
  | 'NEW_ORDER_CREATED'
  | 'SUPERSEDED_UNPAID'
  | 'PAYMENT_CALLBACK_VERIFIED'
  | 'PAYMENT_CALLBACK_INVALID'
  | 'PAYMENT_CAPTURE_PENDING'
  | 'PAID'
  | 'POLICY_REJECTED'
  | 'REVALIDATION_FAILED'
  | 'RECOVERY_EXHAUSTED'
  | 'PAYMENT_FAILED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'WEBHOOK_DUPLICATE';

export type GateAEventType =
  | 'ORDER_CREATED'
  | 'CHECKOUT_STARTED'
  | 'FAILURE_DETECTED'
  | 'RECOVERY_EVALUATING'
  | 'CANDIDATE_SELECTED'
  | 'POLICY_VALIDATED'
  | 'POLICY_REJECTED'
  | 'REVALIDATING'
  | 'REVALIDATION_FAILED'
  | 'RECOVERY_APPROVED'
  | 'NEW_ORDER_CREATED'
  | 'ORDER_SUPERSEDED'
  | 'PAYMENT_CALLBACK_VERIFIED'
  | 'PAYMENT_CALLBACK_REJECTED'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_SIGNATURE_VERIFIED'
  | 'WEBHOOK_SIGNATURE_REJECTED'
  | 'PAYMENT_CAPTURED'
  | 'DUPLICATE_EVENT_IGNORED'
  | 'RECOVERY_FAILED';

export interface TransactionRecord {
  internal_transaction_id: string;
  amount_paise: number;
  currency: string;
  receipt: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  status: TransactionState;
  created_at: string;
  updated_at: string;
  product_id?: string;
  supersedes_transaction_id?: string;
  recovered_by_transaction_id?: string;
  metadata?: Record<string, unknown>;
}

export interface GateAEvent {
  event_id: string;
  timestamp: string;
  event_type: GateAEventType;
  internal_transaction_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  webhook_event_id?: string;
  result: 'SUCCESS' | 'FAILURE' | 'IGNORED';
  details?: Record<string, unknown>;
}

export interface CreateOrderRequest {
  amount_inr?: number;
  amount_paise?: number;
  currency?: string;
  product_id?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  internal_transaction_id: string;
  razorpay_order_id: string;
  amount_paise: number;
  currency: string;
  key_id: string;
  status: TransactionState;
  product_id?: string;
}

export interface VerifyCallbackRequest {
  internal_transaction_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface WebhookProcessingResult {
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED';
  statusCode: number;
  message: string;
  webhook_event_id?: string;
  event_type?: string;
  internal_transaction_id?: string;
}
