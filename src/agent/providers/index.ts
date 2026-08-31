import { LLMProvider } from './types.js';
import { MockLLMProvider } from './mockProvider.js';
import { GeminiLLMProvider } from './geminiProvider.js';

export * from './types.js';
export * from './mockProvider.js';
export * from './geminiProvider.js';

export function getLLMProvider(options?: { forceMock?: boolean; apiKey?: string }): LLMProvider {
  if (options?.forceMock || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return new MockLLMProvider();
  }
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey && !apiKey.includes('placeholder') && apiKey.trim().length > 10) {
    return new GeminiLLMProvider(apiKey.trim());
  }
  return new MockLLMProvider();
}
