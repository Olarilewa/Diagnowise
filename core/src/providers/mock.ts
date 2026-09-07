/**
 * Diagnowise core — mock provider.
 *
 * Deterministic, no network. Used by core/'s own test suite, and available
 * to web/ for local development without needing a real API key wired up.
 * Takes a map of canned responses keyed by a substring match against the
 * user prompt, so tests can target specific stages precisely.
 */

import type { CompletionRequest, CompletionResult, ModelProvider } from "../provider.js";

export class MockProvider implements ModelProvider {
  readonly name = "mock";
  private callLog: CompletionRequest[] = [];

  constructor(private responses: { match: string; response: string }[]) {}

  get calls(): ReadonlyArray<CompletionRequest> {
    return this.callLog;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.callLog.push(request);
    const match = this.responses.find((r) => request.userPrompt.includes(r.match));
    if (!match) {
      throw new Error(`MockProvider: no canned response configured matching prompt content: ${request.userPrompt.slice(0, 120)}...`);
    }
    return { text: match.response, model: "mock-model" };
  }
}
