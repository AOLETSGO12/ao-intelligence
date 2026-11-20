// IMAP host fallbacks. Zoho (and a few others) put accounts on different servers by
// data centre and by account type; a single pre-filled host is often wrong.
// We try the likely names in order on connect and keep the one that works.
import { HttpError } from "./util.js";

// suffix is the host ending used for imap. / imappro.
export const ZOHO_DCS = [
  { id: "uk", suffix: "zoho.uk", accounts: "https://accounts.zoho.uk/home#security/app_password", mx: /(^|\.)zoho\.uk$/i, mail: /^(zoho|zohomail)\.uk$/i },
  { id: "eu", suffix: "zoho.eu", accounts: "https://accounts.zoho.eu/home#security/app_password", mx: /(^|\.)zoho\.eu$/i, mail: /^(zoho|zohomail)\.eu$/i },
  { id: "au", suffix: "zoho.com.au", accounts: "https://accounts.zoho.com.au/home#security/app_password", mx: /(^|\.)zoho\.com\.au$/i, mail: /^(zoho|zohomail)\.com\.au$/i },
  { id: "us", suffix: "zoho.com", accounts: "https://accounts.zoho.com/home#security/app_password", mx: /(^|\.)zoho\.com$/i, mail: /^(zoho|zohomail)\.com$/i },
  { id: "in", suffix: "zoho.in", accounts: "https://accounts.zoho.in/home#security/app_password", mx: /(^|\.)zoho\.in$/i, mail: /^(zoho|zohomail)\.in$/i },
  { id: "jp", suffix: "zoho.jp", accounts: "https://accounts.zoho.jp/home#security/app_password", mx: /(^|\.)zoho\.jp$/i, mail: /^(zoho|zohomail)\.jp$/i },
  { id: "ca", suffix: "zohocloud.ca", accounts: "https://accounts.zohocloud.ca/home#security/app_password", mx: /(^|\.)zohocloud\.ca$/i, mail: /^zohocloud\.ca$/i },
  { id: "sa", suffix: "zoho.sa", accounts: "https://accounts.zoho.sa/home#security/app_password", mx: /(^|\.)zoho\.sa$/i, mail: /^(zoho|zohomail)\.sa$/i },
];

// Neighbours after the detected data centre. UK and EU sit next to each other; then US, then the rest.
const DC_AFTER = {
  uk: ["eu", "us", "in", "au", "jp", "ca", "sa"],
  eu: ["uk", "us", "in", "au", "jp", "ca", "sa"],
  us: ["eu", "uk", "in", "au", "jp", "ca", "sa"],
  in: ["us", "eu", "uk", "au", "jp", "ca", "sa"],
  au: ["us", "eu", "uk", "in", "jp", "ca", "sa"],
  jp: ["us", "eu", "uk", "in", "au", "ca", "sa"],
  ca: ["us", "eu", "uk", "in", "au", "jp", "sa"],
  sa: ["eu", "us", "uk", "in", "au", "jp", "ca"],
};

function unique(list) {
  const seen = new Set(), out = [];
  for (const x of list) {
    const h = String(x || "").toLowerCase().trim();
    if (!h || seen.has(h)) continue;
    seen.add(h); out.push(h);
  }
  return out;
}

export function zohoFromDomain(domain) {
  const d = String(domain || "").toLowerCase().trim();
  if (!d) return null;
  return ZOHO_DCS.find((dc) => dc.mail.test(d)) || null;
}

export function zohoFromMx(mx) {
  const h = String(mx || "").toLowerCase().replace(/\.$/, "").trim();
  if (!h) return null;
  return ZOHO_DCS.find((dc) => dc.mx.test(h)) || null;
}

export function zohoFromHost(host) {
  const h = String(host || "").toLowerCase().trim();
  if (!h) return null;
  for (const dc of ZOHO_DCS) {
    if (h === `imap.${dc.suffix}` || h === `imappro.${dc.suffix}` || h === `smtp.${dc.suffix}` || h === `smtppro.${dc.suffix}`) return dc;
    if (dc.mx.test(h)) return dc;
  }
  return null;
}

export function isZohoPersonalDomain(domain) { return !!zohoFromDomain(domain); }

export function zohoImapHost(dc, organisation) {
  if (!dc) return "";
  return (organisation ? "imappro." : "imap.") + dc.suffix;
}

function dcById(id) { return ZOHO_DCS.find((d) => d.id === id) || null; }

