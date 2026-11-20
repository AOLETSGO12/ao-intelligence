const test = require("node:test"); const assert = require("node:assert/strict");
const vm = require("node:vm"); const fs = require("fs"); const path = require("path");
const ctx = { console, Intl, Date, JSON, Math, Set, localStorage: (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })() };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ["js/ics.js", "js/real.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx);
const R = ctx.AOReal; const plain = (x) => JSON.parse(JSON.stringify(x));

test("Monzo-style CSV (signed amount, name + category)", () => {
  const csv = "Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split\n" +
    "tx_1,20/11/2026,09:15:02,Card payment,Shell,,Transport,-45.20,GBP,-45.20,GBP,,,,SHELL BICESTER,\n" +
    "tx_2,19/11/2026,12:00:00,Faster payment,Stripe,,Income,1200.00,GBP,1200.00,GBP,,,,STRIPE PAYOUT,\n";
  const r = plain(R.parseStatement(csv));
  assert.equal(r.rows.length, 2); assert.equal(r.from, "2026-11-19"); assert.equal(r.to, "2026-11-20");
  assert.equal(r.inTotal, 1200); assert.equal(r.outTotal, 45.2);
  assert.equal(r.rows[1].direction, "out"); assert.equal(r.rows[1].category, "Transport"); assert.equal(r.rows[1].time, "09:15");
});
test("Lloyds-style CSV (debit/credit columns)", () => {
  const csv = "Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance\n" +
    "18/11/2026,DEB,'11-22-33,12345678,TESCO STORES 1234,23.40,,1000.00\n18/11/2026,FPI,'11-22-33,12345678,J SMITH INVOICE 42,,500.00,1500.00\n";
  const r = plain(R.parseStatement(csv));
  assert.equal(r.rows.length, 2); assert.equal(r.inTotal, 500); assert.equal(r.outTotal, 23.4);
  assert.equal(r.rows.find((x) => x.direction === "out").category, "Food & drink");
});
test("Nationwide-style CSV with preamble and 'dd Mon yyyy' dates, quoted £ amounts", () => {
  const csv = '"Account Name:","Flex"\n"Balance:","£1,000.00"\n\n"Date","Transaction type","Description","Paid out","Paid in","Balance"\n"05 Nov 2026","Bank credit","Customer payment","","£1,234.50","£2,000"\n"06 Nov 2026","Direct debit","OCTOPUS ENERGY","£80.00","","£1,920"\n';
  const r = plain(R.parseStatement(csv));
  assert.equal(r.rows.length, 2); assert.equal(r.inTotal, 1234.5); assert.equal(r.outTotal, 80);
});
test("Revolut-style CSV skips reverted/pending, reads ISO datetimes", () => {
  const csv = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-11-01 10:00:00,2026-11-01 10:00:05,Costa,-3.50,0.00,GBP,COMPLETED,10\nCARD_PAYMENT,Current,2026-11-02 10:00:00,,Pending thing,-9.00,0.00,GBP,PENDING,1\n";
  const r = plain(R.parseStatement(csv)); assert.equal(r.rows.length, 1); assert.equal(r.rows[0].time, "10:00");
});
test("semicolon CSV with comma decimals", () => {
  const r = plain(R.parseStatement("Date;Description;Amount\n01.11.2026;Kunde;1.234,50\n02.11.2026;Fuel;-60,00\n"));
  assert.equal(r.inTotal, 1234.5); assert.equal(r.outTotal, 60);
});
test("OFX statement", () => {
  const ofx = "OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105000000<TRNAMT>-12.50<FITID>1<NAME>GREGGS<MEMO>CARD</STMTTRN>\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261106<TRNAMT>200.00<FITID>2<NAME>CUSTOMER</STMTTRN>\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
  const r = plain(R.parseStatement(ofx)); assert.equal(r.format, "OFX"); assert.equal(r.rows.length, 2); assert.equal(r.outTotal, 12.5);
});
test("rejects junk with a friendly message", () => {
  assert.throws(() => R.parseStatement("hello,world\n1,2\n"), /couldn’t find the date and amount columns/);
  assert.throws(() => R.parseStatement("!Type:Bank\nD01/01/2026\nT-5\n^"), /QIF/);
});
test("re-uploading replaces the overlapping range and keeps older lines", () => {
  const a = R.parseStatement("Date,Description,Amount\n01/11/2026,A,-1\n10/11/2026,B,-2\n");
  const b = R.parseStatement("Date,Description,Amount\n09/11/2026,B2,-3\n12/11/2026,C,5\n");
  R.saveBank(a, {}); R.saveBank(b, {});
  const rows = plain(R.localBank().rows);
  assert.deepEqual(rows.map((r) => r.desc), ["A", "B2", "C"]);
});
test("calendar file: upcoming events only come from the window and recurrence expands", () => {
  const d = new Date(); const y = d.getFullYear(); const pad = (n) => String(n).padStart(2, "0");
  const dt = `${y}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1\nDTSTART:${dt}T100000Z\nDTEND:${dt}T110000Z\nSUMMARY:Standup\nRRULE:FREQ=DAILY;COUNT=3\nEND:VEVENT\nEND:VCALENDAR`;
  const n = R.saveCalendarFile(ics, "UTC", "x.ics"); assert.equal(n, 3);
  assert.throws(() => R.saveCalendarFile("nope", "UTC"), /doesn’t look like a calendar/);
});
