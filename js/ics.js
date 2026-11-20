var AOIcs = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../agent-dashboard-site/backend/src/ics-web.js
  var ics_web_exports = {};
  __export(ics_web_exports, {
    parseIcs: () => parseIcs,
    windowFor: () => windowFor
  });

  // ../agent-dashboard-site/backend/src/util.js
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function wall(epochMs, tz) {
    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epochMs));
    } catch (e) {
      parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epochMs));
    }
    const m = {};
    parts.forEach((p) => {
      m[p.type] = p.value;
    });
    return { y: +m.year, mo: +m.month, d: +m.day, h: +m.hour, mi: +m.minute, s: +m.second, date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour}:${m.minute}` };
  }
  function wallToEpoch(y, mo, d, h, mi, s, tz) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
    try {
      let t = guess;
      for (let i = 0; i < 2; i++) {
        const w = wall(t, tz);
        const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
        t = t - (asUtc - guess);
      }
      return t;
    } catch (e) {
      return null;
    }
  }
  function isoDate(y, mo, d) {
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  function addDaysIso(iso, n) {
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  // ../agent-dashboard-site/backend/src/ics.js
  function unfold(text) {
    return String(text).replace(/\r?\n[ \t]/g, "");
  }
  function unescapeText(s) {
    return String(s || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
  }
  function parseLine(line) {
    const i = line.indexOf(":");
    if (i < 0) return null;
    const left = line.slice(0, i), value = line.slice(i + 1);
    const bits = left.split(";");
    const name = bits[0].toUpperCase();
    const params = {};
    bits.slice(1).forEach((p) => {
      const j = p.indexOf("=");
      if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, "");
    });
    return { name, params, value };
  }
  function parseDateValue(value, params, tz) {
    const v = value.trim();
    let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return { allDay: true, date: `${m[1]}-${m[2]}-${m[3]}`, time: "00:00", epoch: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
    m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
    if (!m) return null;
    const [y, mo, d, h, mi, s] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
    let epoch;
    if (m[7] === "Z") epoch = Date.UTC(y, mo - 1, d, h, mi, s);
    else if (params && params.TZID) {
      epoch = wallToEpoch(y, mo, d, h, mi, s, params.TZID);
      if (epoch == null || isNaN(epoch)) epoch = wallToEpoch(y, mo, d, h, mi, s, tz);
    } else epoch = wallToEpoch(y, mo, d, h, mi, s, tz);
    const w = wall(epoch, tz);
    return { allDay: false, date: w.date, time: w.time, epoch };
  }
  function parseRrule(s) {
    const o = {};
    String(s).split(";").forEach((kv) => {
      const [k, v] = kv.split("=");
      if (k) o[k.toUpperCase()] = v;
    });
    return o;
  }
  var DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  function dowOf(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }
  function occurrences(startDate, rr, from, to, exdates) {
    const out = [];
    const freq = rr.FREQ, interval = Math.max(1, parseInt(rr.INTERVAL || "1", 10));
    const count = rr.COUNT ? parseInt(rr.COUNT, 10) : Infinity;
    let until = null;
    if (rr.UNTIL) {
      const m = rr.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
      if (m) until = `${m[1]}-${m[2]}-${m[3]}`;
    }
    const byday = rr.BYDAY ? rr.BYDAY.split(",").map((x) => DOW[x.replace(/[^A-Z]/g, "")]).filter((x) => x != null) : null;
    let n = 0;
    const push = (iso) => {
      if (until && iso > until) return false;
      n++;
      if (n > count) return false;
      if (iso >= from && iso <= to && !exdates.has(iso)) out.push(iso);
      return iso <= to;
    };
    if (freq === "DAILY") {
      for (let i = 0, d = startDate; i < 4e3; i++, d = addDaysIso(d, interval)) {
        if (!push(d)) break;
      }
    } else if (freq === "WEEKLY") {
      const days = byday && byday.length ? byday : [dowOf(startDate)];
      const weekStart = addDaysIso(startDate, -dowOf(startDate));
      for (let w = 0; w < 1500; w++) {
        const base = addDaysIso(weekStart, w * 7 * interval);
        if (base > to) break;
        let stop = false;
        for (const dw of days.slice().sort((a, b) => a - b)) {
          const iso = addDaysIso(base, dw);
          if (iso < startDate) continue;
          if (!push(iso)) {
            stop = true;
            break;
          }
        }
        if (stop) break;
      }
    } else if (freq === "MONTHLY" || freq === "YEARLY") {
      const [y0, m0, d0] = startDate.split("-").map(Number);
      for (let i = 0; i < 600; i++) {
        const step = freq === "MONTHLY" ? i * interval : i * interval * 12;
        const y = y0 + Math.floor((m0 - 1 + step) / 12), mo = (m0 - 1 + step) % 12 + 1;
        const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
        if (d0 > last) continue;
        if (!push(isoDate(y, mo, d0))) break;
      }
    } else if (startDate >= from && startDate <= to) out.push(startDate);
    return out;
  }
  function parseIcs(text, { from, to, tz = "Europe/London" } = {}) {
    const lines = unfold(text).split(/\r?\n/);
    const events = [];
    let cur = null;
    for (const raw of lines) {
      if (/^BEGIN:VEVENT/i.test(raw)) {
        cur = { props: [] };
        continue;
      }
      if (/^END:VEVENT/i.test(raw)) {
        if (cur) events.push(cur);
        cur = null;
        continue;
      }
      if (cur) {
        const p = parseLine(raw);
        if (p) cur.props.push(p);
      }
    }
    const get = (e, n) => e.props.find((p) => p.name === n);
    const overridden = /* @__PURE__ */ new Set();
    const parsed = events.map((e) => {
      const ds = get(e, "DTSTART");
      if (!ds) return null;
      const st = parseDateValue(ds.value, ds.params, tz);
      if (!st) return null;
      const de = get(e, "DTEND");
      let en = de ? parseDateValue(de.value, de.params, tz) : null;
      const dur = get(e, "DURATION");
      if (!en && dur) {
        const m = dur.value.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
        if (m) en = { epoch: st.epoch + ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60) * 1e3 };
      }
      const rid = get(e, "RECURRENCE-ID");
      const uid = (get(e, "UID") || {}).value || "";
      if (rid) {
        const r = parseDateValue(rid.value, rid.params, tz);
        if (r) overridden.add(uid + "|" + r.date);
      }
      const ex = /* @__PURE__ */ new Set();
      e.props.filter((p) => p.name === "EXDATE").forEach((p) => p.value.split(",").forEach((v) => {
        const d = parseDateValue(v, p.params, tz);
        if (d) ex.add(d.date);
      }));
      return {
        uid,
        st,
        en,
        rid: !!rid,
        summary: unescapeText((get(e, "SUMMARY") || {}).value) || "(no title)",
        location: unescapeText((get(e, "LOCATION") || {}).value),
        rrule: get(e, "RRULE") ? parseRrule(get(e, "RRULE").value) : null,
        ex,
        status: ((get(e, "STATUS") || {}).value || "").toUpperCase(),
        attendees: e.props.filter((p) => p.name === "ATTENDEE").length,
        url: (get(e, "URL") || {}).value || ""
      };
    }).filter(Boolean);
    const out = [];
    const make = (p, date, idx) => {
      let end = p.en ? wall(p.en.epoch, tz) : null;
      const durMs = p.en ? p.en.epoch - p.st.epoch : 0;
      const online = /https?:\/\/[^ ]*(zoom|teams\.microsoft|meet\.google|webex|whereby)/i.test(p.location + " " + p.url);
      const kind = p.attendees > 0 || online ? "meeting" : "business";
      const place = p.location || (online ? "Video call" : "");
      if (p.st.allDay) {
        const days = p.en ? Math.max(1, Math.round(durMs / 864e5)) : 1;
        for (let i = 0; i < Math.min(days, 14); i++) {
          const d = addDaysIso(date, i);
          if (d >= from && d <= to) out.push({ id: `${p.uid}:${d}`, date: d, start: "00:00", end: "23:59", title: p.summary, kind: "business", place, allDay: true });
        }
        return;
      }
      const startTime = p.st.time;
      const endTime = end ? p.rrule || end.date === p.st.date ? end.time : "23:59" : startTime;
      out.push({ id: `${p.uid}:${date}:${idx}`, date, start: startTime, end: endTime, title: p.summary, kind, place });
    };
    parsed.forEach((p, idx) => {
      if (p.status === "CANCELLED") return;
      if (p.rrule && !p.rid) {
        occurrences(p.st.date, p.rrule, from, to, /* @__PURE__ */ new Set([...p.ex, ...[...overridden].filter((k) => k.startsWith(p.uid + "|")).map((k) => k.split("|")[1])])).forEach((d) => make(p, d, idx));
      } else if (p.st.date >= from && p.st.date <= to) make(p, p.st.date, idx);
      else if (p.st.allDay && p.en) {
        const last = addDaysIso(p.en.date || p.st.date, -1);
        if (p.st.date < from && last >= from) make(p, p.st.date, idx);
      }
    });
    out.sort((a, b) => a.date + a.start < b.date + b.start ? -1 : 1);
    return out;
  }
  function windowFor(days, tz) {
    const today = wall(Date.now(), tz).date;
    return { from: today, to: addDaysIso(today, days) };
  }
  return __toCommonJS(ics_web_exports);
})();
