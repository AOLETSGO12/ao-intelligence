// Work out which IMAP server a mailbox uses from its email address (read-only lookups, nothing is stored).
// 1) a short list of well-known providers, 2) Mozilla's public ISP database, 3) the domain's MX records
// (so a custom domain hosted at Google, Fastmail, Zoho, etc. is recognised).
import { fetchWithTimeout } from "./util.js";

const KNOWN = [
  [/^(gmail|googlemail)\.com$/, "imap.gmail.com", "gmail"],
  [/^(icloud|me|mac)\.com$/, "imap.mail.me.com", "icloud"],
  [/^(yahoo|ymail|rocketmail)\.[a-z.]+$|^yahoo\.co\.uk$/, "imap.mail.yahoo.com", "yahoo"],
  [/^(sky\.com|sky\.co\.uk)$/, "imap.mail.yahoo.com", "sky"],
  [/^(btinternet|btopenworld)\.com$/, "mail.btinternet.com", "bt"],
  [/^(virginmedia|blueyonder\.co\.uk|ntlworld)\.(com|co\.uk)$|^blueyonder\.co\.uk$/, "imap.virginmedia.com", "virgin"],
  [/^(aol|aim)\.com$/, "imap.aol.com", "aol"],
  [/^gmx\.(net|de|at|ch)$/, "imap.gmx.net", "gmx"],
  [/^gmx\.[a-z.]+$/, "imap.gmx.com", "gmx"],
  [/^zoho\.eu$/, "imap.zoho.eu", "zoho"],
  [/^zoho(mail)?\.com$/, "imap.zoho.com", "zoho"],
  [/^(fastmail\.(com|fm)|messagingengine\.com)$/, "imap.fastmail.com", "fastmail"],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, "outlook.office365.com", "microsoft"],
  [/^(proton\.me|protonmail\.com|pm\.me)$/, "", "proton"],
];
const MX_HINT = [
  [/(^|\.)(google|googlemail)\.com$/, "imap.gmail.com", "gmail"],
  [/(^|\.)(outlook|protection\.outlook)\.com$/, "outlook.office365.com", "microsoft"],
  [/(^|\.)yahoodns\.net$/, "imap.mail.yahoo.com", "yahoo"],
  [/(^|\.)messagingengine\.com$/, "imap.fastmail.com", "fastmail"],
  [/(^|\.)zoho\.eu$/, "imap.zoho.eu", "zoho"],
  [/(^|\.)zoho\.com$/, "imap.zoho.com", "zoho"],
  [/(^|\.)(icloud|me)\.com$/, "imap.mail.me.com", "icloud"],
];

function fromKnown(list, name) { for (const [re, host, kind] of list) if (re.test(name)) return { host, kind }; return null; }

async function ispdb(fetchImpl, domain) {
  try {
    const r = await fetchWithTimeout(fetchImpl, "https://autoconfig.thunderbird.net/v1.1/" + encodeURIComponent(domain), { headers: { accept: "application/xml" } }, 6000);
    if (!r.ok) return null;
    const xml = await r.text();
    const blocks = xml.match(/<incomingServer type="imap">[\s\S]*?<\/incomingServer>/g) || [];
    for (const b of blocks) {
      const host = (b.match(/<hostname>([^<%]+)<\/hostname>/) || [])[1];
      const sock = (b.match(/<socketType>([^<]+)<\/socketType>/) || [])[1];
      if (host && /^SSL$/i.test(sock || "")) return host.trim().toLowerCase();
    }
  } catch (e) { /* ignore */ }
  return null;
}

async function mxHosts(fetchImpl, domain) {
  try {
    const r = await fetchWithTimeout(fetchImpl, "https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(domain) + "&type=MX", { headers: { accept: "application/dns-json" } }, 6000);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.Answer || []).filter((a) => a.type === 15).map((a) => String(a.data).split(" ").pop().replace(/\.$/, "").toLowerCase());
  } catch (e) { return []; }
}

/** -> { host, kind } where host may be "" (unknown). kind is a provider hint such as "gmail", "microsoft", "icloud". */
export async function detectImap(fetchImpl, address) {
  const domain = String(address || "").split("@")[1]?.toLowerCase().trim();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { host: "", kind: "" };
  const k = fromKnown(KNOWN, domain);
  if (k) return k;
  const viaDb = await ispdb(fetchImpl, domain);
  if (viaDb) return { host: viaDb, kind: "" };
  for (const mx of (await mxHosts(fetchImpl, domain)).slice(0, 3)) {
    const m = fromKnown(MX_HINT, mx);
    if (m) return { ...m, via: "mx" };
    const parts = mx.split(".");
    const root = parts.slice(-2).join(".");
    const h = await ispdb(fetchImpl, root);
    if (h) return { host: h, kind: "", via: "mx" };
  }
  return { host: "", kind: "" };
}
