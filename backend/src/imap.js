// A small, read-mostly IMAP client that runs on Cloudflare Workers using TCP sockets (cloudflare:sockets),
// or anywhere else through the same tiny socket interface: { read(): Promise<Uint8Array|null>, write(u8), close() }.
// It never sends mail (there is no SMTP here): it reads recent messages (EXAMINE = read-only, nothing is marked
// as read) and can APPEND a reply draft into the Drafts folder for the person to review and send themselves.
import { HttpError, orgFromDomain, wall } from "./util.js";

const te = new TextEncoder();
const td = new TextDecoder("utf-8");
const td1 = new TextDecoder("latin1");

export async function connectTls(host, port = 993) {
  const { connect } = await import("cloudflare:sockets");
  let s;
  try {
    s = connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
    await s.opened;
  } catch (e) {
    throw new HttpError(502, "We couldn’t open a secure connection to " + host + ". Check the server name (it must support SSL on port 993).", "unreachable");
  }
  const reader = s.readable.getReader();
  const writer = s.writable.getWriter();
  return {
    read: async () => { try { const { value, done } = await reader.read(); return done ? null : value; } catch (e) { throw new HttpError(502, "The connection to the mail server dropped.", "unreachable"); } },
    write: (u8) => writer.write(u8).catch(() => { throw new HttpError(502, "The connection to the mail server dropped.", "unreachable"); }),
    close: () => { try { s.close(); } catch (e) { /* ignore */ } },
  };
}

function concat(a, b) { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
function quote(s) {
  if (/[\r\n\0]/.test(s)) throw new HttpError(400, "That contains characters we can’t use.");
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export class ImapClient {
  constructor(sock, { timeoutMs = 20000 } = {}) { this.sock = sock; this.buf = new Uint8Array(0); this.n = 0; this.timeoutMs = timeoutMs; }

  async fill() {
    let timer;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new HttpError(504, "The mail server didn’t answer in time.")), this.timeoutMs); });
    try {
      const v = await Promise.race([this.sock.read(), timeout]);
      if (v == null) throw new HttpError(502, "The mail server closed the connection.");
      this.buf = concat(this.buf, v);
    } finally { clearTimeout(timer); }
  }
  async readLine() {
    for (;;) {
      for (let i = 0; i + 1 < this.buf.length; i++) {
        if (this.buf[i] === 13 && this.buf[i + 1] === 10) {
          const line = td.decode(this.buf.subarray(0, i));
          this.buf = this.buf.subarray(i + 2);
          return line;
        }
      }
      await this.fill();
    }
  }
  async readBytes(n) {
    while (this.buf.length < n) await this.fill();
    const out = this.buf.slice(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }
  async write(str) { await this.sock.write(typeof str === "string" ? te.encode(str) : str); }

  /** Read until the tagged status line. Returns { status, text, untagged: [{ parts: [string|Uint8Array...] }] }. */
  async readResponse(tag, onContinuation) {
    const untagged = [];
    for (;;) {
      let line = await this.readLine();
      if (line.startsWith(tag + " ")) {
        const m = line.slice(tag.length + 1).match(/^(OK|NO|BAD)\s*(.*)$/i);
        return { status: m ? m[1].toUpperCase() : "BAD", text: m ? m[2] : line, untagged };
      }
      if (line.startsWith("+")) { if (onContinuation) await onContinuation(line); continue; }
      const entry = { parts: [] };
      for (;;) {
        const lit = line.match(/\{(\d+)\}$/);
        if (!lit) { entry.parts.push(line); break; }
        entry.parts.push(line);
        entry.parts.push(await this.readBytes(parseInt(lit[1], 10)));
        line = await this.readLine();
      }
      untagged.push(entry);
    }
  }
  async command(line, onContinuation) {
    const tag = "A" + String(++this.n).padStart(3, "0");
    await this.write(`${tag} ${line}\r\n`);
    return this.readResponse(tag, onContinuation);
  }
  async greeting() {
    const g = await this.readLine();
    if (!/^\* (OK|PREAUTH)/i.test(g)) throw new HttpError(502, "That doesn’t look like an IMAP server.");
    return g;
  }
  async login(user, pass) {
    // SASL PLAIN handles any characters in the password; fall back to LOGIN for servers that lack it.
    const plain = btoa(String.fromCharCode(...te.encode(`\0${user}\0${pass}`)));
    const refused = new HttpError(401, "The mail server didn’t accept those details. Check the address and app password, and that IMAP is switched on for the account.", "login");
    let r;
    try {
      r = await this.command("AUTHENTICATE PLAIN", async () => { await this.write(plain + "\r\n"); });
      // A NO that says the details are wrong ends here (some servers hang up after it). Any other refusal means PLAIN
      // isn't supported, so try the older LOGIN command.
      if (r.status !== "OK" && !/AUTHENTICATIONFAILED|AUTHORIZATIONFAILED|invalid credentials|ALERT|application-specific/i.test(r.text)) r = await this.command(`LOGIN ${quote(user)} ${quote(pass)}`);
    } catch (e) {
      // Real servers (Gmail in particular) often hang up right after refusing a login on a real account.
      if (e instanceof HttpError && (e.code === "unreachable" || /closed the connection|dropped/.test(e.message))) throw refused;
      throw e;
    }
    if (r.status !== "OK") throw refused;
  }
  async logout() { try { await this.write("A999 LOGOUT\r\n"); } catch (e) { /* ignore */ } try { this.sock.close(); } catch (e) { /* ignore */ } }
}

