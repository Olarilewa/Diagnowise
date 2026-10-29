/**
 * Diagnowise core — provider registry.
 *
 * Turns environment configuration into the `StageProviderMap` the
 * ReasoningOrchestrator already accepts. The orchestrator, the stages and
 * the audit logger are untouched by this file: v1 already had the
 * abstraction point, it just only ever fed it Anthropic.
 *
 * Configuration (every value is a comma-separated chain; more than one
 * entry means "try in order", via FailoverProvider):
 *
 *   AI_PROVIDER_DEFAULT              default: "anthropic"   (v1 behaviour)
 *   AI_PROVIDER_<STAGE>              optional per-stage override, e.g.
 *                                    AI_PROVIDER_SAFETY_VERIFICATION=openai
 *
 * Provider kinds and the variables each reads:
 *
 *   anthropic   ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional)
 *   openai      OPENAI_API_KEY, OPENAI_MODEL           (both required)
 *   google      GOOGLE_API_KEY, GOOGLE_MODEL           (both required)
 *   local       AI_LOCAL_BASE_URL, AI_LOCAL_MODEL (required),
 *               AI_LOCAL_API_KEY (optional) — any OpenAI-compatible server
 *
 * Misconfiguration throws immediately, naming the missing variable — at
 * startup, not on the first patient case.
 */

import type { ModelProvider } from "./provider.js";
import type { PipelineStage } from "./types.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GoogleProvider } from "./providers/google.js";
import { FailoverProvider, type FailoverOptions } from "./providers/failover.js";

export type ProviderKind = "anthropic" | "openai" | "google" | "local";
const PROVIDER_KINDS: readonly ProviderKind[] = ["anthropic", "openai", "google", "local"];

/** Structurally identical to StageProviderMap in orchestrator.ts. */
export interface ProviderMap {
  default: ModelProvider;
  overrides?: Partial<Record<PipelineStage, ModelProvider>>;
}

export interface ResolveOptions {
  fetchImpl?: typeof fetch;
  onFailover?: FailoverOptions["onFailover"];
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

const ALL_STAGES = [
  "extraction_normalization",
  "red_flag_detection",
  "differential_generation",
  "contradiction_detection",
  "missing_information_analysis",
  "investigation_considerations",
  "follow_up_reasoning",
  "safety_verification",
  "patient_explanation",
] as const satisfies readonly PipelineStage[];

// Compile-time guard: adding a stage to PipelineStage without listing it
// above makes this line fail typecheck, so a new stage can never silently
// lack an override variable.
type _AllStagesListed = Exclude<PipelineStage, (typeof ALL_STAGES)[number]> extends never ? true : never;
const _allStagesListed: _AllStagesListed = true;
void _allStagesListed;

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined; // empty string (common on hosts) counts as unset
}

function require_(env: Env, name: string, why: string): string {
  const value = read(env, name);
  if (!value) throw new ProviderConfigError(`${name} is required ${why}.`);
  return value;
}

function parseChain(raw: string, source: string): ProviderKind[] {
  const kinds = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (kinds.length === 0) throw new ProviderConfigError(`${source} is empty.`);
  for (const kind of kinds) {
    if (!(PROVIDER_KINDS as readonly string[]).includes(kind)) {
      throw new ProviderConfigError(`${source} names unknown provider "${kind}". Valid: ${PROVIDER_KINDS.join(", ")}.`);
    }
  }
  if (new Set(kinds).size !== kinds.length) {
    throw new ProviderConfigError(`${source} lists the same provider more than once.`);
  }
  return kinds as ProviderKind[];
}

function buildKind(kind: ProviderKind, env: Env, fetchImpl?: typeof fetch): ModelProvider {
  switch (kind) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: require_(env, "ANTHROPIC_API_KEY", "when the anthropic provider is selected"),
        model: read(env, "ANTHROPIC_MODEL"),
        fetchImpl,
      });
    case "openai":
      return new OpenAIProvider({
        apiKey: require_(env, "OPENAI_API_KEY", "when the openai provider is selected"),
        model: require_(env, "OPENAI_MODEL", "when the openai provider is selected (there is no default model)"),
        fetchImpl,
      });
    case "google":
      return new GoogleProvider({
        apiKey: require_(env, "GOOGLE_API_KEY", "when the google provider is selected"),
        model: require_(env, "GOOGLE_MODEL", "when the google provider is selected (there is no default model)"),
        fetchImpl,
      });
    case "local":
      return new OpenAIProvider({
        baseUrl: require_(env, "AI_LOCAL_BASE_URL", "when the local provider is selected"),
        model: require_(env, "AI_LOCAL_MODEL", "when the local provider is selected"),
        apiKey: read(env, "AI_LOCAL_API_KEY"),
        name: "local",
        fetchImpl,
      });
  }
}

export function resolveProviderMap(env: Env, options: ResolveOptions = {}): ProviderMap {
  const cache = new Map<ProviderKind, ModelProvider>();
  const get = (kind: ProviderKind): ModelProvider => {
    let provider = cache.get(kind);
    if (!provider) {
      provider = buildKind(kind, env, options.fetchImpl);
      cache.set(kind, provider);
    }
    return provider;
  };
  const fromChain = (kinds: ProviderKind[]): ModelProvider => {
    const providers = kinds.map(get);
    return providers.length === 1
      ? providers[0]!
      : new FailoverProvider(providers, { onFailover: options.onFailover });
  };

  const defaultRaw = read(env, "AI_PROVIDER_DEFAULT") ?? "anthropic";
  const map: ProviderMap = { default: fromChain(parseChain(defaultRaw, "AI_PROVIDER_DEFAULT")) };

  const overrides: Partial<Record<PipelineStage, ModelProvider>> = {};
  for (const stage of ALL_STAGES) {
    const varName = `AI_PROVIDER_${stage.toUpperCase()}`;
    const raw = read(env, varName);
    if (raw) overrides[stage] = fromChain(parseChain(raw, varName));
  }
  if (Object.keys(overrides).length > 0) map.overrides = overrides;

  return map;
}
