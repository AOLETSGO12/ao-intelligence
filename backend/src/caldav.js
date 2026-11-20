// CalDAV (iCloud, Zoho, Fastmail, Nextcloud, ...) and Calendly: read-only event lookups.
//
// iCloud is particular: a PROPFIND to caldav.icloud.com often 301/302/307s to a partition
// host such as p56-caldav.icloud.com. The Fetch "follow" mode can change PROPFIND into GET,
// drop the body, and strip Authorization on the cross-origin hop — which then looks like
// "we signed in but couldn’t find a calendar / server details wrong". We follow redirects
// ourselves, keeping the method, body and Basic auth, and resolve hrefs from the final URL.
import { HttpError, fetchWithTimeout, assertPublicHost, wall, addDaysIso, pad } from "./util.js";
import { parseIcs } from "./ics.js";

const UA = "AO-Intelligence/1.0 (CalDAV)";
const MAX_REDIRECTS = 8;

export function normalizeUser(s) { return String(s || "").trim().toLowerCase(); }
/** Strip spaces only (Apple/Google/Yahoo codes are often shown in groups). Keep dashes. */
export function normalizePass(s) { return String(s || "").replace(/\s+/g, ""); }

const basic = (u, p) => "Basic " + btoa(String.fromCharCode(...new TextEncoder().encode(`${normalizeUser(u)}:${normalizePass(p)}`)));
const tagRe = (name) => new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
const tagAll = (name) => new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "gi");
const xmlText = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export function absolute(base, href) { try { return new URL(href, base).toString(); } catch (e) { return null; } }

function hrefInside(xml, tag) {
  const block = (String(xml).match(tagRe(tag)) || [])[1];
  if (block == null) return null;
  const h = block.match(tagRe("href"));
  return h ? xmlText(h[1]).trim() : null;
}

function logCal(log, ev, data) {
  if (!log) return;
  try { log(ev, data); } catch (e) { /* never let logging break a connection */ }
}

/** One CalDAV request. Follows 301/302/303/307/308 by hand, keeping method, body and auth. */
export async function dav(fetchImpl, method, url, auth, body, depth, log) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed;
    try { parsed = new URL(current); } catch (e) { throw new HttpError(502, "The calendar server sent a redirect we couldn’t follow.", "redirect"); }
    assertPublicHost(parsed.hostname);
    if (parsed.protocol !== "https:") throw new HttpError(400, "CalDAV addresses must start with https://");
    let r;
    try {
      r = await fetchWithTimeout(fetchImpl, current, {
        method,
        headers: {
          authorization: auth,
          "content-type": "application/xml; charset=utf-8",
          depth: String(depth),
          accept: "application/xml, text/xml, */*",
          "user-agent": UA
        },
        body,
        redirect: "manual"
      }, 20000);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(502, "We couldn’t reach the calendar server. Please try again.", "network");
    }
    const loc = r.headers.get("location") || r.headers.get("Location") || "";
    logCal(log, "caldav", { method, host: parsed.hostname, path: parsed.pathname, status: r.status, hop, redirect: loc ? "yes" : "no" });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      if (!loc) throw new HttpError(502, "The calendar server sent a redirect with no address.", "redirect");
      const next = absolute(current, loc);
      if (!next) throw new HttpError(502, "The calendar server sent a redirect we couldn’t follow.", "redirect");
      try { await r.arrayBuffer(); } catch (e) { /* ignore */ }
      current = next;
      continue;
    }
    if (r.status === 401 || r.status === 403) throw new HttpError(401, "The calendar server didn’t accept that username and app password.", "login");
    if (r.status !== 207 && !r.ok) throw new HttpError(502, "The calendar server answered with an error (" + r.status + ").", "http");
    return { text: await r.text(), url: current, status: r.status };
  }
  throw new HttpError(502, "The calendar server kept redirecting and we stopped following.", "redirect");
}

const PROPFIND_ROOT = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>`;
const PROPFIND_HOME = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>`;

