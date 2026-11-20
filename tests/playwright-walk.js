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
  if (PROXY_LIVE && engineName === 'webkit') await ctx.route(/^https:\/\/aoletsgo12\.github\.io\//, async route => { const r = await fetch(route.request().url(), { headers: { 'cache-control': 'no-cache' } }); route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/plain' }, body: Buffer.from(await r.arrayBuffer()) }); });
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
  // --- mail: provider sign-in only
  t = await txt(); ok(/Connect your email/.test(t), 'email step');
  ok(!/app password|App password|IMAP|apppasswords/i.test(t + await p.content().then(c => c.replace(/<script[\s\S]*?<\/script>/g, ''))), 'no app-password / IMAP wording anywhere on the email step');
  ok(/Gmail \(Google\)/.test(t) && /Outlook, Hotmail or Microsoft 365/.test(t) && /iCloud Mail[^\n]*coming soon/i.test(t) && /Yahoo Mail[^\n]*coming soon/i.test(t), 'Gmail and Outlook listed, the rest marked coming soon');
  ok(!(await p.locator('input[type=password]').count()), 'no password field');
  await tap(btn('Gmail (Google)'));
  await tap(btn('Connect Gmail')); t = await txt();
  if (!CONFIGURED) ok(/Sign-in is being switched on, check back soon/.test(t), 'unconfigured Google: Connect answers “Sign-in is being switched on”');
  else { await p.waitForFunction(() => /is connected/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {}); t = await txt(); ok(/is connected/.test(t), 'Google sign-in connected'); if (!/is connected/.test(t)) console.log(t.slice(900, 1600)); ok(await p.evaluate(() => /gmail.readonly/.test(window.__gisScope || '') && /calendar.readonly/.test(window.__gisScope || '')), 'one consent asked for both Gmail and Calendar scopes'); await tap(btn('Continue')); }
  if (!CONFIGURED) {
    await tap(btn('Outlook, Hotmail or Microsoft 365')); await tap(btn('Connect Outlook'));
    ok(/Sign-in is being switched on, check back soon/.test(await txt()), 'unconfigured Microsoft: Connect answers too');
    await tap(btn('iCloud Mail'));
    ok(/Coming soon/.test(await txt()), 'iCloud shows Coming soon');
    await tap(btn('Let us know you need this'));
    ok(/Thanks — noted/.test(await txt()), 'request button confirms');
    ok(await p.evaluate(() => /icloud-mail/.test(localStorage.getItem('ao-provider-requests-v1') || '')), 'request saved on the device');
    await tap(btn('Another email provider')); await tap(btn('Tell us which provider')); ok(/type which provider/.test(await txt()), 'Other asks which provider when empty');
    await p.fill('#real-which', 'Proton'); await tap(btn('Tell us which provider')); ok(await p.evaluate(() => /Proton/.test(localStorage.getItem('ao-provider-requests-v1') || '')), '“Other” request saved');
    await tap(btn('Skip for now'));
    t = await txt(); ok(/Connect your calendar/.test(t) && !/\.ics|iCal|CalDAV|Calendly|Upload a calendar file/i.test(t), 'calendar step has no link/file/CalDAV flows');
    await tap(btn('Google Calendar')); await tap(btn('Connect Google Calendar')); ok(/Sign-in is being switched on/.test(await txt()), 'Google Calendar Connect answers');
    await tap(btn('iCloud Calendar')); ok(/Coming soon/.test(await txt()), 'iCloud Calendar coming soon');
    await tap(btn('Skip for now'));
  } else {
    t = await txt(); ok(/Google Calendar is connected/i.test(t), 'one Google sign-in connected the calendar too');
    await tap(btn('Continue'));
  }
  // --- bank
  t = await txt(); ok(/Add your bank statement/.test(t) && /coming soon/i.test(t), 'bank step with Open Banking marked coming soon');
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