function dcOrder(preferredId) {
  const ids = unique([preferredId, ...((preferredId && DC_AFTER[preferredId]) || ["uk", "eu", "us", "in", "au", "jp", "ca", "sa"])]);
  return ids.map(dcById).filter(Boolean);
}

function gmxHosts({ host, domain, detectedHost }) {
  const preferNet = /gmx\.(net|de|at|ch)$/i.test(domain) || /gmx\.net$/i.test(host || "") || /gmx\.net$/i.test(detectedHost || "");
  const a = preferNet ? "imap.gmx.net" : "imap.gmx.com";
  const b = a === "imap.gmx.net" ? "imap.gmx.com" : "imap.gmx.net";
  return unique([host, detectedHost, a, b]);
}

/**
 * Hosts to try, in order, for an IMAP connect.
 * Zoho custom-domain / organisation accounts use imappro.zoho.<dc>; personal accounts use imap.zoho.<dc>.
 * When the data centre is known from MX or the address, that pair is tried first, then other data centres
 * (custom domains only — a @zoho.eu address stays on the EU servers).
 */
export function candidateImapHosts({ host, address, detected } = {}) {
  host = String(host || "").toLowerCase().trim();
  const domain = String(address || "").split("@")[1]?.toLowerCase().trim() || "";
  const detectedHost = (detected && detected.host) || "";
  const detectedDc = (detected && detected.dc && dcById(detected.dc)) || zohoFromHost(detectedHost) || (detected && detected.kind === "zoho" ? zohoFromDomain(domain) : null);
  const zoho = detectedDc || (detected && detected.kind === "zoho" && {}) || zohoFromHost(host) || zohoFromHost(detectedHost) || zohoFromDomain(domain);

  if (zoho) {
    const personal = isZohoPersonalDomain(domain);
    const preferPro = !personal;
    const preferred = detectedDc || zohoFromDomain(domain) || zohoFromHost(host) || zohoFromHost(detectedHost);
    const dcs = personal && preferred ? [preferred] : dcOrder(preferred && preferred.id);
    const out = [];
    for (const dc of dcs) {
      out.push(preferPro ? `imappro.${dc.suffix}` : `imap.${dc.suffix}`);
      out.push(preferPro ? `imap.${dc.suffix}` : `imappro.${dc.suffix}`);
    }
    // Keep a typed non-Zoho host in the list, but don't let a default like imap.zoho.com
    // jump ahead of a data centre we already learned from MX.
    if (host && !out.includes(host) && !zohoFromHost(host)) out.unshift(host);
    else if (host && !out.includes(host)) out.push(host);
    return unique(out);
  }

  if (/^gmx\./i.test(domain) || /gmx\.(com|net)$/i.test(host) || /gmx\.(com|net)$/i.test(detectedHost) || (detected && detected.kind === "gmx")) {
    return gmxHosts({ host, domain, detectedHost });
  }

  return host ? [host] : (detectedHost ? [detectedHost] : []);
}

export function zohoLoginError({ address, detected, host } = {}) {
  const domain = String(address || "").split("@")[1] || "";
  const dc = (detected && detected.dc && dcById(detected.dc)) || zohoFromHost((detected && detected.host) || host) || zohoFromDomain(domain);
  const url = (dc && dc.accounts) || "https://accounts.zoho.eu/home#security/app_password";
  return new HttpError(
    401,
    "The mail server didn’t accept those details. Check that IMAP Access is switched on in Zoho Mail (Settings, then Mail Accounts, then IMAP Access) and that you’re using an app password from " + url + ". If your account is in a different data centre, use that region’s Accounts page (for example accounts.zoho.eu or accounts.zoho.com).",
    "login"
  );
}

export function genericLoginError() {
  return new HttpError(401, "The mail server didn’t accept those details. Check the address and app password, and that IMAP is switched on for the account.", "login");
}

export function loginErrorFor(opts = {}) {
  const domain = String(opts.address || "").split("@")[1] || "";
  if ((opts.detected && opts.detected.kind === "zoho") || zohoFromHost(opts.host) || zohoFromHost(opts.detected && opts.detected.host) || zohoFromDomain(domain)) {
    return zohoLoginError(opts);
  }
  return genericLoginError();
}

export function isRetryableImapError(e) {
  if (!e) return false;
  if (e.code === "login" || e.code === "unreachable") return true;
  const s = e.status;
  return s === 401 || s === 502 || s === 504;
}
