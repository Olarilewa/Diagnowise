/**
 * Diagnowise core — Anthropic provider adapter.
 *
 * One of potentially several ModelProvider implementations (strategy doc
 * §12's "Provider A / Provider B / Provider C"). Implements the real
 * Anthropic Messages API (https://api.anthropic.com/v1/messages) directly
 * over fetch rather than depending on @anthropic-ai/sdk — one HTTP call,
 * one well-documented JSON shape; a full SDK dependency isn't earning its
 * weight for that (strategy doc §31: don't over-engineer the MVP).
 */

import type { CompletionRequest, CompletionResult, ModelProvider } from "../provider.js";
import { ProviderError } from "../provider.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 2048;

export interface AnthropicProviderConfig {
  apiKey: string;
  model?: string;
  /** Injectable for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface AnthropicMessagesResponse {
  content: { type: string; text?: string }[];
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AnthropicProviderConfig) {
    if (!config.apiKey) {
      throw new Error("AnthropicProvider requires an apiKey.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.userPrompt }],
        }),
      });
    } catch (networkError) {
      throw new ProviderError("Network error calling Anthropic API.", this.name, networkError);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new ProviderError(`Anthropic API returned ${response.status}: ${body}`, this.name);
    }

    const json = (await response.json()) as AnthropicMessagesResponse;
    const textBlock = json.content.find((block) => block.type === "text");
    if (!textBlock?.text) {
      throw new ProviderError("Anthropic API response contained no text content.", this.name);
    }

    return {
      text: textBlock.text,
      model: json.model,
      usage: json.usage ? { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens } : undefined,
    };
  }
}