// ---------------------------------------------------------------- parsing helpers
export function decodeWords(s) {
  return String(s || "").replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (m, cs, enc, txt) => {
    try {
      let bytes;
      if (enc.toUpperCase() === "B") { const b = atob(txt); bytes = Uint8Array.from(b, (c) => c.charCodeAt(0)); }
      else {
        const t = txt.replace(/_/g, " ");
        const arr = [];
        for (let i = 0; i < t.length; i++) { if (t[i] === "=" && /^[0-9a-f]{2}$/i.test(t.substr(i + 1, 2))) { arr.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; } else arr.push(t.charCodeAt(i)); }
        bytes = Uint8Array.from(arr);
      }
      return new TextDecoder(cs.toLowerCase() === "iso-8859-1" ? "latin1" : cs).decode(bytes);
    } catch (e) { return m; }
  }).replace(/\?=\s+=\?/g, "");
}
export function parseHeaders(raw) {
  const unfolded = String(raw).replace(/\r?\n[ \t]+/g, " ");
  const h = {};
  unfolded.split(/\r?\n/).forEach((l) => {
    const i = l.indexOf(":");
    if (i > 0) { const k = l.slice(0, i).toLowerCase(); if (h[k] === undefined) h[k] = decodeWords(l.slice(i + 1).trim()); }
  });
  return h;
}
export function parseAddress(raw) {
  raw = String(raw || "");
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const addr = (m ? m[2] : raw).trim().replace(/^<|>$/g, "");
  const name = m ? m[1].trim() : "";
  const domain = addr.includes("@") ? addr.split("@")[1] : "";
  return { name: name || addr.split("@")[0] || "Someone", address: addr, domain };
}
function decodeBody(bytesStr, cte, charset) {
  cte = (cte || "").toLowerCase();
  let bytes;
  if (cte === "base64") {
    const clean = bytesStr.replace(/[^A-Za-z0-9+/]/g, ""); const t = clean.slice(0, clean.length - (clean.length % 4));
    try { bytes = Uint8Array.from(atob(t), (c) => c.charCodeAt(0)); } catch (e) { return ""; }
  } else if (cte === "quoted-printable") {
    const t = bytesStr.replace(/=\r?\n/g, ""); const arr = [];
    for (let i = 0; i < t.length; i++) { if (t[i] === "=" && /^[0-9a-f]{2}$/i.test(t.substr(i + 1, 2))) { arr.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; } else arr.push(t.charCodeAt(i) & 255); }
    bytes = Uint8Array.from(arr);
  } else bytes = Uint8Array.from(bytesStr, (c) => c.charCodeAt(0) & 255);
  try { return new TextDecoder(/utf-?8/i.test(charset || "utf-8") ? "utf-8" : /1252|8859/i.test(charset) ? "latin1" : "utf-8").decode(bytes); } catch (e) { return ""; }
}
const stripHtml = (s) => s.replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

