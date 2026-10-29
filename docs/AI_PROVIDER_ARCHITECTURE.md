# AI provider architecture

Diagnowise's reasoning engine never talks to a vendor directly. Every pipeline
stage takes a `ModelProvider` (`core/src/provider.ts`); which provider that is
comes from configuration.

## Configuration

Every `AI_PROVIDER_*` value is a comma-separated chain. One entry = that
provider. Several = try in order (failover).

| Variable | Meaning |
|---|---|
| `AI_PROVIDER_DEFAULT` | Provider(s) for every stage. Default `anthropic` (v1 behaviour). |
| `AI_PROVIDER_<STAGE>` | Optional per-stage override, e.g. `AI_PROVIDER_SAFETY_VERIFICATION=openai`. Stages: `EXTRACTION_NORMALIZATION`, `RED_FLAG_DETECTION`, `DIFFERENTIAL_GENERATION`, `CONTRADICTION_DETECTION`, `MISSING_INFORMATION_ANALYSIS`, `INVESTIGATION_CONSIDERATIONS`, `FOLLOW_UP_REASONING`, `SAFETY_VERIFICATION`, `PATIENT_EXPLANATION`. |

| Provider | Variables |
|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL` (optional) |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` (both required) |
| `google` | `GOOGLE_API_KEY`, `GOOGLE_MODEL` (both required) |
| `local` | `AI_LOCAL_BASE_URL`, `AI_LOCAL_MODEL` (required), `AI_LOCAL_API_KEY` (optional). Any OpenAI-compatible server: Ollama, vLLM, llama.cpp, LM Studio. |

There is deliberately no default model for openai/google/local: model names go
stale, and a guessed default would ship a deprecated one silently.
Misconfiguration throws at startup, naming the variable.

## Failover rules

`FailoverProvider` moves to the next provider only for availability failures:
network errors, HTTP 408/429/5xx, or a malformed-but-200 response. HTTP
400/401/403/404 are **not** retried elsewhere — they mean our request or
credentials are wrong, every provider would fail the same way, and hopping to
another vendor would hide the misconfiguration.

Failover changes which model answered. The orchestrator already logs
`result.model` per stage into `ai_interactions`, so the audit trail records
the model that actually produced each output. Pass `onFailover` to
`resolveProviderMap` to also emit a warning.

## Multi-model use

Routing `safety_verification` to a different vendor than
`differential_generation` is the intended use of per-stage overrides: a second
opinion from a different model is only independent if it is a different model.

## Known limits

- OpenAI and Google adapters are verified against mocked HTTP only; their
  hosts were not reachable from the build environment. Run one real call per
  provider before relying on them.
- JSON-output reliability differs by model. The orchestrator's
  retry-once-on-malformed-JSON was tuned against Anthropic; expect to revisit
  it per provider.
- Google can return HTTP 200 with a safety block; this surfaces as a
  `ProviderError` naming the reason, and is failover-eligible.
