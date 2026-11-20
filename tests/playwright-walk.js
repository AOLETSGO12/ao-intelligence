// Real-mode walkthrough in Chromium + WebKit (mobile + desktop). Usage: node real_walk.js <base-url> [webkit-fetch-proxy]
const { chromium, webkit, devices } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8099/';
const CONFIGURED = process.env.CONFIGURED === '1';
const PROXY_LIVE = /^https:/.test(BASE);
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
async function run(engineName, engine, label, ctxOpts) {
  console.log(`\n${engineName} · ${label}`);
  const b = await engine.launch(engineName === 'chromium' ? { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } : {});
  const ctx = await b.newContext(CONFIGURED ? { ...ctxOpts, serviceWorkers: 'block' } : ctxOpts); const p = await ctx.newPage();
  if (CONFIGURED) {
    await ctx.addInitScript(() => {
      try { if (!localStorage.getItem('ao-config-override')) localStorage.setItem('ao-config-override', JSON.stringify({ google: { clientId: 'test.apps.googleusercontent.com' }, backendUrl: '' })); } catch (e) {}
      window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: () => { window.__gisScope = cfg.scope; setTimeout(() => cfg.callback({ access_token: 'tok', expires_in: 3600, scope: cfg.scope }), 40); } }) } } };
    });
    await p.route(/googleapis\.com\//, route => { if (process.env.DBG) console.log('  ROUTE', route.request().method(), route.request().url()); if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }); const u = route.request().url(); const j = /gmail/.test(u) ? { emailAddress: 'archie@gmail.com', messages: [], resultSizeEstimate: 0 } : /events/.test(u) ? { items: [] } : { id: 'archie@gmail.com' }; route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(j) }); });
  }
  const errs = []; if (process.env.DBG) { p.on('console', m => console.log('  C', m.text().slice(0,160))); ctx.on('request', r => /googleapis/.test(r.url()) && console.log('  REQ', r.method(), r.url())); } p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|workers\.dev/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  const apiReqs = [];
  p.on('response', r => { if (/workers\.dev/.test(r.url())) apiReqs.push(r.request().method() + ' ' + r.url().replace(/^https:\/\/[^/]+/, '') + ' ' + r.status()); });
  if (PROXY_LIVE && engineName === 'webkit') await ctx.route(/^https:\/\/(aoletsgo12\.github\.io|ao-intelligence-api\.ao-446557ec\.workers\.dev)\//, async route => {
    const rq = route.request(); const h = { 'cache-control': 'no-cache' }; const hd = rq.headers();
    for (const k of ['content-type', 'origin', 'access-control-request-method', 'access-control-request-headers']) if (hd[k]) h[k] = hd[k];
    const r = await fetch(rq.url(), { method: rq.method(), headers: h, body: ['GET', 'HEAD', 'OPTIONS'].includes(rq.method()) ? undefined : rq.postDataBuffer() });
    const out = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|connection)$/.test(k)) out[k] = v; });
    route.fulfill({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
  });
  const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); await (ctxOpts.hasTouch ? loc.tap() : loc.click()); await p.waitForTimeout(450); };
  const btn = (t) => p.locator('button, a, label', { hasText: t }).filter({ visible: true }).first();
  const txt = () => p.evaluate(() => document.body.innerText);
  await p.goto(BASE + 'start.html'); await p.waitForTimeout(1200);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  ok(!(await txt()).includes('Password'), 'no fake password field in the real app');
  await p.fill('#acc-name', 'Archie Owen'); await p.fill('#acc-email', 'archie@example.com');
  await tap(btn('Continue')); await p.fill('#biz-name', 'Archie Owen Racing'); await tap(btn('Continue')); await tap(btn('Let’s go'));
  let t = await txt(); ok(/Email/.test(t) && /Calendar/.test(t) && !/Xero|QuickBooks|FreeAgent|PayPal\s*\n/.test(t.replace(/Coming soon[^\n]*/, '')), 'pick screen lists only real options');
  await tap(btn('Continue with 3 selected'));
  // --- mail
  t = await txt(); ok(/Connect your email/.test(t), 'email step');
  const noPlaceholders = (x) => !/coming soon|let us know|not available yet|tell us which/i.test(x);
  ok(noPlaceholders(t.replace(/Microsoft no longer allows[^\n]*/, '').replace(/Sign-in with Microsoft is coming very soon\./, '')), 'no “coming soon / let us know” text on the email step');
  for (const n of ['Gmail (Google)', 'Outlook, Hotmail or Microsoft 365', 'iCloud Mail and Calendar', 'Yahoo Mail', 'AOL Mail', 'Zoho Mail', 'Fastmail', 'GMX', 'BT Mail', 'Sky Mail', 'Virgin Media', 'Another provider']) if (!t.includes(n)) ok(false, 'provider listed: ' + n);
  ok(t.includes('Another provider') && t.includes('Virgin Media'), 'every provider is listed');
  const tryMail = async (list, addr, pw, host, expectRe, label) => {
    await tap(btn(list)); await p.waitForTimeout(250);
    await p.locator('#real-addr').first().fill(addr); await p.locator('#real-pass').first().fill(pw);
    if (host) await p.locator('#real-host').first().fill(host);
    const before = apiReqs.length;
    // Prefer the connect button inside the form panel (or the nested app-password fallback for Gmail).
    const panel = (await p.locator('#real-fallback').count()) ? p.locator('#real-fallback') : p.locator('#real-panel');
    const connect = panel.locator('button.btn-primary').filter({ visible: true }).first();
    await tap(connect);
    await p.waitForFunction(re => /didn’t accept those details|didn’t answer in time|couldn’t open a secure connection/.test(document.body.innerText), null, { timeout: 50000 }).catch(() => {});
    let tt = await txt(); let mine = apiReqs.slice(before).join(', ');
    // Some providers (BT) occasionally time out; one retry is enough.
    if (PROXY_LIVE && /POST \/imap\/connect 504/.test(mine) && !expectRe.test(tt)) {
      await tap(panel.locator('button.btn-primary').filter({ visible: true }).first());
      await p.waitForFunction(re => new RegExp(re).test(document.body.innerText), expectRe.source, { timeout: 50000 }).catch(() => {});
      tt = await txt(); mine = apiReqs.slice(before).join(', ');
    }
    ok(expectRe.test(tt) && (!PROXY_LIVE || /POST \/imap\/connect 401/.test(mine)), label + ' → friendly wrong-password message (' + (mine || 'no request') + ')');
  };
  await tap(btn('Gmail (Google)'));
  t = await txt(); ok(!CONFIGURED ? /Almost ready/.test(t) && /Or connect with an app password/.test(t) && /apppasswords/.test(await p.content()) && /signinoptions\/twosv/.test(await p.content()) : !/Or connect with an app password/.test(t), CONFIGURED ? 'Gmail app-password fallback hidden once Google sign-in is configured' : 'Gmail: sign-in notice plus app-password fallback with Google links');
  await tap(btn('Connect Gmail')); t = await txt();
  if (!CONFIGURED) ok(/Sign-in is being switched on, check back soon/.test(t), 'unconfigured Google: Connect answers “Sign-in is being switched on”');
  else { await p.waitForFunction(() => /is connected/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {}); t = await txt(); ok(/is connected/.test(t), 'Google sign-in connected'); ok(await p.evaluate(() => /gmail.readonly/.test(window.__gisScope || '') && /calendar.readonly/.test(window.__gisScope || '')), 'one consent asked for both Gmail and Calendar scopes'); await tap(btn('Continue')); }
  if (!CONFIGURED) {
    const WRONG = /didn’t accept those details/;
    await tap(btn('Outlook, Hotmail or Microsoft 365')); t = await txt();
    ok(/coming very soon/i.test(t) && /Microsoft no longer allows/.test(t) && !(await p.locator('input[type=password]').count()), 'Outlook: “coming very soon” notice, limitation note, no password field');
    await tap(btn('Connect Outlook')); ok(/coming very soon/i.test(await txt()), 'Outlook Connect answers');
    if (PROXY_LIVE) {
      await tryMail('Gmail (Google)', 'fake.person.7731@gmail.com', 'abcd efgh ijkl mnop', '', WRONG, 'Gmail app password (IMAP)');
      await tryMail('iCloud Mail and Calendar', 'fake.person.7731@icloud.com', 'abcd-efgh-ijkl-mnop', '', WRONG, 'iCloud IMAP');
      await tryMail('Yahoo Mail', 'fake.person.7731@yahoo.com', 'abcdefghijklmnop', '', WRONG, 'Yahoo');
      await tryMail('AOL Mail', 'fake.person.7731@aol.com', 'abcdefghijklmnop', '', WRONG, 'AOL');
      await tryMail('Zoho Mail', 'fake.person.7731@zoho.com', 'abcdefghijkl', '', WRONG, 'Zoho');
      await tryMail('Fastmail', 'fake.person.7731@fastmail.com', 'abcdefghijkl', '', WRONG, 'Fastmail');
      await tryMail('GMX', 'fake.person.7731@gmx.co.uk', 'abcdefghijkl', '', WRONG, 'GMX');
      await tryMail('BT Mail', 'fake.person.7731@btinternet.com', 'notmypassword1', '', WRONG, 'BT Mail');
      await tryMail('Sky Mail', 'fake.person.7731@sky.com', 'abcdefghijklmnop', '', WRONG, 'Sky Mail');
      await tryMail('Virgin Media', 'fake.person.7731@virginmedia.com', 'notmypassword1', '', WRONG, 'Virgin Media');
      // another provider: auto-detect, then a manual server
      await tap(btn('Another provider'));
      await p.locator('#real-addr').first().fill('fake.person.7731@fastmail.org'); await tap(btn('Find my settings')); await p.waitForTimeout(3500);
      ok(await p.locator('#real-host').first().inputValue() === 'imap.fastmail.com', 'Another provider: “Find my settings” detects the server from the address');
      await tryMail('Another provider', 'fake.person.7731@example.com', 'abcdefghijkl', 'imap.fastmail.com', WRONG, 'manual server (imap.fastmail.com)');
    } else {
      await tap(btn('iCloud Mail and Calendar')); t = await txt(); ok(/App-Specific Passwords/.test(t) && (await p.locator('a[href*="account.apple.com"]').count()) > 0 && (await p.locator('#real-host').first().inputValue()) === 'imap.mail.me.com', 'iCloud form with Apple deep link and server pre-filled');
      await tap(btn('Another provider')); ok(await p.locator('#real-detect').count() === 1, 'Another provider has a working form with “Find my settings”');
    }
    await tap(btn('Skip for now'));
    // --- calendar
    t = await txt(); ok(/Connect your calendar/.test(t), 'calendar step'); ok(noPlaceholders(t), 'no placeholders on the calendar step');
    await tap(btn('Google Calendar')); t = await txt();
    ok(/Almost ready/.test(t) && /Or use a secret iCal link/.test(t) && /Secret address in iCal format/.test(t), 'Google Calendar: sign-in notice + secret iCal link option');
    await tap(btn('Connect Google Calendar')); ok(/Sign-in is being switched on/.test(await txt()), 'Google Calendar Connect answers');
    await tap(btn('Connect with this link')); ok(/paste the calendar link/.test(await txt()), 'empty link → clear message');
    await tap(btn('Outlook or Microsoft 365 calendar')); t = await txt(); ok(/coming very soon/i.test(t) && /Publish a calendar/.test(t), 'Outlook calendar: notice + published ICS link option');
    if (PROXY_LIVE) {
      const tryCal = async (list, btnRe, user, pw, urlv, re, apiRe, label) => {
        await tap(btn(list)); await p.waitForTimeout(250);
        if (user) await p.locator('#real-user').first().fill(user);
        if (pw) await p.locator('#real-cpass').first().fill(pw);
        if (urlv) await p.locator('#real-url').first().fill(urlv);
        const before = apiReqs.length; await tap(btn(btnRe));
        await p.waitForFunction(r => new RegExp(r).test(document.body.innerText), re.source, { timeout: 25000 }).catch(() => {});
        const mine = apiReqs.slice(before).join(', '); ok(re.test(await txt()) && apiRe.test(mine), label + ' (' + mine + ')');
      };
      const CWRONG = /didn’t accept that username and app password/;
      await tryCal('iCloud Calendar and Mail', /^Connect iCloud calendar and mail/, 'fake.person.7731@icloud.com', 'abcd-efgh-ijkl-mnop', '', CWRONG, /POST \/caldav\/connect 401/, 'iCloud CalDAV → friendly wrong-password message');
      await tryCal('Yahoo Calendar', /^Connect Yahoo Calendar/, 'fake.person.7731@yahoo.com', 'abcdefghijklmnop', '', CWRONG, /POST \/caldav\/connect 401/, 'Yahoo CalDAV → friendly wrong-password message');
      await tryCal('Fastmail Calendar', /^Connect Fastmail Calendar/, 'fake.person.7731@fastmail.com', 'abcdefghijkl', '', CWRONG, /POST \/caldav\/connect 401/, 'Fastmail CalDAV → friendly wrong-password message');
      await tryCal('Any CalDAV calendar', /^Connect Any CalDAV/, 'fake.person.7731@icloud.com', 'abcd-efgh-ijkl-mnop', 'https://caldav.icloud.com/', CWRONG, /POST \/caldav\/connect 401/, 'manual CalDAV server');
      await tryCal('Any calendar link', /^Connect Any calendar link/, '', '', 'https://example.com/', /didn’t return a calendar/, /POST \/ics\/connect 422/, 'a non-calendar link is refused cleanly');
      await tap(btn('Google Calendar')); await p.locator('#real-url').first().fill('https://www.gov.uk/bank-holidays/england-and-wales.ics');
      const bi = apiReqs.length; await tap(btn('Connect with this link')); await p.waitForTimeout(3500);
      ok(/POST \/ics\/connect 200/.test(apiReqs.slice(bi).join(', ')), 'secret-iCal-style link accepted by the Worker (live fetch of UK bank holidays)');
      t = await txt(); ok(/is connected/.test(t), 'calendar link shows connected'); await tap(btn('Continue'));
    } else {
      await tap(btn('iCloud Calendar and Mail')); ok((await p.locator('#real-url').first().inputValue()) === 'https://caldav.icloud.com/' && (await p.locator('a[href*="account.apple.com"]').count()) > 0, 'iCloud calendar form with Apple deep link and CalDAV server pre-filled');
      await tap(btn('Skip for now'));
    }
  } else {
    t = await txt(); ok(/Google Calendar is connected/i.test(t), 'one Google sign-in connected the calendar too');
    await tap(btn('Continue'));
  }
  // --- bank
  t = await txt(); ok(/Add your bank statement/.test(t) && noPlaceholders(t), 'bank step: upload flow, no placeholders');
  await p.selectOption('#real-bank', 'monzo'); await p.waitForTimeout(300);
  ok(/Monzo: in the app/.test(await txt()), 'Monzo-specific export tip');
  await p.setInputFiles('#real-file', '/tmp/fx/monzo.csv'); await p.waitForTimeout(600);
  t = await txt(); ok(/Found 4 transactions/.test(t), 'statement parsed in the browser');
  await tap(btn('Use this statement'));
  t = await txt(); ok(/is connected/.test(t) && /Kept on this device/.test(t), 'statement saved on device');
  await tap(btn('Continue'));
  t = await txt(); ok(/You’re all set|all set/.test(t), 'finish screen');
  await tap(btn('Go to my dashboard')); await p.waitForTimeout(1500);
  await p.waitForURL(/app\.html/, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1200);
  t = await txt(); ok(/Add your first|Connect your calendar|nothing|No /i.test(t) || CONFIGURED, 'Today starts honest and empty');
  ok(!/Sample data|sample data|Demo/.test(t), 'no sample/demo wording on Today');
  // tasks
  await p.fill('#new-task', 'Email the sponsor deck'); await tap(btn('Add'));
  t = await txt(); ok(/Email the sponsor deck/.test(t), 'user task added');
  await p.locator('input[type=checkbox]').filter({ visible: true }).first().check().catch(() => {});
  await tap(btn('Add a target')); await p.fill('#tg-label', 'Sponsor meetings'); await p.fill('#tg-cur', '1'); await p.fill('#tg-goal', '5');
  await tap(btn('Add target')); t = await txt(); ok(/Sponsor meetings/.test(t) && /1 of 5/.test(t), 'user target added');
  // persistence
  await p.reload(); await p.waitForTimeout(1500); t = await txt(); ok(/Email the sponsor deck/.test(t) && /1 of 5/.test(t), 'tasks and targets persist after reload');
  // money
  await tap(p.locator('.app-tab', { hasText: 'Money' }));
  t = await txt(); ok(/1,200|£1,200/.test(t) && /stripe/i.test(t), 'Money shows the uploaded statement'); if(!(/1,200|£1,200/.test(t))) console.log(t.slice(0,1500));
  ok(/Bank statement kept on this device/.test(t), 'statement note + stale hint');
  ok(!/Sample|Demo/.test(t), 'no sample/demo wording on Money');
  await tap(p.locator('.app-tab', { hasText: 'Inbox' })); t = await txt(); ok(CONFIGURED || /Connect your email/.test(t), 'Inbox: honest empty state');
  await tap(p.locator('.app-tab', { hasText: 'Calendar' })); t = await txt(); ok(!/Silverstone|Sponsor call/.test(t), 'Calendar tab has no made-up events');
  await tap(p.locator('.app-tab', { hasText: 'Connections' })); t = await txt(); ok(!/Xero|Demo controls/.test(t), 'Connections lists only real options');
  ok(errs.length === 0, 'no console/page errors' + (errs.length ? ' → ' + errs.join(' | ') : ''));
  await p.screenshot({ path: `/tmp/real-${engineName}-${label}.png` });
  await b.close();
}
(async () => {
  const web = (process.env.ONLY || 'chromium,webkit').split(',');
  for (const e of web) {
    const eng = e === 'chromium' ? chromium : webkit;
    await run(e, eng, 'mobile', e === 'chromium' ? { ...devices['iPhone 14'], defaultBrowserType: undefined } : devices['iPhone 14']);
    await run(e, eng, 'desktop', { viewport: { width: 1280, height: 800 } });
  }
  console.log(fails ? `\n${fails} FAILED` : '\nall real-walk checks passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
