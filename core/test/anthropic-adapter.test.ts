import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { ProviderError } from "../src/provider.js";

test("AnthropicProvider: builds the correct request shape", async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  const fakeFetch = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: '{"ok":true}' }],
        model: "claude-sonnet-4-6",
        usage: { input_tokens: 42, output_tokens: 7 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  const provider = new AnthropicProvider({ apiKey: "sk-test-key", fetchImpl: fakeFetch });
  const result = await provider.complete({ systemPrompt: "system instructions", userPrompt: "user question", maxTokens: 256 });

  assert.equal(capturedUrl, "https://api.anthropic.com/v1/messages");
  assert.equal(capturedInit?.method, "POST");

  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "sk-test-key");
  assert.equal(headers["anthropic-version"], "2023-06-01");
  assert.equal(headers["content-type"], "application/json");

  const body = JSON.parse(capturedInit?.body as string);
  assert.equal(body.system, "system instructions");
  assert.equal(body.max_tokens, 256);
  assert.deepEqual(body.messages, [{ role: "user", content: "user question" }]);

  assert.equal(result.text, '{"ok":true}');
  assert.equal(result.model, "claude-sonnet-4-6");
  assert.deepEqual(result.usage, { inputTokens: 42, outputTokens: 7 });
});

test("AnthropicProvider: uses the default model and default max_tokens when not specified", async () => {
  let capturedBody: any;
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    capturedBody = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }], model: "claude-sonnet-4-6" }), { status: 200 });
  }) as typeof fetch;

  const provider = new AnthropicProvider({ apiKey: "sk-test", fetchImpl: fakeFetch });
  await provider.complete({ systemPrompt: "s", userPrompt: "u" });

  assert.equal(capturedBody.model, "claude-sonnet-4-6");
  assert.equal(capturedBody.max_tokens, 2048);
});

test("AnthropicProvider: throws ProviderError on a non-text response", async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ content: [{ type: "tool_use" }], model: "claude-sonnet-4-6" }), { status: 200 })) as typeof fetch;

  const provider = new AnthropicProvider({ apiKey: "sk-test", fetchImpl: fakeFetch });
  await assert.rejects(() => provider.complete({ systemPrompt: "s", userPrompt: "u" }), ProviderError);
});

test("AnthropicProvider: throws ProviderError with status + body on a non-2xx response", async () => {
  const fakeFetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  const provider = new AnthropicProvider({ apiKey: "sk-test", fetchImpl: fakeFetch });

  await assert.rejects(() => provider.complete({ systemPrompt: "s", userPrompt: "u" }), (err: unknown) => {
    assert.ok(err instanceof ProviderError);
    assert.match(err.message, /429/);
    assert.match(err.message, /rate limited/);
    return true;
  });
});

test("AnthropicProvider constructor requires an apiKey", () => {
  assert.throws(() => new AnthropicProvider({ apiKey: "" }), /requires an apiKey/);
});

// --- Real network test, no mocking. Confirms the adapter's error handling ---
// --- works against the actual live Anthropic API, not just our own mock. ---
test("AnthropicProvider: real network round-trip against api.anthropic.com surfaces a clean auth error", { timeout: 15000 }, async () => {
  const provider = new AnthropicProvider({ apiKey: "sk-ant-deliberately-invalid-for-testing" });

  await assert.rejects(
    () => provider.complete({ systemPrompt: "test", userPrompt: "test", maxTokens: 16 }),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError, "a real API error should surface as our own ProviderError type, not a raw fetch/HTTP exception");
      assert.match(err.message, /401/, "an invalid key should produce a 401 from the real API");
      assert.equal(err.provider, "anthropic");
      return true;
    }
  );
});
