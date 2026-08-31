import { TransactionRecord, TransactionState, GateAEvent, GateAEventType } from '../types.js';

export class InMemoryTransactionStore {
  private transactions: Map<string, TransactionRecord> = new Map();
  private orderIdToTxnId: Map<string, string> = new Map();
  private processedWebhookEvents: Set<string> = new Set();
  private processedPaymentIds: Set<string> = new Set();
  private events: GateAEvent[] = [];
  private eventCounter = 0;

  public createTransaction(params: {
    amount_paise: number;
    currency: string;
    receipt: string;
    razorpay_order_id?: string;
    product_id?: string;
    supersedes_transaction_id?: string;
    metadata?: Record<string, unknown>;
  }): TransactionRecord {
    const internal_transaction_id = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const record: TransactionRecord = {
      internal_transaction_id,
      amount_paise: params.amount_paise,
      currency: params.currency,
      receipt: params.receipt,
      razorpay_order_id: params.razorpay_order_id,
      product_id: params.product_id,
      supersedes_transaction_id: params.supersedes_transaction_id,
      status: 'ORDER_CREATED',
      created_at: now,
      updated_at: now,
      metadata: params.metadata || {}
    };

    this.transactions.set(internal_transaction_id, record);
    if (params.razorpay_order_id) {
      this.orderIdToTxnId.set(params.razorpay_order_id, internal_transaction_id);
    }

    this.recordEvent('ORDER_CREATED', {
      internal_transaction_id,
      razorpay_order_id: params.razorpay_order_id,
      result: 'SUCCESS',
      details: {
        amount_paise: params.amount_paise,
        currency: params.currency,
        receipt: params.receipt,
        product_id: params.product_id,
        supersedes_transaction_id: params.supersedes_transaction_id
      }
    });

    return record;
  }

  public getTransaction(id: string): TransactionRecord | undefined {
    return this.transactions.get(id);
  }

  public getAllTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values());
  }

  public getAllEvents(): GateAEvent[] {
    return [...this.events];
  }

  public getTransactionByOrderId(orderId: string): TransactionRecord | undefined {
    const txnId = this.orderIdToTxnId.get(orderId);
    if (txnId) {
      return this.transactions.get(txnId);
    }
    return undefined;
  }

  public linkOrderId(internal_transaction_id: string, orderId: string): void {
    const txn = this.transactions.get(internal_transaction_id);
    if (txn) {
      txn.razorpay_order_id = orderId;
      txn.updated_at = new Date().toISOString();
      this.orderIdToTxnId.set(orderId, internal_transaction_id);
    }
  }

  public supersedeTransaction(originalTxnId: string, newTxnId: string): void {
    const original = this.transactions.get(originalTxnId);
    if (original) {
      original.status = 'SUPERSEDED_UNPAID';
      original.recovered_by_transaction_id = newTxnId;
      original.updated_at = new Date().toISOString();

      this.recordEvent('ORDER_SUPERSEDED', {
        internal_transaction_id: originalTxnId,
        razorpay_order_id: original.razorpay_order_id,
        result: 'SUCCESS',
        details: {
          reason: 'Original attempt failed (e.g. OUT_OF_STOCK) and was superseded by resilient recovery transaction',
          recovered_by_transaction_id: newTxnId
        }
      });
    }
  }

  public updateTransactionStatus(
    id: string,
    status: TransactionState,
    extra?: {
      razorpay_payment_id?: string;
      product_id?: string;
      metadata?: Record<string, unknown>;
    }
  ): TransactionRecord | undefined {
    const txn = this.transactions.get(id);
    if (!txn) return undefined;

    // Terminal state protection: once PAID, do not allow non-PAID provisional states to overwrite
    if (txn.status === 'PAID' && status !== 'PAID') {
      if (extra?.razorpay_payment_id) {
        txn.razorpay_payment_id = extra.razorpay_payment_id;
      }
      if (extra?.product_id) {
        txn.product_id = extra.product_id;
      }
      if (extra?.metadata) {
        txn.metadata = { ...txn.metadata, ...extra.metadata };
      }
      return txn;
    }

    txn.status = status;
    txn.updated_at = new Date().toISOString();
    if (extra?.razorpay_payment_id) {
      txn.razorpay_payment_id = extra.razorpay_payment_id;
    }
    if (extra?.product_id) {
      txn.product_id = extra.product_id;
    }
    if (extra?.metadata) {
      txn.metadata = { ...txn.metadata, ...extra.metadata };
    }
    return txn;
  }

  public isWebhookEventProcessed(eventId: string): boolean {
    return this.processedWebhookEvents.has(eventId);
  }

  public markWebhookEventProcessed(eventId: string): void {
    this.processedWebhookEvents.add(eventId);
  }

  public isPaymentProcessed(paymentId: string): boolean {
    return this.processedPaymentIds.has(paymentId);
  }

  public markPaymentProcessed(paymentId: string): void {
    this.processedPaymentIds.add(paymentId);
  }

  public recordEvent(
    eventType: GateAEventType,
    data: {
      internal_transaction_id?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      webhook_event_id?: string;
      result: 'SUCCESS' | 'FAILURE' | 'IGNORED';
      details?: Record<string, unknown>;
    }
  ): GateAEvent {
    this.eventCounter += 1;
    const event: GateAEvent = {
      event_id: `evt_gate_a_${this.eventCounter.toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      event_type: eventType,
      internal_transaction_id: data.internal_transaction_id,
      razorpay_order_id: data.razorpay_order_id,
      razorpay_payment_id: data.razorpay_payment_id,
      webhook_event_id: data.webhook_event_id,
      result: data.result,
      details: data.details
    };
    this.events.push(event);
    return event;
  }

  public getEvents(internal_transaction_id?: string): GateAEvent[] {
    if (internal_transaction_id) {
      return this.events.filter((e) => e.internal_transaction_id === internal_transaction_id);
    }
    return [...this.events];
  }

  public reset(): void {
    this.transactions.clear();
    this.orderIdToTxnId.clear();
    this.processedWebhookEvents.clear();
    this.processedPaymentIds.clear();
    this.events = [];
    this.eventCounter = 0;
  }
}

export const transactionStore = new InMemoryTransactionStore();
