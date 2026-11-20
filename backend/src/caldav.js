// CalDAV (iCloud, Zoho, Fastmail, Nextcloud, ...) and Calendly: read-only event lookups.
import { HttpError, fetchWithTimeout, assertPublicHost, wall, addDaysIso, pad } from "./util.js";
import { parseIcs } from "./ics.js";

const basic = (u, p) => "Basic " + btoa(String.fromCharCode(...new TextEncoder().encode(`${u}:${p}`)));
const tagRe = (name) => new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");
const tagAll = (name) => new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "gi");
const xmlText = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function absolute(base, href) { try { return new URL(href, base).toString(); } catch (e) { return null; } }

async function dav(fetchImpl, method, url, auth, body, depth) {
  const r = await fetchWithTimeout(fetchImpl, url, { method, headers: { authorization: auth, "content-type": "application/xml; charset=utf-8", depth: String(depth), accept: "application/xml, text/xml, */*" }, body, redirect: "follow" }, 20000);
  if (r.status === 401 || r.status === 403) throw new HttpError(401, "The calendar server didn’t accept that username and app password.", "login");
  if (r.status !== 207 && !r.ok) throw new HttpError(502, "The calendar server answered with an error (" + r.status + ").");
  return r.text();
}

const PROPFIND_ROOT = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>`;
const PROPFIND_HOME = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>`;

/** Find the calendar collections behind a CalDAV address. */
export async function discoverCalendars(fetchImpl, startUrl, username, password) {
  const u = new URL(startUrl);
  assertPublicHost(u.hostname);
  if (u.protocol !== "https:") throw new HttpError(400, "CalDAV addresses must start with https://");
  const auth = basic(username, password);
  const firstXml = await dav(fetchImpl, "PROPFIND", u.toString(), auth, PROPFIND_ROOT, 0);
  const firstType = (firstXml.match(tagRe("resourcetype")) || [])[1] || "";
  if (/<(?:[\w-]+:)?calendar\s*\/?>/i.test(firstType)) return [u.toString()];
  let home = null;
  const homeSet = firstXml.match(/<(?:[\w-]+:)?calendar-home-set[^>]*>\s*<(?:[\w-]+:)?href[^>]*>([^<]+)</i);
  if (homeSet) home = absolute(u.toString(), xmlText(homeSet[1]));
  if (!home) {
    const principal = firstXml.match(/<(?:[\w-]+:)?current-user-principal[^>]*>\s*<(?:[\w-]+:)?href[^>]*>([^<]+)</i);
    if (principal) {
      const pUrl = absolute(u.toString(), xmlText(principal[1]));
      assertPublicHost(new URL(pUrl).hostname);
      const pXml = await dav(fetchImpl, "PROPFIND", pUrl, auth, PROPFIND_ROOT, 0);
      const hs = pXml.match(/<(?:[\w-]+:)?calendar-home-set[^>]*>\s*<(?:[\w-]+:)?href[^>]*>([^<]+)</i);
      if (hs) home = absolute(pUrl, xmlText(hs[1]));
    }
  }
  if (!home) { // as a last resort treat the given address itself as the home
    home = u.toString();
  }
  assertPublicHost(new URL(home).hostname);
  const homeXml = await dav(fetchImpl, "PROPFIND", home, auth, PROPFIND_HOME, 1);
  const cals = [];
  (homeXml.match(tagAll("response")) || []).forEach((resp) => {
    const href = (resp.match(tagRe("href")) || [])[1];
    if (!href) return;
    const rtype = (resp.match(tagRe("resourcetype")) || [])[1] || "";
    if (!/<(?:[\w-]+:)?calendar\s*\/?>/i.test(rtype)) return;
    const comps = (resp.match(tagRe("supported-calendar-component-set")) || [])[1];
    if (comps && !/VEVENT/i.test(comps)) return;
    const abs = absolute(home, xmlText(href));
    if (abs) cals.push(abs);
  });
  if (!cals.length) throw new HttpError(422, "We signed in but couldn’t find a calendar there. Check the server address.");
  return cals.slice(0, 8);
}

function davStamp(iso, endOfDay) { return iso.replace(/-/g, "") + (endOfDay ? "T235959Z" : "T000000Z"); }

export async function fetchCaldavEvents(fetchImpl, cals, username, password, { from, to, tz }) {
  const auth = basic(username, password);
  const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${davStamp(addDaysIso(from, -1))}" end="${davStamp(addDaysIso(to, 1), true)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const out = [];
  for (const c of cals) {
    assertPublicHost(new URL(c).hostname);
    const xml = await dav(fetchImpl, "REPORT", c, auth, body, 1);
    (xml.match(tagAll("calendar-data")) || []).forEach((m) => {
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