/** Plain-text snippet from the start of a message body (handles simple multipart, base64, quoted-printable). */
export function snippetFromBody(headers, bodyBytes) {
  const raw = td1.decode(bodyBytes);
  const ct = headers["content-type"] || "text/plain";
  const boundary = (ct.match(/boundary="?([^";]+)"?/i) || [])[1];
  let text = "";
  if (/multipart\//i.test(ct) && boundary) {
    const parts = raw.split("--" + boundary);
    let plain = null, html = null;
    for (const p of parts) {
      const i = p.search(/\r?\n\r?\n/);
      if (i < 0) continue;
      const ph = parseHeaders(p.slice(0, i));
      const pct = ph["content-type"] || "text/plain";
      const body = p.slice(i).replace(/^\r?\n\r?\n/, "");
      if (/text\/plain/i.test(pct) && plain == null) plain = decodeBody(body, ph["content-transfer-encoding"], (pct.match(/charset="?([^";]+)/i) || [])[1]);
      else if (/text\/html/i.test(pct) && html == null) html = stripHtml(decodeBody(body, ph["content-transfer-encoding"], (pct.match(/charset="?([^";]+)/i) || [])[1]));
      else if (/multipart\//i.test(pct) && plain == null) { /* nested: take what we can from the text above */ }
    }
    text = plain != null ? plain : html != null ? html : "";
  } else {
    const body = decodeBody(raw, headers["content-transfer-encoding"], (ct.match(/charset="?([^";]+)/i) || [])[1]);
    text = /text\/html/i.test(ct) ? stripHtml(body) : body;
  }
  text = text.split(/\r?\n/).filter((l) => !/^\s*>/.test(l)).join(" ").replace(/\s+/g, " ").trim();
  return text.length > 240 ? text.slice(0, 237) + "…" : text;
}

const AUTO = /(^|[^a-z])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|notifications?|newsletter|updates?|alerts?|billing|receipts?|bounce)([^a-z]|$)/i;

export function mapMessage(entry, selfAddress, tz) {
  // parts: [ "* 5 FETCH (UID 1 FLAGS (...) INTERNALDATE "..." BODY[HEADER.FIELDS (...)] {N}", <headers bytes>, " BODY[TEXT]<0> {M}", <body bytes>, ")" ]
  const first = entry.parts[0];
  if (typeof first !== "string" || !/FETCH/i.test(first)) return null;
  const uid = (first.match(/UID (\d+)/i) || [])[1];
  const flags = ((first.match(/FLAGS \(([^)]*)\)/i) || [])[1] || "");
  const dateStr = (first.match(/INTERNALDATE "([^"]+)"/i) || [])[1];
  const lits = entry.parts.filter((p) => typeof p !== "string");
  const headers = parseHeaders(td1.decode(lits[0] || new Uint8Array()));
  const body = lits[1] || new Uint8Array();
  const from = parseAddress(headers.from);
  const t = Date.parse(dateStr || headers.date || "") || Date.now();
  const w = wall(t, tz);
  const prec = (headers.precedence || "").toLowerCase();
  const auto = !!headers["list-unsubscribe"] || /bulk|list|junk/.test(prec) || (headers["auto-submitted"] && !/^no$/i.test(headers["auto-submitted"])) || AUTO.test(from.address) || AUTO.test(from.name);
  const mine = selfAddress && from.address.toLowerCase() === selfAddress.toLowerCase();
  return {
    uid, t, auto: !!auto, mine: !!mine, answered: /\\Answered/i.test(flags),
    email: {
      id: "i:" + uid, from: from.name, org: orgFromDomain(from.domain) || from.domain, subject: (headers.subject || "(no subject)").trim(),
      snippet: snippetFromBody(headers, body), when: w.date + " " + w.time, when_iso: new Date(t).toISOString(), live: true,
      meta: { provider: "imap", messageId: uid, address: parseAddress(headers["reply-to"] || headers.from).address, subject: (headers.subject || "").trim(), rfcId: headers["message-id"], refs: headers.references },
    },
  };
}

