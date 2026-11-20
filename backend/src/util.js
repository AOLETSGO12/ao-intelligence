export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function pad(n) { return (n < 10 ? "0" : "") + n; }

/** Date/time pieces of an instant in a given IANA time zone. */
export function wall(epochMs, tz) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epochMs));
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epochMs));
  }
  const m = {};
  parts.forEach((p) => { m[p.type] = p.value; });
  return { y: +m.year, mo: +m.month, d: +m.day, h: +m.hour, mi: +m.minute, s: +m.second, date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour}:${m.minute}` };
}

/** Epoch for a wall-clock time in a time zone (DST aware). Returns null when the zone is unknown. */
export function wallToEpoch(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  try {
    let t = guess;
    for (let i = 0; i < 2; i++) {
      const w = wall(t, tz);
      const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
      t = t - (asUtc - guess);
    }
    return t;
  } catch (e) { return null; }
}

export function isoDate(y, mo, d) { return `${y}-${pad(mo)}-${pad(d)}`; }
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export async function fetchWithTimeout(fetchImpl, url, init, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetchImpl(url, { ...init, signal: ctl.signal }); }
  catch (e) { throw new HttpError(504, "The other service didn’t answer in time. Please try again."); }
  finally { clearTimeout(t); }
}

export function orgFromDomain(domain) {
  if (!domain) return "";
  const parts = domain.split(".");
  const core = parts.length > 2 && /^(co|org|ac|gov|com)$/i.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[Math.max(0, parts.length - 2)];
  return (core || domain).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Block obviously-internal hosts. (Workers cannot reach private networks anyway; this is belt and braces.) */
export function assertPublicHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) throw new HttpError(400, "That address isn’t allowed.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":") || h.startsWith("[")) throw new HttpError(400, "Please use a name (like imap.example.com), not an IP address.");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) throw new HttpError(400, "That server name doesn’t look right.");
}
