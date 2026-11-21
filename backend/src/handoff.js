// One-time Home Screen handoff. The Worker only stores ciphertext the browser already
// encrypted. The code a person types holds the lookup id plus the key, so this
// process never sees dashboards or sealed connection details in plaintext.
import { HttpError } from "./util.js";
import { rateLimitDraft, rateKey } from "./drafts.js";

const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TTL_SEC = 10 * 60;
const MAX_BLOB = 450000;
const ID_LEN = 8;

export function randomId(len = ID_LEN) {
  const needed = Math.ceil(len * 5 / 8);
  const bytes = new Uint8Array(needed);
  crypto.getRandomValues(bytes);
  let bits = 0, n = 0, out = "";
  for (let i = 0; i < bytes.length && out.length < len; i++) {
    n = (n << 8) | bytes[i];
    bits += 8;
    while (bits >= 5 && out.length < len) {
      out += ALPHA[(n >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

export function normalizeId(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, "")
    .slice(0, ID_LEN);
}

export async function putHandoff(env, body, ip) {
  if (!env.HANDOFF || typeof env.HANDOFF.put !== "function") {
    throw new HttpError(503, "Copying to the Home Screen app isn’t switched on yet.");
  }
  const rk = await rateKey("handoff-put", ip, "");
  rateLimitDraft(rk, 8, 15 * 60 * 1000, "Please wait a few minutes and try again.");
  const blob = typeof body.blob === "string" ? body.blob.trim() : "";
  if (blob.length < 24) throw new HttpError(400, "That request wasn’t valid.");
  if (blob.length > MAX_BLOB) throw new HttpError(413, "That’s too much to copy in one go. Try again, or remove a large bank statement first.");
  if (!/^[A-Za-z0-9+/_=-]+$/.test(blob)) throw new HttpError(400, "That request wasn’t valid.");
  let id = randomId(ID_LEN);
  for (let i = 0; i < 6; i++) {
    if (!(await env.HANDOFF.get(id))) break;
    id = randomId(ID_LEN);
  }
  await env.HANDOFF.put(id, blob, { expirationTtl: TTL_SEC });
  try { console.log(JSON.stringify({ ev: "handoff-put", bytes: blob.length })); } catch (e) { /* never log the blob */ }
  return { id, expiresIn: TTL_SEC };
}

export async function redeemHandoff(env, body, ip) {
  if (!env.HANDOFF || typeof env.HANDOFF.get !== "function") {
    throw new HttpError(503, "Copying to the Home Screen app isn’t switched on yet.");
  }
  const rk = await rateKey("handoff-get", ip, "");
  rateLimitDraft(rk, 10, 15 * 60 * 1000, "Please wait a few minutes and try again.");
  const id = normalizeId(body.id);
  if (id.length !== ID_LEN) throw new HttpError(400, "That code doesn’t look right. Check it and try again.");
  const blob = await env.HANDOFF.get(id);
  if (!blob) throw new HttpError(404, "That code has expired or has already been used.");
  await env.HANDOFF.delete(id);
  try { console.log(JSON.stringify({ ev: "handoff-redeem", ok: true })); } catch (e) { /* never log the blob */ }
  return { blob };
}
