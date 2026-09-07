/**
 * Diagnowise core — Model Provider Interface.
 *
 * Strategy doc §12: "Diagnowise must NOT become: Next.js + one LLM API +
 * prompts." Every stage in core/stages/ talks to a ModelProvider, never to
 * a specific vendor's SDK. Swapping providers (commercial, open-source,
 * self-hosted, specialized medical) means writing one new file in
 * core/src/providers/ — nothing in core/src/stages/ or orchestrator.ts changes.
 */

export interface CompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export class ProviderError extends Error {
  constructor(message: string, public readonly provider: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ModelProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
