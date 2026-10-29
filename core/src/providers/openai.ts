/**
 * Diagnowise core — OpenAI-compatible provider adapter.
 *
 * Speaks the Chat Completions wire format directly over fetch (no SDK),
 * same approach as anthropic.ts. That format is also what most local and
 * self-hosted model servers expose (Ollama, vLLM, llama.cpp server, LM
 * Studio...), so this one adapter covers both OpenAI itself and the
 * "local / open-weight" requirement from the v2 plan: point `baseUrl` at
 * the local server and omit the API key.
 *
 * There is deliberately NO default model. Model names go stale; guessing
 * one here would silently ship a deprecated name. The caller must say.
 */

import type { CompletionRequest, CompletionResult, ModelProvider } from "../provider.js";
import { ProviderError } from "../provider.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MAX_TOKENS = 2048;

export interface OpenAIProviderConfig {
  model: string;
  /** Required for api.openai.com; optional for a local server via baseUrl. */
  apiKey?: string;
  /** Override to target an OpenAI-compatible server, e.g. http://localhost:11434/v1 */
  baseUrl?: string;
  /** Name reported in errors and logs. Defaults to "openai", or "local" when baseUrl is set. */
  name?: string;
  /**
   * OpenAI's current models want `max_completion_tokens`; many local
   * servers only honour `max_tokens`. Defaults accordingly: the former for
   * api.openai.com, the latter for a custom baseUrl.
   */
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  /** Injectable for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIProvider implements ModelProvider {
  readonly name: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly maxTokensParam: "max_tokens" | "max_completion_tokens";
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAIProviderConfig) {
    if (!config.model) throw new Error("OpenAIProvider requires a model.");
    if (!config.apiKey && !config.baseUrl) {
      throw new Error("OpenAIProvider requires an apiKey (or a baseUrl for a local server).");
    }
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? OPENAI_BASE_URL).replace(/\/+$/, "");
    this.name = config.name ?? (config.baseUrl ? "local" : "openai");
    this.maxTokensParam = config.maxTokensParam ?? (config.baseUrl ? "max_tokens" : "max_completion_tokens");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers["authorization"] = `Bearer ${this.apiKey}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          [this.maxTokensParam]: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      });
    } catch (networkError) {
      throw new ProviderError(`Network error calling ${this.name} API.`, this.name, networkError);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "<unreadable body>");
      throw new ProviderError(`${this.name} API returned ${response.status}: ${body}`, this.name, undefined, response.status);
    }

    const json = (await response.json()) as ChatCompletionResponse;
    const message = json.choices?.[0]?.message;
    if (message?.refusal) {
      throw new ProviderError(`${this.name} model refused the request: ${message.refusal}`, this.name);
    }
    if (!message?.content) {
      throw new ProviderError(`${this.name} API response contained no text content.`, this.name);
    }

    const { prompt_tokens, completion_tokens } = json.usage ?? {};
    return {
      text: message.content,
      model: json.model ?? this.model,
      usage:
        prompt_tokens !== undefined && completion_tokens !== undefined
          ? { inputTokens: prompt_tokens, outputTokens: completion_tokens }
          : undefined,
    };
  }
}