/** Find the calendar collections behind a CalDAV address. */
export async function discoverCalendars(fetchImpl, startUrl, username, password, opts) {
  const log = opts && opts.log;
  const u = new URL(startUrl);
  assertPublicHost(u.hostname);
  if (u.protocol !== "https:") throw new HttpError(400, "CalDAV addresses must start with https://");
  const auth = basic(username, password);
  const first = await dav(fetchImpl, "PROPFIND", u.toString(), auth, PROPFIND_ROOT, 0, log);
  const firstType = (first.text.match(tagRe("resourcetype")) || [])[1] || "";
  if (/<(?:[\w-]+:)?calendar(?:\s|\/|>)/i.test(firstType)) return [first.url];
  let home = null;
  const homeHref = hrefInside(first.text, "calendar-home-set");
  if (homeHref) home = absolute(first.url, homeHref);
  if (!home) {
    const principalHref = hrefInside(first.text, "current-user-principal");
    if (principalHref) {
      const pUrl = absolute(first.url, principalHref);
      if (!pUrl) throw new HttpError(502, "The calendar server sent a redirect we couldn’t follow.", "redirect");
      assertPublicHost(new URL(pUrl).hostname);
      const p = await dav(fetchImpl, "PROPFIND", pUrl, auth, PROPFIND_ROOT, 0, log);
      const hs = hrefInside(p.text, "calendar-home-set");
      if (hs) home = absolute(p.url, hs);
    }
  }
  if (!home) home = first.url;
  assertPublicHost(new URL(home).hostname);
  const listed = await dav(fetchImpl, "PROPFIND", home, auth, PROPFIND_HOME, 1, log);
  const cals = [];
  (listed.text.match(tagAll("response")) || []).forEach((resp) => {
    const href = (resp.match(tagRe("href")) || [])[1];
    if (!href) return;
    const rtype = (resp.match(tagRe("resourcetype")) || [])[1] || "";
    if (!/<(?:[\w-]+:)?calendar(?:\s|\/|>)/i.test(rtype)) return;
    const comps = (resp.match(tagRe("supported-calendar-component-set")) || [])[1];
    if (comps && !/VEVENT/i.test(comps)) return;
    const abs = absolute(listed.url, xmlText(href));
    if (abs) cals.push(abs);
  });
  logCal(log, "caldav-found", { host: new URL(home).hostname, count: cals.length });
  if (!cals.length) throw new HttpError(422, "We signed in, but didn’t find any calendars in that account.", "nocal");
  return cals.slice(0, 8);
}

function davStamp(iso, endOfDay) { return iso.replace(/-/g, "") + (endOfDay ? "T235959Z" : "T000000Z"); }

export async function fetchCaldavEvents(fetchImpl, cals, username, password, { from, to, tz }, opts) {
  const log = opts && opts.log;
  const auth = basic(username, password);
  const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${davStamp(addDaysIso(from, -1))}" end="${davStamp(addDaysIso(to, 1), true)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const out = [];
  for (const c of cals) {
    assertPublicHost(new URL(c).hostname);
    const xml = await dav(fetchImpl, "REPORT", c, auth, body, 1, log);
    (xml.text.match(tagAll("calendar-data")) || []).forEach((m) => {
      const ics = xmlText((m.match(tagRe("calendar-data")) || [])[1] || "");
      if (/BEGIN:VCALENDAR/i.test(ics)) out.push(...parseIcs(ics, { from, to, tz }));
    });
  }
  out.sort((a, b) => (a.date + a.start < b.date + b.start ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------- Calendly (personal access token)
export async function calendlyUser(fetchImpl, token) {
  const r = await fetchWithTimeout(fetchImpl, "https://api.calendly.com/users/me", { headers: { authorization: "Bearer " + token } }, 15000);
  if (r.status === 401) throw new HttpError(401, "Calendly didn’t accept that token.", "login");
  if (!r.ok) throw new HttpError(502, "Calendly answered with an error (" + r.status + ").");
  const j = await r.json();
  return { uri: j.resource.uri, name: j.resource.name, email: j.resource.email };
}
export async function calendlyEvents(fetchImpl, token, userUri, { from, to, tz }) {
  const min = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10)) - 86400000).toISOString();
  const max = new Date(Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) + 2 * 86400000).toISOString();
  const url = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${encodeURIComponent(min)}&max_start_time=${encodeURIComponent(max)}&status=active&count=100&sort=start_time:asc`;
  const r = await fetchWithTimeout(fetchImpl, url, { headers: { authorization: "Bearer " + token } }, 15000);
  if (r.status === 401) throw new HttpError(401, "Calendly sign-in expired.", "reauth");
  if (!r.ok) throw new HttpError(502, "Calendly answered with an error (" + r.status + ").");
  const j = await r.json();
  return (j.collection || []).map((e) => {
    const s = wall(Date.parse(e.start_time), tz), en = wall(Date.parse(e.end_time), tz);
    const loc = e.location || {};
    return { id: "cal:" + e.uri.split("/").pop(), date: s.date, start: s.time, end: en.date === s.date ? en.time : "23:59", title: e.name || "Calendly meeting", kind: "meeting", place: loc.join_url ? "Video call" : (loc.location || loc.type || "") };
  }).filter((e) => e.date >= from && e.date <= to);
}
