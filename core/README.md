# core/ — the open-source clinical reasoning engine

**Status: built (phase 2 of backend → AI orchestration → API). 19 tests
passing, including a live network round-trip against the real Anthropic API.**

`@diagnowise/core` — no dependency on Next.js, Supabase, or any specific
database. It takes structured clinical input and a `ModelProvider`, and
returns structured, validated, audited output. That's what makes it
extractable from the commercial product (strategy doc §30).

```
core/src/
├── types.ts                        shared vocabulary for every stage
├── provider.ts                     the Model Provider Interface (strategy doc §12)
├── providers/
│   ├── anthropic.ts                 real adapter, raw fetch, no SDK dependency
│   └── mock.ts                      deterministic test provider
├── logger.ts                        AiInteractionLogger interface (dependency-injected)
├── json-utils.ts                    strict JSON extraction + Zod validation
├── safety/
│   ├── guardrails.ts                 denylist-based overcertainty checker
│   └── safety-verification-stage.ts  optional second-model safety pass
├── stages/                          one file per pipeline stage
│   ├── extract-and-normalize.ts      stage 1+2
│   ├── red-flags.ts                  stage 3
│   ├── differential.ts               stage 4+5+6
│   ├── contradictions.ts             stage 7
│   ├── missing-information.ts        stage 8
│   ├── investigations.ts             stage 9
│   └── follow-up.ts                  stage 10
└── orchestrator.ts                  ReasoningOrchestrator — sequences stages,
                                       retries malformed JSON once, logs and
                                       guardrail-checks every stage unconditionally
```

## Design decisions worth knowing about

- **Build doc §27's 10 stages become 7 independently-callable, independently-
  loggable functions.** Differential generation, evidence mapping, and
  dangerous-diagnosis detection are one model call, not three — generating a
  differential without its evidence isn't a usable intermediate result, and
  splitting them would triple the context sent to the model for no safety
  benefit (strategy doc §13: "do not blindly call multiple models for every
  request"). Extraction and normalization are similarly combined.

- **Multi-model orchestration is supported, not defaulted to.**
  `StageProviderMap` lets the orchestrator route different stages to
  different providers/models (strategy doc §13's "Model C: Safety
  checking"), and `runFullAnalysis({ runSafetyVerification: true })` runs an
  optional second-opinion pass on dangerous-diagnosis coverage — off by
  default, on when a caller wants it.

- **Malformed model output never becomes a guessed shape.** Every stage's
  response goes through `parseAndValidate()`, which requires an exact Zod
  match. On failure, the orchestrator retries once (LLM JSON output is
  occasionally flaky), then gives up loudly rather than showing a clinician
  a partially-invented result. A dangerous differential item without an
  explanation fails the same way, even if it technically parsed — see
  `stages/differential.ts`.

- **Overcertainty is checked, not just prompted against.** Every stage's
  output — recursively, every string field — is scanned for forbidden
  absolute-certainty language ("you have", "definitely", "100%",
  "guaranteed", "AI diagnosis") before the orchestrator returns. This is
  deterministic and independent of whether the model followed its
  instructions (build doc §28, §46). See `safety/guardrails.ts`.

## Running the tests yourself

```bash
cd core
npm install
npm test
```

19 tests: guardrail correctness (catches bad phrasing, doesn't false-positive
on properly hedged clinical language), full pipeline sequencing with a mock
provider (including per-stage provider overrides — a real exercise of the
multi-model path), contradiction-stage skipping when there's no working
diagnosis, retry-then-succeed and retry-exhaustion-then-log behavior, the
dangerous-item-without-explanation rejection, and — the one test that
actually leaves the sandbox — a real HTTP call to `api.anthropic.com` with a
deliberately invalid key, confirming the adapter turns a genuine 401 into a
clean `ProviderError` rather than a raw fetch exception.

## Not built yet

Investigation/differential/red-flag/contradiction/follow-up **engines** as
separate directories (`differential-engine/`, `red-flag-engine/`, etc.) per
the original strategy-doc layout collapsed into `stages/*.ts` files instead —
same separation of concerns, less directory ceremony for what's currently
~150-250 lines per stage. If any one stage grows enough to need its own
multi-file module, it can become a directory then.

`knowledge/` (versioned clinical knowledge the stages could reference instead
of relying purely on the model's own training) is still future work, per its
own README.
