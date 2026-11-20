/* AO Intelligence — the pieces that make the app real without any provider approval:
 *  - a bank-statement reader (CSV / OFX) that runs entirely in the browser and keeps the result on this device,
 *  - a calendar-file (.ics) reader, also in the browser,
 *  - short, exact "how do I get this" guides for every email and calendar provider.
 * Nothing here talks to a server. */
(function (root) {
  "use strict";
  var LEGACY_BANK = "ao-local-bank-v1";
  var LEGACY_CAL = "ao-local-calendar-v1";
  function bankKey() {
    try { var S = root.AOStore; if (S && S.currentId && S.currentId() && S.bankKey) return S.bankKey(); } catch (e) {}
    return LEGACY_BANK;
  }
  function calKey() {
    try { var S = root.AOStore; if (S && S.currentId && S.currentId() && S.calKey) return S.calKey(); } catch (e) {}
    return LEGACY_CAL;
  }

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
    var cur = readJson(bankKey()) || { rows: [] };
    var rows = mergeBank(cur.rows, parsed);
    var cutoff = addDays(rows.length ? rows[rows.length - 1].date : "2000-01-01", -400);
    rows = rows.filter(function (r) { return r.date >= cutoff; });
    var ok = writeJson(bankKey(), { rows: rows, updated: new Date().toISOString(), file: (meta && meta.file) || "", bank: (meta && meta.bank) || "", count: rows.length });
    if (!ok) throw new Error("This browser wouldn’t let us save that much data on this device. Try a shorter date range.");
    return { count: rows.length, added: parsed.rows.length };
  }
  function localBank() { var b = readJson(bankKey()); return b ? b : null; }
  function clearBank() { try { root.localStorage.removeItem(bankKey()); } catch (e) { /* ignore */ } }

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
    var ok = writeJson(calKey(), { events: ev, updated: new Date().toISOString(), file: name || "" });
    if (!ok) throw new Error("This browser wouldn’t let us save that calendar on this device.");
    return ev.length;
  }
  function localCalendar() { return readJson(calKey()); }
  function clearCalendar() { try { root.localStorage.removeItem(calKey()); } catch (e) { /* ignore */ } }

  // ------------------------------------------------------------------ guides
  // Email and calendar providers. Google and Microsoft use their own sign-in when it's switched on; every other
  // provider connects with an address + app password (or password) through the AO service, with the server pre-filled.
  var APPLE = "https://account.apple.com";
  var MAIL = [
    { id: "gmail", name: "Gmail (Google)", oauth: "google", host: "imap.gmail.com",
      note: "School or work Google accounts may have app passwords switched off by their administrator.",
      pass: { kind: "app", button: "Open Google’s app password page", href: "https://myaccount.google.com/apppasswords",
        why: "Google doesn’t let other apps use your main password. 2-Step Verification must be on first (skip this if it already is).",
        steps: [
          "Turn on 2-Step Verification for your Google account, if it isn’t already on: myaccount.google.com/signinoptions/twosv.",
          "Open Google’s app password page with the button below.",
          "Sign in if Google asks, then create an app password called “AO Intelligence”. Google shows a 16-letter code.",
          "Paste your Gmail address and that code below."
        ] } },
    { id: "outlook", name: "Outlook, Hotmail or Microsoft 365", oauth: "microsoft", host: "outlook.office365.com",
      note: "Microsoft no longer allows passwords or app passwords for Outlook.com and Microsoft 365 mail. Connect your Outlook calendar now with a link. Outlook email connects with Microsoft sign-in once it’s switched on for your account." },
    { id: "icloud-mail", name: "iCloud Mail", host: "imap.mail.me.com",
      pass: { kind: "app", button: "Open Apple’s app password page", href: APPLE,
        why: "Apple doesn’t let other apps use your main Apple Account password.",
        steps: [
          "Open your Apple Account with the button below and sign in.",
          "Go to Sign-In and Security, then App-Specific Passwords.",
          "Press “+”, name it “AO Intelligence”, and copy the password (it looks like abcd-efgh-ijkl-mnop).",
          "Enter your iCloud Mail address (@icloud.com, @me.com or @mac.com) and that password below."
        ] } },
    { id: "yahoo", name: "Yahoo Mail", host: "imap.mail.yahoo.com",
      pass: { kind: "app", button: "Open Yahoo’s app password page", href: "https://login.yahoo.com/myaccount/security",
        why: "Yahoo doesn’t let other apps use your main password.",
        steps: [
          "Open Yahoo Account Security with the button below and sign in.",
          "Choose “Generate app password” (or “Generate and manage app passwords”).",
          "Name it “AO Intelligence” and copy the password it shows.",
          "Paste your Yahoo address and that password below."
        ] } },
    { id: "aol", name: "AOL Mail", host: "imap.aol.com",
      pass: { kind: "app", button: "Open AOL’s app password page", href: "https://login.aol.com/myaccount/security",
        why: "AOL doesn’t let other apps use your main password.",
        steps: [
          "Open AOL Account Security with the button below and sign in.",
          "Choose “Generate app password” (or “Generate and manage app passwords”), then Get Started.",
          "Name it “AO Intelligence” and copy the password it shows.",
          "Paste your AOL address and that password below."
        ] } },
    { id: "zoho-mail", name: "Zoho Mail", host: "imap.zoho.com",
      pass: { kind: "app", button: "Open Zoho’s app password page", href: "https://accounts.zoho.uk/home#security/app_password",
        why: "Zoho doesn’t let other apps use your main password. IMAP also has to be switched on.",
        steps: [
          "In Zoho Mail, go to Settings, then Mail Accounts, then IMAP Access, and switch IMAP on.",
          "Open Zoho’s app password page with the button below. Use the page for your data centre: accounts.zoho.uk for the UK, accounts.zoho.eu for Europe, accounts.zoho.com for the US.",
          "Create an application-specific password called “AO Intelligence” and copy it.",
          "Paste your Zoho address and that password below. We’ll pick the right mail server automatically — including organisation servers such as imappro.zoho.uk — and try other data centres if needed."
        ] } },
    { id: "fastmail", name: "Fastmail", host: "imap.fastmail.com",
      pass: { kind: "app", button: "Open Fastmail’s app password page", href: "https://app.fastmail.com/settings/security/apps",
        why: "Fastmail doesn’t let other apps use your main password.",
        steps: [
          "Open Fastmail with the button below and sign in.",
          "Go to Settings, then Privacy & Security, then Manage app passwords (or press the button, which opens that page).",
          "Create a new app password, give it Mail (IMAP) access, name it “AO Intelligence”, and copy it.",
          "Paste your Fastmail address and that password below."
        ] } },
    { id: "gmx", name: "GMX", host: "imap.gmx.com",
      pass: { kind: "app", button: "Open GMX’s app password page", href: "https://support.gmx.com/security/2fa/application-specific-passwords.html",
        why: "If two-step verification is on, GMX doesn’t let other apps use your main password. IMAP also has to be switched on.",
        steps: [
          "In GMX go to Email → Settings → POP3 & IMAP, tick “Enable access to this account via POP3 and IMAP”, and Save.",
          "If you use two-step verification: open the guide with the button below, then in GMX go to your profile → Security Options → Manage application-specific passwords, and create one called “AO Intelligence”.",
          "If you don’t use two-step verification, your normal GMX password works.",
          "Paste your GMX address and the password below. Addresses ending .de, .at, .ch or .net use the server imap.gmx.net — we’ll fill that in from your address."
        ] } },
    { id: "bt", name: "BT Mail", host: "mail.btinternet.com",
      pass: { kind: "normal", button: "Open BT Mail", href: "https://www.bt.com/mail",
        intro: "BT Mail doesn’t use app passwords. Enter the same password you use to sign in to BT Mail on the web.",
        steps: [
          "Check you can sign in to BT Mail on the web with your full address (for example name@btinternet.com) and your BT Mail password.",
          "Paste that same address and password below. If it’s refused, reset the password with BT and try again."
        ] } },
    { id: "sky", name: "Sky Mail", host: "imap.mail.yahoo.com",
      pass: { kind: "app", button: "Open Sky’s app password page", href: "https://www.sky.com/sky-yahoo-mail/manage-apps",
        why: "Sky Mail is run by Yahoo, which doesn’t let other apps use your main password.",
        steps: [
          "Open Sky’s app password page with the button below and sign in with your Sky ID.",
          "Generate an app password, name it “AO Intelligence”, and copy the 16-character code.",
          "Paste your Sky address (name@sky.com) and that password below."
        ] } },
    { id: "virgin", name: "Virgin Media", host: "imap.virginmedia.com",
      pass: { kind: "normal", button: "Open Virgin Media email help", href: "https://www.virginmedia.com/help/email",
        intro: "Virgin Media doesn’t use app passwords. Enter the same password you use for your Virgin Media email.",
        steps: [
          "Use your full Virgin Media email address and your Virgin Media email password.",
          "Paste them below. If it’s refused, reset the email password in your Virgin Media account and try again."
        ] } },
    { id: "imap", name: "Another provider", host: "", other: true,
      pass: { kind: "either", button: "", href: "",
        steps: [
          "Type your email address and press “Find my settings” — we’ll look up your provider’s mail server.",
          "If your provider offers app passwords, create one called “AO Intelligence” and use it. Otherwise use your normal email password.",
          "If we can’t find the server, type it in (it looks like imap.example.com — your provider’s help page lists it). We use the secure port 993."
        ] } },
  ];
  var CAL = [
    { id: "google-calendar", name: "Google Calendar", oauth: "google", kind: "ics",
      steps: [
        { t: "On a computer, open Google Calendar settings and click the calendar you want under “Settings for my calendars”.", href: "https://calendar.google.com/calendar/u/0/r/settings", link: "Open Calendar settings" },
        { t: "Scroll to “Integrate calendar” and copy “Secret address in iCal format” (a long link ending .ics)." },
        { t: "Paste it below. Keep it private — anyone with the link can see your calendar. You can reset it in the same place." } ],
      note: "The Google Calendar phone app can’t show this link, so use a computer. Some work or school accounts hide it." },
    { id: "outlook-calendar", name: "Outlook or Microsoft 365 calendar", oauth: "microsoft", kind: "ics",
      steps: [
        { t: "Open Outlook calendar settings → Shared calendars → “Publish a calendar”.", href: "https://outlook.live.com/calendar/0/options/calendar/SharedCalendars", link: "Open Outlook.com settings" },
        { t: "Pick your calendar, choose “Can view all details”, and press Publish." },
        { t: "Copy the ICS link (not the HTML one) and paste it below. For a work account use outlook.office.com instead — your administrator may have turned publishing off." } ] },
    { id: "icloud-calendar", name: "iCloud Calendar", kind: "caldav", url: "https://caldav.icloud.com/",
      pass: { kind: "app", button: "Open Apple’s app password page", href: APPLE,
        why: "Apple doesn’t let other apps use your main Apple Account password.",
        extra: "Use the email address of your Apple Account — it can be different from the address you use for iCloud Mail. The same app-specific password can be reused. You can connect this calendar even if your email comes from a different provider.",
        steps: [
          "Open your Apple Account with the button below and sign in.",
          "Go to Sign-In and Security, then App-Specific Passwords.",
          "Press “+”, name it “AO Intelligence”, and copy the password (it looks like abcd-efgh-ijkl-mnop). If you already made one for iCloud Mail, you can reuse it.",
          "Enter your Apple Account email and that password below."
        ] } },
    { id: "yahoo-calendar", name: "Yahoo Calendar", kind: "caldav", url: "https://caldav.calendar.yahoo.com/",
      pass: { kind: "app", button: "Open Yahoo’s app password page", href: "https://login.yahoo.com/myaccount/security",
        why: "Yahoo doesn’t let other apps use your main password.",
        extra: "You can connect this calendar on its own, even if your email comes from a different provider. If you already made an app password for Yahoo Mail, you can reuse it here.",
        steps: [
          "Open Yahoo Account Security with the button below and sign in.",
          "Choose “Generate app password”, name it “AO Intelligence”, and copy it.",
          "Enter your Yahoo address and that password below."
        ] } },
    { id: "fastmail-calendar", name: "Fastmail Calendar", kind: "caldav", url: "https://caldav.fastmail.com/dav/",
      pass: { kind: "app", button: "Open Fastmail’s app password page", href: "https://app.fastmail.com/settings/security/apps",
        why: "Fastmail doesn’t let other apps use your main password.",
        extra: "You can connect this calendar on its own, even if your email comes from a different provider. Give the app password Calendars (CalDAV) access. If you already made one for mail that includes calendars, you can reuse it.",
        steps: [
          "Open Fastmail with the button below and sign in.",
          "Go to Settings, then Privacy & Security, then Manage app passwords.",
          "Create a new app password with Calendars (CalDAV) access, name it “AO Intelligence”, and copy it.",
          "Enter your Fastmail address and that password below."
        ] } },
    { id: "zoho-calendar", name: "Zoho Calendar", kind: "ics",
      steps: [
        { t: "In Zoho Calendar, open the calendar’s Share options and copy its private iCal (.ics) link.", href: "https://calendar.zoho.com", link: "Open Zoho Calendar" },
        { t: "Paste it below." } ] },
    { id: "ics", name: "Any calendar link (.ics or webcal)", kind: "ics",
      steps: [ { t: "Most calendars (GMX, BT, Sky, Virgin Media, Nextcloud, …) can publish a private link ending .ics, sometimes called “iCal”, “subscribe” or “webcal”. Copy it and paste it below." } ] },
    { id: "caldav", name: "Any CalDAV calendar", kind: "caldav", url: "",
      pass: { kind: "app", button: "", href: "",
        extra: "Enter your calendar server’s address, your username and an app password (or your normal password if the server doesn’t use app passwords).",
        steps: [
          "Find your provider’s CalDAV address (examples: iCloud https://caldav.icloud.com · Fastmail https://caldav.fastmail.com/dav/ · Yahoo https://caldav.calendar.yahoo.com/).",
          "If your provider offers app passwords, create one and use it. Otherwise use your normal password.",
          "Enter the server, your username and the password below."
        ] } },
  ];
  /** Best-guess IMAP server from an address, for instant pre-fill (the AO service does a fuller lookup). */
  function guessHost(address) {
    var d = String(address || "").split("@")[1]; d = d ? d.toLowerCase().trim() : "";
    var rules = [[/^(gmail|googlemail)\.com$/, "imap.gmail.com"], [/^(icloud|me|mac)\.com$/, "imap.mail.me.com"], [/^(yahoo|ymail|rocketmail)\./, "imap.mail.yahoo.com"], [/^sky\.(com|co\.uk)$/, "imap.mail.yahoo.com"], [/^(btinternet|btopenworld)\.com$/, "mail.btinternet.com"], [/^(virginmedia|ntlworld|blueyonder)\./, "imap.virginmedia.com"], [/^(aol|aim)\.com$/, "imap.aol.com"], [/^gmx\.(net|de|at|ch)$/, "imap.gmx.net"], [/^gmx\./, "imap.gmx.com"], [/^(zoho|zohomail)\.uk$/, "imap.zoho.uk"], [/^zoho\.eu$|^zohomail\.eu$/, "imap.zoho.eu"], [/^(zoho|zohomail)\.com\.au$/, "imap.zoho.com.au"], [/^(zoho|zohomail)\.in$/, "imap.zoho.in"], [/^(zoho|zohomail)\.jp$/, "imap.zoho.jp"], [/^zohocloud\.ca$/, "imap.zohocloud.ca"], [/^(zoho|zohomail)\.sa$/, "imap.zoho.sa"], [/^zoho(mail)?\.com$/, "imap.zoho.com"], [/^(fastmail\.(com|fm))$/, "imap.fastmail.com"]];
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(d)) return rules[i][1];
    return "";
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

  function visibleMail() {
    var ms = false;
    try { ms = !!(root.AOLive && root.AOLive.configured && root.AOLive.configured().microsoft); } catch (e) {}
    return MAIL.filter(function (p) { return p.id !== "outlook" || ms; });
  }
  root.AOReal = {
    parseStatement: parseStatement, parseCsv: parseCsv, parseOfx: parseOfx, parseDate: parseDate, parseAmount: parseAmount,
    mergeBank: mergeBank, saveBank: saveBank, localBank: localBank, clearBank: clearBank,
    saveCalendarFile: saveCalendarFile, localCalendar: localCalendar, clearCalendar: clearCalendar, eventsFromIcs: eventsFromIcs,
    MAIL: MAIL, CAL: CAL, guessHost: guessHost, BANK_TIPS: BANK_TIPS, guessCategory: guessCategory, BANK_KEY: bankKey, CAL_KEY: calKey, visibleMail: visibleMail,
  };
})(typeof window !== "undefined" ? window : globalThis);
