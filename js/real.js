/* AO Intelligence — the pieces that make the app real without any provider approval:
 *  - a bank-statement reader (CSV / OFX) that runs entirely in the browser and keeps the result on this device,
 *  - a calendar-file (.ics) reader, also in the browser,
 *  - short, exact "how do I get this" guides for every email and calendar provider.
 * Nothing here talks to a server. */
(function (root) {
  "use strict";
  var BANK_KEY = "ao-local-bank-v1";
  var CAL_KEY = "ao-local-calendar-v1";

  // ------------------------------------------------------------------ small helpers
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function validDate(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  /** Understands the date shapes UK banks use. Returns {date:"YYYY-MM-DD", time:"HH:MM"} or null. Day comes before month. */
  function parseDate(raw) {
    var s = String(raw == null ? "" : raw).trim().replace(/^"|"$/g, "");
    if (!s) return null;
    var m, time = "00:00";
    var tm = s.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(am|pm)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/i);
    if (tm) { var hh = +tm[1]; if (tm[3]) { hh = hh % 12 + (/pm/i.test(tm[3]) ? 12 : 0); } time = pad(hh) + ":" + tm[2]; }
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)) && validDate(+m[1], +m[2], +m[3])) return { date: iso(+m[1], +m[2], +m[3]), time: time };
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{0,6})/)) && validDate(+m[1], +m[2], +m[3])) { var t6 = m[4]; return { date: iso(+m[1], +m[2], +m[3]), time: t6.length >= 4 ? t6.slice(0, 2) + ":" + t6.slice(2, 4) : time }; }
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
      var d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000;
      if (validDate(y, mo, d)) return { date: iso(y, mo, d), time: time };
    }
    if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-,]*(\d{2,4})/))) {
      var mon = MONTHS[m[2].slice(0, 3).toLowerCase()]; var yy = +m[3]; if (yy < 100) yy += 2000;
      if (mon && validDate(yy, mon, +m[1])) return { date: iso(yy, mon, +m[1]), time: time };
    }
    return null;
  }
  /** "£1,234.50", "(12.00)", "-12.00", "12.00 DR", "1.234,50" → number, or null. */
  function parseAmount(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    var neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /\bDR\b|debit/i.test(s);
    s = s.replace(/[£$€\s]|GBP|\bCR\b|\bDR\b|credit|debit/gi, "").replace(/[()+-]/g, "");
    if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    if (!/^\d*\.?\d+$/.test(s)) return null;
    var n = parseFloat(s);
    return neg ? -n : n;
  }

  // ------------------------------------------------------------------ CSV
  function splitCsv(text, delim) {
    var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }
  function detectDelim(text) {
    var head = text.split(/\r?\n/).slice(0, 12).join("\n");
    var best = ",", bestN = -1;
    [",", ";", "\t"].forEach(function (d) { var n = head.split(d).length; if (n > bestN) { bestN = n; best = d; } });
    return best;
  }
  var H = {
    date: /^(date|transaction date|posting date|posted( date)?|booking date|completed date|started date|value date|trans date|effective date)$/i,
    time: /^time$/i,
    desc: /^(description|transaction description|details|transaction details|narrative|memo|payee|name|counter ?party|merchant|reference|transaction)$/i,
    amount: /^(amount|value|amount \(gbp\)|amount gbp|net|local amount|transaction amount)$/i,
    debit: /^(debit|debit amount|paid out|money out|withdrawals?|out|amount out|payments? out)$/i,
    credit: /^(credit|credit amount|paid in|money in|deposits?|in|amount in|payments? in)$/i,
    category: /^(category|spending category|subcategory|sub-category)$/i,
    type: /^(type|transaction type)$/i,
    state: /^(state|status)$/i,
    id: /^(transaction id|id|number)$/i,
  };
  function norm(s) { return String(s || "").replace(/^\uFEFF/, "").trim(); }
  function findCol(headers, re, skip) { for (var i = 0; i < headers.length; i++) { if ((!skip || skip.indexOf(i) === -1) && re.test(headers[i])) return i; } return -1; }

  var OUT_RULES = [
    [/tesco|sainsbury|asda|lidl|aldi|morrison|waitrose|co-?op|greggs|costa|starbucks|mcdonald|pret|deliveroo|just eat|uber eats|restaurant|cafe|pub\b|bakery/i, "Food & drink"],
    [/shell|\bbp\b|esso|texaco|petrol|fuel|ev ?charg|tfl|trainline|uber|bolt\b|parking|dvla|ryanair|easyjet|national rail|hotel|airbnb|booking\.com/i, "Travel & fuel"],
    [/netflix|spotify|apple\.com|google|microsoft|adobe|subscription|openai|dropbox|zoom|canva|github|notion/i, "Subscriptions & software"],
    [/hmrc|council|insurance|octopus|british gas|edf|e\.on|water|rent\b|mortgage|vodafone|\bee\b|\bo2\b|three\b|\bbt\b|sky\b|virgin media|broadband|loan|finance/i, "Bills & finance"],
    [/amazon|ebay|argos|currys|screwfix|wickes|b&q|halfords|etsy/i, "Shopping & supplies"],
    [/transfer|sent to|standing order|\bfp\b.*to|payment to/i, "Transfers out"],
  ];
  var IN_RULES = [
    [/stripe|shopify|paypal|sumup|square|zettle|worldpay|takepayments|izettle|gocardless/i, "Card & online sales"],
    [/transfer|from .*(savings|pot|account)|standing order|\bfp\b/i, "Transfers in"],
    [/hmrc|refund|cashback|interest/i, "Refunds & interest"],
  ];
  function guessCategory(desc, dir) {
    var rules = dir === "in" ? IN_RULES : OUT_RULES;
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(desc)) return rules[i][1];
    return dir === "in" ? "Payments in" : "Other spending";
  }
  function finish(rows, format, warnings) {
    // stable ids, tolerant of identical lines on the same day
    var seen = {};
    rows.forEach(function (r) { var k = r.date + "|" + r.desc + "|" + r.amount + "|" + r.direction; seen[k] = (seen[k] || 0) + 1; r.id = "s" + hash(k + "|" + seen[k]); });
    rows.sort(function (a, b) { return a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0; });
    var inT = 0, outT = 0; rows.forEach(function (r) { if (r.direction === "in") inT += r.amount; else outT += r.amount; });
    return { rows: rows, format: format, from: rows.length ? rows[0].date : "", to: rows.length ? rows[rows.length - 1].date : "", inTotal: Math.round(inT * 100) / 100, outTotal: Math.round(outT * 100) / 100, warnings: warnings || [] };
  }
  function parseCsv(text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var all = splitCsv(text, detectDelim(text));
    var headerAt = -1, cols = null;
    for (var i = 0; i < Math.min(all.length, 25); i++) {
      var hs = all[i].map(norm);
      var d = findCol(hs, H.date);
      if (d === -1) continue;
      var a = findCol(hs, H.amount), db = findCol(hs, H.debit), cr = findCol(hs, H.credit);
      if (a === -1 && db === -1 && cr === -1) continue;
      var used = [d];
      var ds = findCol(hs, H.desc, used);
      // prefer "description"-like columns over bare "name"/"type" when both exist
      var pref = findCol(hs, /^(description|transaction description|details|narrative)$/i, used);
      cols = { date: d, time: findCol(hs, H.time), desc: pref !== -1 ? pref : ds, name: findCol(hs, /^(name|counter ?party|merchant|payee)$/i), amount: a, debit: db, credit: cr, category: findCol(hs, H.category), type: findCol(hs, H.type), state: findCol(hs, H.state) };
      headerAt = i; break;
    }
    if (!cols) throw new Error("I couldn’t find the date and amount columns in that file. Please export a CSV statement from your bank (it needs a date column and either an amount or paid in / paid out columns).");
    var rows = [], skipped = 0;
    for (var r = headerAt + 1; r < all.length; r++) {
      var line = all[r];
      if (line.length < 2) continue;
      var dt = parseDate(line[cols.date]);
      if (!dt) { skipped++; continue; }
      if (cols.state !== -1 && /reverted|declined|failed|pending|cancel/i.test(line[cols.state] || "")) continue;
      var amt = null;
      if (cols.amount !== -1) amt = parseAmount(line[cols.amount]);
      if (amt == null && (cols.debit !== -1 || cols.credit !== -1)) {
        var dv = cols.debit !== -1 ? parseAmount(line[cols.debit]) : null, cv = cols.credit !== -1 ? parseAmount(line[cols.credit]) : null;
        if (cv != null && Math.abs(cv) > 0) amt = Math.abs(cv);
        else if (dv != null && Math.abs(dv) > 0) amt = -Math.abs(dv);
        else if (dv != null || cv != null) amt = 0;
      }
      if (amt == null) { skipped++; continue; }
      if (amt === 0) continue;
      var nameTxt = cols.name !== -1 ? norm(line[cols.name]) : "";
      var descTxt = cols.desc !== -1 ? norm(line[cols.desc]) : "";
      var desc = descTxt && nameTxt && descTxt.toLowerCase().indexOf(nameTxt.toLowerCase()) === -1 ? nameTxt + " — " + descTxt : (descTxt || nameTxt || (cols.type !== -1 ? norm(line[cols.type]) : "") || "Transaction");
      desc = desc.replace(/\s+/g, " ").slice(0, 120);
      var dir = amt > 0 ? "in" : "out";
      var cat = cols.category !== -1 ? norm(line[cols.category]) : "";
      var time = cols.time !== -1 ? (parseDate("2000-01-01 " + norm(line[cols.time])) || {}).time || dt.time : dt.time;
      rows.push({ date: dt.date, time: time || "00:00", desc: desc, amount: Math.round(Math.abs(amt) * 100) / 100, direction: dir, category: cat ? cat.replace(/^./, function (c) { return c.toUpperCase(); }) : guessCategory(desc, dir) });
    }
    if (!rows.length) throw new Error("That file had no transactions I could read. Check it’s a statement export with dates and amounts.");
    return finish(rows, "CSV", skipped ? [skipped + " line" + (skipped === 1 ? "" : "s") + " were skipped (not transactions)."] : []);
  }

  // ------------------------------------------------------------------ OFX / QFX
  function parseOfx(text) {
    var rows = [];
    var blocks = String(text).split(/<STMTTRN>/i).slice(1);
    blocks.forEach(function (b) {
      b = b.split(/<\/STMTTRN>/i)[0];
      var tag = function (n) { var m = b.match(new RegExp("<" + n + ">([^<\\r\\n]*)", "i")); return m ? m[1].trim() : ""; };
      var dt = parseDate(tag("DTPOSTED")); var amt = parseAmount(tag("TRNAMT"));
      if (!dt || amt == null || amt === 0) return;
      var desc = (tag("NAME") + (tag("MEMO") && tag("MEMO") !== tag("NAME") ? " — " + tag("MEMO") : "")).replace(/^ — /, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").slice(0, 120) || "Transaction";
      var dir = amt > 0 ? "in" : "out";
      rows.push({ date: dt.date, time: dt.time, desc: desc, amount: Math.round(Math.abs(amt) * 100) / 100, direction: dir, category: guessCategory(desc, dir) });
    });
    if (!rows.length) throw new Error("That OFX file had no transactions I could read.");
    return finish(rows, "OFX", []);
  }

  function parseStatement(text, filename) {
    var t = String(text || "");
    if (/<OFX>|<STMTTRN>|OFXHEADER/i.test(t)) return parseOfx(t);
    if (/^\s*!Type:/im.test(t)) throw new Error("That looks like a QIF file. Please export CSV or OFX instead — most banks offer one of them.");
    return parseCsv(t);
  }

  // ------------------------------------------------------------------ local storage (stays on this device)
  function readJson(key) { try { return JSON.parse(root.localStorage.getItem(key) || "null"); } catch (e) { return null; } }
  function writeJson(key, v) { try { root.localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function addDays(isoDate, n) { var p = isoDate.split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }

  /** Replace everything in the new file's date range, keep the rest — so uploading a fresh export each week just works. */
  function mergeBank(existing, incoming) {
    if (!incoming.rows.length) return existing || [];
    var from = incoming.from, to = incoming.to;
    var keep = (existing || []).filter(function (r) { return r.date < from || r.date > to; });
    return keep.concat(incoming.rows).sort(function (a, b) { return a.date + a.time < b.date + b.time ? -1 : 1; });
  }
  function saveBank(parsed, meta) {
    var cur = readJson(BANK_KEY) || { rows: [] };
    var rows = mergeBank(cur.rows, parsed);
    var cutoff = addDays(rows.length ? rows[rows.length - 1].date : "2000-01-01", -400);
    rows = rows.filter(function (r) { return r.date >= cutoff; });
    var ok = writeJson(BANK_KEY, { rows: rows, updated: new Date().toISOString(), file: (meta && meta.file) || "", bank: (meta && meta.bank) || "", count: rows.length });
    if (!ok) throw new Error("This browser wouldn’t let us save that much data on this device. Try a shorter date range.");
    return { count: rows.length, added: parsed.rows.length };
  }
  function localBank() { var b = readJson(BANK_KEY); return b ? b : null; }
  function clearBank() { try { root.localStorage.removeItem(BANK_KEY); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------ calendar file (.ics) kept on this device
  function eventsFromIcs(text, tz) {
    if (!root.AOIcs) throw new Error("The calendar reader didn’t load. Please reload the page.");
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That doesn’t look like a calendar (.ics) file.");
    var zone = tz || (root.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/London";
    var w = root.AOIcs.windowFor(0, zone);
    return root.AOIcs.parseIcs(text, { from: addDays(w.from, -7), to: addDays(w.from, 120), tz: zone });
  }
  function saveCalendarFile(text, tz, name) {
    var ev = eventsFromIcs(text, tz);
    var ok = writeJson(CAL_KEY, { events: ev, updated: new Date().toISOString(), file: name || "" });
    if (!ok) throw new Error("This browser wouldn’t let us save that calendar on this device.");
    return ev.length;
  }
  function localCalendar() { return readJson(CAL_KEY); }
  function clearCalendar() { try { root.localStorage.removeItem(CAL_KEY); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------ guides
  // Email and calendar connect by provider sign-in only (Google or Microsoft). Other providers are "coming soon":
  // people can tell us they need one, and the request is kept on this device.
  var MAIL = [
    { id: "gmail", name: "Gmail (Google)", oauth: "google" },
    { id: "outlook", name: "Outlook, Hotmail or Microsoft 365", oauth: "microsoft" },
    { id: "icloud-mail", name: "iCloud Mail", soon: true },
    { id: "yahoo", name: "Yahoo Mail", soon: true },
    { id: "aol", name: "AOL Mail", soon: true },
    { id: "zoho-mail", name: "Zoho Mail", soon: true },
    { id: "fastmail", name: "Fastmail", soon: true },
    { id: "other-mail", name: "Another email provider", soon: true, other: true },
  ];
  var CAL = [
    { id: "google-calendar", name: "Google Calendar", oauth: "google" },
    { id: "outlook-calendar", name: "Outlook or Microsoft 365 calendar", oauth: "microsoft" },
    { id: "icloud-calendar", name: "iCloud Calendar", soon: true },
    { id: "zoho-calendar", name: "Zoho Calendar", soon: true },
    { id: "other-calendar", name: "Another calendar", soon: true, other: true },
  ];
  var REQ_KEY = "ao-provider-requests-v1";
  function requests() { var r = readJson(REQ_KEY); return Array.isArray(r) ? r : []; }
  function hasRequest(id) { return requests().some(function (x) { return x.id === id; }); }
  /** Remember "I'd use this" on this device. Returns false if the browser wouldn't save it. */
  function saveRequest(kind, id, name, note) {
    var list = requests().filter(function (x) { return x.id !== id; });
    list.push({ kind: kind, id: id, name: name, note: String(note || "").slice(0, 200), at: new Date().toISOString() });
    return writeJson(REQ_KEY, list);
  }
  var BANK_TIPS = {
    "monzo": "Monzo: in the app go to Account → Statements, or sign in at monzo.com and open Statements, then choose Export → CSV.",
    "starling-bank": "Starling: in the app go to Account → Statements, pick the dates and choose CSV.",
    "barclays": "Barclays: online banking → your account → Download transactions → CSV.",
    "lloyds-bank": "Lloyds: online banking → your account → Export → choose dates and “CSV”.",
    "halifax": "Halifax: online banking → your account → Export → choose dates and “CSV”.",
    "bank-of-scotland": "Bank of Scotland: online banking → your account → Export → choose dates and “CSV”.",
    "natwest": "NatWest: online banking → your account → Export or download transactions → CSV.",
    "rbs-royal-bank-of-scotland": "RBS: online banking → your account → Export or download transactions → CSV.",
    "hsbc-uk": "HSBC: online banking → your account → Download → choose “CSV”.",
    "santander-uk": "Santander: online banking → your account → Download → choose CSV or OFX.",
    "nationwide": "Nationwide: Internet Bank → your account → Download transactions → CSV.",
    "revolut": "Revolut: in the app open the account → Statement → choose Excel/CSV and the dates.",
    "tide": "Tide: sign in on the web → Transactions → Export → CSV.",
    "first-direct": "First Direct: online banking → your account → Download transactions → CSV.",
    "tsb": "TSB: online banking → your account → Export → CSV.",
  };

  root.AOReal = {
    parseStatement: parseStatement, parseCsv: parseCsv, parseOfx: parseOfx, parseDate: parseDate, parseAmount: parseAmount,
    mergeBank: mergeBank, saveBank: saveBank, localBank: localBank, clearBank: clearBank,
    saveCalendarFile: saveCalendarFile, localCalendar: localCalendar, clearCalendar: clearCalendar, eventsFromIcs: eventsFromIcs,
    MAIL: MAIL, CAL: CAL, requests: requests, hasRequest: hasRequest, saveRequest: saveRequest, REQ_KEY: REQ_KEY, BANK_TIPS: BANK_TIPS, guessCategory: guessCategory, BANK_KEY: BANK_KEY, CAL_KEY: CAL_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
