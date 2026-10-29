/**
 * Diagnowise core — failover provider.
 *
 * A decorator that is itself a ModelProvider, so the orchestrator needs no
 * awareness of it: it tries providers in order and moves on only when the
 * failure looks like availability (network error, 408, 429, 5xx, or a
 * malformed-but-200 response). A 400/401/403/404 is NOT retried elsewhere —
 * that means our request or credentials are wrong, every provider would
 * fail the same way, and quietly hopping to a different vendor would hide a
 * misconfiguration instead of surfacing it.
 *
 * Failing over changes which model produced the answer. That is not
 * hidden: the orchestrator logs `result.model` for every stage, so the
 * audit trail records the model that actually answered, and `onFailover`
 * lets the host app emit a warning when it happens.
 */

import type { CompletionRequest, CompletionResult, ModelProvider } from "../provider.js";
import { ProviderError } from "../provider.js";

export interface FailoverEvent {
  failedProvider: string;
  nextProvider: string;
  error: unknown;
}

export interface FailoverOptions {
  onFailover?: (event: FailoverEvent) => void;
}

export function isFailoverEligible(error: unknown): boolean {
  if (!(error instanceof ProviderError)) return false;
  const { status } = error;
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

export class FailoverProvider implements ModelProvider {
  readonly name: string;

  constructor(private readonly providers: readonly ModelProvider[], private readonly options: FailoverOptions = {}) {
    if (providers.length < 2) {
      throw new Error("FailoverProvider needs at least two providers; use the provider directly otherwise.");
    }
    this.name = `failover(${providers.map((p) => p.name).join(">")})`;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const failures: { provider: string; error: unknown }[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i]!;
      try {
        return await provider.complete(request);
      } catch (error) {
        if (!isFailoverEligible(error)) throw error;
        failures.push({ provider: provider.name, error });
        const next = this.providers[i + 1];
        if (next) this.options.onFailover?.({ failedProvider: provider.name, nextProvider: next.name, error });
      }
    }

    const summary = failures
      .map((f) => `${f.provider}: ${f.error instanceof Error ? f.error.message : String(f.error)}`)
      .join(" | ");
    throw new ProviderError(`All providers failed. ${summary}`, this.name, failures);
  }
}
