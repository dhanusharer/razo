import { LLMEvaluationInput, LLMEvaluationResult } from '../../commerce/types.js';
import { LLMProvider } from './types.js';
import { buildEvaluationPrompt, SYSTEM_PROMPT } from '../prompts.js';
import { config } from '../../config.js';

export class GeminiLLMProvider implements LLMProvider {
  public readonly name = 'Google Gemini Flash (Live)';
  public readonly isMock = false;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(
    apiKey: string,
    model: string = config.geminiModel || 'gemini-2.5-flash',
    timeoutMs: number = config.recoveryTimeoutMs || 8000
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  public async evaluate(input: LLMEvaluationInput): Promise<LLMEvaluationResult> {
    const prompt = buildEvaluationPrompt(input);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 1000,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
        throw new Error(`RECOVERY_TIMEOUT: Live LLM evaluation timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API call failed (HTTP ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Gemini API returned empty response');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Extract the first matching { ... } JSON block if LLM included conversational text or markdown
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }
    }

    if (!parsed.selected_product_id) {
      throw new Error('Gemini output missing selected_product_id');
    }

    return {
      selected_product_id: String(parsed.selected_product_id),
      reason: `[LIVE GEMINI LLM] ${parsed.reason || 'Selected based on semantic trade-offs.'}`,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85
    };
  }
}
