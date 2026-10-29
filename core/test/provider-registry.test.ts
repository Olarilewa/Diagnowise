import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveProviderMap, ProviderConfigError } from "../src/provider-registry.js";

const K = { ANTHROPIC_API_KEY: "a-key", OPENAI_API_KEY: "o-key", OPENAI_MODEL: "o-model", GOOGLE_API_KEY: "g-key", GOOGLE_MODEL: "g-model" };

test("registry: with only ANTHROPIC_API_KEY set, behaviour is exactly v1 (anthropic, no overrides)", () => {
  const map = resolveProviderMap({ ANTHROPIC_API_KEY: "a-key" });
  assert.equal(map.default.name, "anthropic");
  assert.equal(map.overrides, undefined);
});

test("registry: empty-string variables count as unset", () => {
  const map = resolveProviderMap({ ANTHROPIC_API_KEY: "a-key", AI_PROVIDER_DEFAULT: "", AI_PROVIDER_SAFETY_VERIFICATION: "  " });
  assert.equal(map.default.name, "anthropic");
  assert.equal(map.overrides, undefined);
});

test("registry: selects each provider kind", () => {
  assert.equal(resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "openai" }).default.name, "openai");
  assert.equal(resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "google" }).default.name, "google");
  assert.equal(
    resolveProviderMap({ AI_PROVIDER_DEFAULT: "local", AI_LOCAL_BASE_URL: "http://localhost:11434/v1", AI_LOCAL_MODEL: "llama" }).default.name,
    "local"
  );
});

test("registry: a comma chain becomes a failover provider", () => {
  const map = resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "anthropic, openai" });
  assert.equal(map.default.name, "failover(anthropic>openai)");
});

test("registry: per-stage overrides route that stage to a different provider (multi-model)", () => {
  const map = resolveProviderMap({ ...K, AI_PROVIDER_SAFETY_VERIFICATION: "openai", AI_PROVIDER_DIFFERENTIAL_GENERATION: "google" });
  assert.equal(map.default.name, "anthropic");
  assert.equal(map.overrides?.safety_verification?.name, "openai");
  assert.equal(map.overrides?.differential_generation?.name, "google");
  assert.equal(map.overrides?.red_flag_detection, undefined);
});

test("registry: misconfiguration fails immediately and names the variable", () => {
  assert.throws(() => resolveProviderMap({}), /ANTHROPIC_API_KEY/);
  assert.throws(() => resolveProviderMap({ AI_PROVIDER_DEFAULT: "openai", OPENAI_API_KEY: "k" }), /OPENAI_MODEL/);
  assert.throws(() => resolveProviderMap({ AI_PROVIDER_DEFAULT: "openai", OPENAI_MODEL: "m" }), /OPENAI_API_KEY/);
  assert.throws(() => resolveProviderMap({ AI_PROVIDER_DEFAULT: "google", GOOGLE_API_KEY: "k" }), /GOOGLE_MODEL/);
  assert.throws(() => resolveProviderMap({ AI_PROVIDER_DEFAULT: "local", AI_LOCAL_MODEL: "m" }), /AI_LOCAL_BASE_URL/);
  assert.throws(() => resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "mistral" }), (e: unknown) => e instanceof ProviderConfigError && /unknown provider "mistral"/.test(e.message));
  assert.throws(() => resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "anthropic,anthropic" }), /more than once/);
  // an override error names the override variable, not the default
  assert.throws(() => resolveProviderMap({ ANTHROPIC_API_KEY: "k", AI_PROVIDER_SAFETY_VERIFICATION: "nope" }), /AI_PROVIDER_SAFETY_VERIFICATION/);
});

test("registry: the resolved provider is actually wired — a google default calls the Gemini endpoint", async () => {
  let called = "";
  const fetchImpl = (async (url: string) => {
    called = url;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "x" }] } }] }), { status: 200 });
  }) as typeof fetch;
  const map = resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "google" }, { fetchImpl });
  await map.default.complete({ systemPrompt: "s", userPrompt: "u" });
  assert.match(called, /generativelanguage\.googleapis\.com\/v1beta\/models\/g-model:generateContent/);
});

test("registry: failover through the registry fires onFailover and answers from the second provider", async () => {
  const urls: string[] = [];
  const events: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    if (url.includes("anthropic")) return new Response("down", { status: 503 });
    return new Response(JSON.stringify({ model: "o-model", choices: [{ message: { content: "from openai" } }] }), { status: 200 });
  }) as typeof fetch;
  const map = resolveProviderMap({ ...K, AI_PROVIDER_DEFAULT: "anthropic,openai" }, { fetchImpl, onFailover: (e) => events.push(`${e.failedProvider}>${e.nextProvider}`) });
  const r = await map.default.complete({ systemPrompt: "s", userPrompt: "u" });
  assert.equal(r.text, "from openai");
  assert.deepEqual(events, ["anthropic>openai"]);
  assert.equal(urls.length, 2);
});
