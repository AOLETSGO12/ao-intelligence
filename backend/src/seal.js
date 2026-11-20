// Sealing: AES-GCM encryption of small JSON blobs, and HMAC-signed state. No storage needed anywhere:
// the Worker hands the browser an opaque string and trusts only strings it can decrypt.
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64uEncode(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64uDecode(str) {
  const b = atob(String(str).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "="));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function derive(secret, purpose, usages, alg) {
  if (!secret || String(secret).length < 16) throw new Error("SEAL_KEY is missing or too short (use at least 16 random characters).");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`ao-intelligence:${purpose}:${secret}`));
  return crypto.subtle.importKey("raw", raw, alg, false, usages);
}

export async function seal(secret, obj) {
  const key = await derive(secret, "seal", ["encrypt"], { name: "AES-GCM" });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return b64uEncode(out);
}

export async function unseal(secret, token) {
  try {
    const key = await derive(secret, "seal", ["decrypt"], { name: "AES-GCM" });
    const all = b64uDecode(token);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12));
    return JSON.parse(dec.decode(pt));
  } catch (e) {
    const err = new Error("This connection is no longer valid. Please connect it again.");
    err.status = 401; err.code = "reauth";
    throw err;
  }
}

export async function signState(secret, obj) {
  const key = await derive(secret, "state", ["sign"], { name: "HMAC", hash: "SHA-256" });
  const body = b64uEncode(enc.encode(JSON.stringify(obj)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64uEncode(sig)}`;
}

export async function verifyState(secret, str) {
  try {
    const [body, sig] = String(str).split(".");
    const key = await derive(secret, "state", ["verify"], { name: "HMAC", hash: "SHA-256" });
    const ok = await crypto.subtle.verify("HMAC", key, b64uDecode(sig), enc.encode(body));
    if (!ok) return null;
    const obj = JSON.parse(dec.decode(b64uDecode(body)));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch (e) {
    return null;
  }
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}