function imapDate(d) { const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${d.getUTCDate()}-${M[d.getUTCMonth()]}-${d.getUTCFullYear()}`; }

/** Fetch recent messages that look like they need a reply. */
export async function listNeedingReply(client, { selfAddress, days = 14, tz = "Europe/London", limit = 10 } = {}) {
  let r = await client.command('EXAMINE "INBOX"');
  if (r.status !== "OK") throw new HttpError(502, "We couldn’t open the inbox.");
  const since = imapDate(new Date(Date.now() - days * 86400000));
  r = await client.command(`UID SEARCH SINCE ${since}`);
  if (r.status !== "OK") throw new HttpError(502, "We couldn’t search the inbox.");
  const line = r.untagged.map((e) => e.parts[0]).find((p) => typeof p === "string" && /^\* SEARCH/i.test(p)) || "* SEARCH";
  const uids = line.replace(/^\* SEARCH\s*/i, "").split(/\s+/).filter(Boolean).map(Number).filter((n) => n > 0).sort((a, b) => a - b).slice(-40);
  if (!uids.length) return { emails: [], other: 0 };
  r = await client.command(`UID FETCH ${uids.join(",")} (UID FLAGS INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM REPLY-TO SUBJECT DATE MESSAGE-ID REFERENCES LIST-UNSUBSCRIBE AUTO-SUBMITTED PRECEDENCE CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.2500>)`);
  if (r.status !== "OK") throw new HttpError(502, "We couldn’t read the messages.");
  const msgs = r.untagged.map((e) => mapMessage(e, selfAddress, tz)).filter(Boolean).sort((a, b) => b.t - a.t);
  const keep = msgs.filter((m) => !m.auto && !m.mine && !m.answered).slice(0, limit);
  return { emails: keep.map((m) => m.email), other: Math.max(0, msgs.length - keep.length) };
}

// ---------------------------------------------------------------- drafts (APPEND to the Drafts folder; nothing is sent)
function encHeader(s) { return /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + btoa(String.fromCharCode(...te.encode(s))) + "?="; }
function wrap76(s) { return s.replace(/(.{76})/g, "$1\r\n"); }
export function buildDraft({ from, to, subject, body, inReplyTo, references }) {
  if (/[\r\n]/.test(from + to + subject + (inReplyTo || "") + (references || ""))) throw new HttpError(400, "That contains characters we can’t use in a header.");
  const subj = /^re:/i.test(subject) ? subject : "Re: " + subject;
  const lines = [`From: ${from}`, `To: ${to}`, `Subject: ${encHeader(subj)}`, `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`];
  if (inReplyTo) { lines.push(`In-Reply-To: ${inReplyTo}`); lines.push(`References: ${((references || "") + " " + inReplyTo).trim()}`); }
  lines.push("MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "X-Mailer: AO Intelligence draft", "", wrap76(btoa(String.fromCharCode(...te.encode(body)))));
  return lines.join("\r\n") + "\r\n";
}
export async function findDraftsFolder(client) {
  const r = await client.command('LIST "" "*"');
  const rows = r.untagged.map((e) => e.parts[0]).filter((p) => typeof p === "string" && /^\* LIST/i.test(p));
  const special = rows.find((l) => /\\Drafts/i.test(l));
  const nameOf = (l) => { const m = l.match(/"((?:[^"\\]|\\.)*)"\s*$/) || l.match(/\s(\S+)\s*$/); return m ? m[1].replace(/\\(.)/g, "$1") : null; };
  if (special) return nameOf(special);
  const names = rows.map(nameOf).filter(Boolean);
  return names.find((n) => /^(INBOX\.)?drafts?$/i.test(n) || /\/drafts?$/i.test(n)) || "Drafts";
}
export async function appendDraft(client, folder, message) {
  const bytes = te.encode(message);
  const r = await client.command(`APPEND ${quote(folder)} (\\Draft \\Seen) {${bytes.length}}`, async () => { await client.write(bytes); await client.write("\r\n"); });
  if (r.status !== "OK") throw new HttpError(502, "The mail server wouldn’t save the draft (" + r.text + ").");
}

export const KNOWN_HOSTS = { "gmail.com": "imap.gmail.com", "googlemail.com": "imap.gmail.com", "icloud.com": "imap.mail.me.com", "me.com": "imap.mail.me.com", "yahoo.com": "imap.mail.yahoo.com", "yahoo.co.uk": "imap.mail.yahoo.com", "aol.com": "imap.aol.com", "zoho.com": "imap.zoho.com" };
