import { test } from "node:test";
import assert from "node:assert/strict";
import { FailoverProvider, isFailoverEligible } from "../src/providers/failover.js";
import { ProviderError, type ModelProvider } from "../src/provider.js";

function fake(name: string, behave: () => Promise<{ text: string; model: string }>): ModelProvider & { calls: number } {
  const p = { name, calls: 0, async complete() { p.calls++; return behave(); } };
  return p;
}
const ok = (model: string) => async () => ({ text: "ok", model });
const fail = (provider: string, status?: number) => async () => { throw new ProviderError(`${provider} failed`, provider, undefined, status); };
const req = { systemPrompt: "s", userPrompt: "u" };

test("failover: uses the first provider and never touches the second when it succeeds", async () => {
  const a = fake("a", ok("model-a")), b = fake("b", ok("model-b"));
  const r = await new FailoverProvider([a, b]).complete(req);
  assert.equal(r.model, "model-a");
  assert.equal(b.calls, 0);
});

test("failover: eligible failures (5xx, 429, 408, network) move to the next provider, and the answering model is reported", async () => {
  for (const status of [500, 503, 429, 408, undefined]) {
    const events: string[] = [];
    const a = fake("a", fail("a", status)), b = fake("b", ok("model-b"));
    const r = await new FailoverProvider([a, b], { onFailover: (e) => events.push(`${e.failedProvider}>${e.nextProvider}`) }).complete(req);
    assert.equal(r.model, "model-b", `status ${status}`);
    assert.deepEqual(events, ["a>b"]);
  }
});

test("failover: 400/401/403/404 are NOT retried elsewhere — misconfiguration surfaces loudly", async () => {
  for (const status of [400, 401, 403, 404]) {
    const a = fake("a", fail("a", status)), b = fake("b", ok("model-b"));
    await assert.rejects(() => new FailoverProvider([a, b]).complete(req), (e: unknown) => e instanceof ProviderError && e.status === status && e.provider === "a");
    assert.equal(b.calls, 0, `status ${status}`);
  }
});

test("failover: non-ProviderError exceptions are not swallowed", async () => {
  const a = fake("a", async () => { throw new Error("bug"); }), b = fake("b", ok("model-b"));
  await assert.rejects(() => new FailoverProvider([a, b]).complete(req), /bug/);
  assert.equal(b.calls, 0);
});

test("failover: when every provider fails, the error names each one", async () => {
  const a = fake("a", fail("a", 503)), b = fake("b", fail("b", 500));
  await assert.rejects(() => new FailoverProvider([a, b]).complete(req), /All providers failed.*a: a failed.*b: b failed/);
});

test("failover: needs two providers and names itself after the chain", () => {
  assert.throws(() => new FailoverProvider([fake("a", ok("m"))]), /at least two/);
  assert.equal(new FailoverProvider([fake("a", ok("m")), fake("b", ok("m"))]).name, "failover(a>b)");
});

test("isFailoverEligible: only ProviderErrors can be eligible", () => {
  assert.equal(isFailoverEligible(new Error("x")), false);
  assert.equal(isFailoverEligible(new ProviderError("x", "p", undefined, 502)), true);
  assert.equal(isFailoverEligible(new ProviderError("x", "p", undefined, 401)), false);
});
