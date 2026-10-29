/**
 * Diagnowise core — Google Gemini provider adapter.
 *
 * Implements the Gemini `generateContent` REST API directly over fetch.
 * No default model, for the same reason as openai.ts.
 *
 * Gemini can answer HTTP 200 with no usable text — a safety block shows up
 * as `promptFeedback.blockReason` or a candidate with a non-STOP
 * finishReason. For clinical content that is a realistic outcome, so it is
 * surfaced as an explicit ProviderError naming the reason rather than a
 * generic "no text" failure.
 */

import type { CompletionRequest, CompletionResult, ModelProvider } from "../provider.js";
import { ProviderError } from "../provider.js";

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MAX_TOKENS = 2048;

export interface GoogleProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Injectable for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

export class GoogleProvider implements ModelProvider {
  readonly name = "google";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GoogleProviderConfig) {
    if (!config.apiKey) throw new Error("GoogleProvider requires an apiKey.");
    if (!config.model) throw new Error("GoogleProvider requires a model.");
    this.apiKey = config.apiKey;
    this.model = config.model.replace(/^models\//, "");
    this.baseUrl = (config.baseUrl ?? GOOGLE_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
          generationConfig: { maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS },
        }),
      });
    } catch (networkError) {
      throw new ProviderError("Network error calling Google API.", this.name, networkError);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new ProviderError(`Google API returned ${response.status}: ${body}`, this.name, undefined, response.status);
    }

    const json = (await response.json()) as GenerateContentResponse;

    if (json.promptFeedback?.blockReason) {
      throw new ProviderError(`Google blocked the prompt (${json.promptFeedback.blockReason}).`, this.name);
    }

    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new ProviderError(
        `Google API response contained no text content (finishReason: ${candidate?.finishReason ?? "none"}).`,
        this.name
      );
    }

    const { promptTokenCount, candidatesTokenCount } = json.usageMetadata ?? {};
    return {
      text,
      model: json.modelVersion ?? this.model,
      usage:
        promptTokenCount !== undefined && candidatesTokenCount !== undefined
          ? { inputTokens: promptTokenCount, outputTokens: candidatesTokenCount }
          : undefined,
    };
  }
}
