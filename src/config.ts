import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  port: number;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  llmProvider: string;
  geminiModel: string;
  recoveryTimeoutMs: number;
  hasCredentials: boolean;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  llmProvider: process.env.LLM_PROVIDER || 'gemini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  recoveryTimeoutMs: parseInt(process.env.RECOVERY_TIMEOUT_MS || '8000', 10),
  get hasCredentials(): boolean {
    return Boolean(
      this.razorpayKeyId &&
      this.razorpayKeySecret &&
      this.razorpayWebhookSecret &&
      !this.razorpayKeyId.includes('placeholder')
    );
  }
};
