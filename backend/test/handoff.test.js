import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler, caps } from "../src/index.js";
import { normalizeId, randomId } from "../src/handoff.js";

const ENV_BASE = {
  SEAL_KEY: "a".repeat(32),
  ALLOWED_ORIGIN: "https://aoletsgo12.github.io",
  FRONTEND_URL: "https://aoletsgo12.github.io/ao-intelligence",
};

function memKv() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    _m: m,
  };
}

async function call(h, env, path, { method = "POST", body, origin } = {}) {
  const req = new Request("https://ao-intelligence-api.ao-446557ec.workers.dev" + path, {
    method,
    headers: { "content-type": "application/json", origin: origin || ENV_BASE.ALLOWED_ORIGIN },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  return h(req, env);
}

test("normalizeId and randomId are Crockford-safe", () => {
  assert.equal(normalizeId("ab-il-o"), "AB110");
  assert.equal(normalizeId("abcd-efgh-xxxx"), "ABCDEFGH");
  const id = randomId(8);
  assert.equal(id.length, 8);
  assert.match(id, /^[0-9A-HJKMNP-TV-Z]{8}$/);
});

test("caps.handoff follows the KV binding", () => {
  assert.equal(caps({}).handoff, false);
  assert.equal(caps({ HANDOFF: memKv() }).handoff, true);
});

test("POST /handoff stores ciphertext only and redeem is single-use", async () => {
  const kv = memKv();
  const env = { ...ENV_BASE, HANDOFF: kv };
  const h = createHandler({ fetchImpl: async () => { throw new Error("no"); } });
  const blob = "Q" + "W".repeat(40) + "==";
  const put = await (await call(h, env, "/handoff", { body: { blob } })).json();
  assert.ok(put.id && put.id.length === 8);
  assert.equal(kv._m.get(put.id), blob);
  const first = await call(h, env, "/handoff/redeem", { body: { id: put.id.toLowerCase() } });
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.blob, blob);
  const second = await call(h, env, "/handoff/redeem", { body: { id: put.id } });
  assert.equal(second.status, 404);
  const err = await second.json();
  assert.match(err.error, /expired or has already been used/i);
});

test("POST /handoff refuses other origins, plaintext-looking empty bodies, and missing KV", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no"); } });
  const kvEnv = { ...ENV_BASE, HANDOFF: memKv() };
  assert.equal((await call(h, kvEnv, "/handoff", { body: { blob: "AAAA".repeat(8) }, origin: "https://evil.example" })).status, 403);
  assert.equal((await call(h, ENV_BASE, "/handoff", { body: { blob: "AAAA".repeat(8) } })).status, 503);
  assert.equal((await call(h, kvEnv, "/handoff", { body: { blob: "short" } })).status, 400);
  assert.equal((await call(h, kvEnv, "/handoff/redeem", { body: { id: "!!!" } })).status, 400);
});
