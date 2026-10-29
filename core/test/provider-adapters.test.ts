import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../src/providers/openai.js";
import { GoogleProvider } from "../src/providers/google.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { ProviderError } from "../src/provider.js";

type Captured = { url?: string; init?: RequestInit };
function fetchReturning(body: unknown, status = 200, cap: Captured = {}): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    cap.url = url;
    cap.init = init;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}
const jsonBody = (c: Captured) => JSON.parse(c.init?.body as string);
const headers = (c: Captured) => c.init?.headers as Record<string, string>;

// ---------------- OpenAI-compatible ----------------
test("openai: builds the request and parses the response", async () => {
  const cap: Captured = {};
  const p = new OpenAIProvider({
    apiKey: "sk-test", model: "m-1",
    fetchImpl: fetchReturning({ model: "m-1-2026", choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }, 200, cap),
  });
  const r = await p.complete({ systemPrompt: "sys", userPrompt: "usr", maxTokens: 99 });
  assert.equal(cap.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(headers(cap)["authorization"], "Bearer sk-test");
  assert.deepEqual(jsonBody(cap).messages, [{ role: "system", content: "sys" }, { role: "user", content: "usr" }]);
  assert.equal(jsonBody(cap).max_completion_tokens, 99);
  assert.equal(jsonBody(cap).max_tokens, undefined);
  assert.deepEqual(r, { text: "hi", model: "m-1-2026", usage: { inputTokens: 5, outputTokens: 2 } });
});

test("openai: local baseUrl needs no key, uses max_tokens, and is named 'local'", async () => {
  const cap: Captured = {};
  const p = new OpenAIProvider({
    baseUrl: "http://localhost:11434/v1/", model: "llama",
    fetchImpl: fetchReturning({ choices: [{ message: { content: "ok" } }] }, 200, cap),
  });
  assert.equal(p.name, "local");
  const r = await p.complete({ systemPrompt: "s", userPrompt: "u" });
  assert.equal(cap.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(headers(cap)["authorization"], undefined);
  assert.equal(jsonBody(cap).max_tokens, 2048);
  assert.equal(r.model, "llama");
  assert.equal(r.usage, undefined);
});

test("openai: constructor demands a model, and a key unless baseUrl is set", () => {
  assert.throws(() => new OpenAIProvider({ apiKey: "k", model: "" }), /requires a model/);
  assert.throws(() => new OpenAIProvider({ model: "m" }), /requires an apiKey/);
});

test("openai: non-2xx carries the HTTP status; refusal and empty content are errors", async () => {
  await assert.rejects(
    () => new OpenAIProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning("slow down", 429) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    (e: unknown) => e instanceof ProviderError && e.status === 429 && /slow down/.test(e.message)
  );
  await assert.rejects(
    () => new OpenAIProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning({ choices: [{ message: { content: null, refusal: "no" } }] }) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    /refused/
  );
  await assert.rejects(
    () => new OpenAIProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning({ choices: [] }) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    /no text content/
  );
});

test("openai: a network failure becomes a ProviderError with no status", async () => {
  const boom = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  await assert.rejects(
    () => new OpenAIProvider({ apiKey: "k", model: "m", fetchImpl: boom }).complete({ systemPrompt: "s", userPrompt: "u" }),
    (e: unknown) => e instanceof ProviderError && e.status === undefined
  );
});

// ---------------- Google ----------------
test("google: builds the request and joins text parts", async () => {
  const cap: Captured = {};
  const p = new GoogleProvider({
    apiKey: "g-key", model: "models/gem-1",
    fetchImpl: fetchReturning({
      candidates: [{ content: { parts: [{ text: "{\"a\":" }, { text: "1}" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 }, modelVersion: "gem-1-001",
    }, 200, cap),
  });
  const r = await p.complete({ systemPrompt: "sys", userPrompt: "usr", maxTokens: 50 });
  assert.equal(cap.url, "https://generativelanguage.googleapis.com/v1beta/models/gem-1:generateContent");
  assert.equal(headers(cap)["x-goog-api-key"], "g-key");
  assert.deepEqual(jsonBody(cap).systemInstruction, { parts: [{ text: "sys" }] });
  assert.deepEqual(jsonBody(cap).contents, [{ role: "user", parts: [{ text: "usr" }] }]);
  assert.equal(jsonBody(cap).generationConfig.maxOutputTokens, 50);
  assert.deepEqual(r, { text: "{\"a\":1}", model: "gem-1-001", usage: { inputTokens: 7, outputTokens: 3 } });
});

test("google: a prompt block and an empty candidate are explicit errors naming the reason", async () => {
  await assert.rejects(
    () => new GoogleProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning({ promptFeedback: { blockReason: "SAFETY" } }) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    /blocked the prompt \(SAFETY\)/
  );
  await assert.rejects(
    () => new GoogleProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning({ candidates: [{ finishReason: "MAX_TOKENS" }] }) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    /finishReason: MAX_TOKENS/
  );
});

test("google: non-2xx carries the HTTP status; constructor validates", async () => {
  await assert.rejects(
    () => new GoogleProvider({ apiKey: "k", model: "m", fetchImpl: fetchReturning("nope", 503) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    (e: unknown) => e instanceof ProviderError && e.status === 503
  );
  assert.throws(() => new GoogleProvider({ apiKey: "", model: "m" }), /requires an apiKey/);
  assert.throws(() => new GoogleProvider({ apiKey: "k", model: "" }), /requires a model/);
});

// ---------------- Anthropic (regression: status is now attached) ----------------
test("anthropic: non-2xx now carries the HTTP status", async () => {
  await assert.rejects(
    () => new AnthropicProvider({ apiKey: "k", fetchImpl: fetchReturning("rate limited", 429) }).complete({ systemPrompt: "s", userPrompt: "u" }),
    (e: unknown) => e instanceof ProviderError && e.status === 429 && /rate limited/.test(e.message)
  );
});
