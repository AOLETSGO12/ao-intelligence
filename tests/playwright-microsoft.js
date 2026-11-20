const { chromium, webkit, devices } = require('playwright');
(async()=>{
 for (const [name, eng] of [['chromium',chromium],['webkit',webkit]]) {
  const b=await eng.launch(name==='chromium'?{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}:{}); const ctx=await b.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let authUrl=null, tokenBody=null;
  await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('ao-config-override')) localStorage.setItem('ao-config-override',JSON.stringify({microsoft:{clientId:'11111111-2222-3333-4444-555555555555'},backendUrl:''})); }catch(e){} });
  await ctx.route(/login\.microsoftonline\.com\//, async route=>{ const r=route.request(); const u=new URL(r.url());
    if (r.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST,OPTIONS'}});
    if (/authorize/.test(u.pathname)) { authUrl=u; return route.fulfill({status:200,contentType:'text/html',body:`<script>location.replace('http://127.0.0.1:8099/oauth.html?code=abc123&state=${encodeURIComponent(u.searchParams.get('state'))}')</script>`}); }
    if (/token/.test(u.pathname)) { tokenBody=r.postData(); return route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify({access_token:'mstok',refresh_token:'msref',expires_in:3600,scope:'User.Read Mail.ReadWrite Calendars.Read'})}); }
    route.continue(); });
  await ctx.route(/graph\.microsoft\.com\//, route=>{ if (route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'}}); route.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify({mail:'archie@outlook.com',userPrincipalName:'archie@outlook.com',value:[]})}); });
  await p.goto('http://127.0.0.1:8099/start.html'); await p.evaluate(()=>localStorage.removeItem('ao-app-v1')); await p.reload();
  await p.fill('#acc-name','A'); await p.fill('#acc-email','a@example.com');
  const click=async t=>{const l=p.locator('button',{hasText:t}).filter({visible:true}).first(); await l.click(); await p.waitForTimeout(500);};
  await click('Continue'); await p.fill('#biz-name','B'); await click('Continue'); await click('Let’s go'); await click('Continue with 3');
  await click('Outlook, Hotmail or Microsoft 365'); await click('Connect Outlook');
  await p.waitForFunction(()=>/is connected/.test(document.body.innerText),null,{timeout:15000}).catch(()=>{});
  let t=await p.evaluate(()=>document.body.innerText);
  const ok=(c,m)=>console.log(name, c?'✓':'✗', m);
  ok(/is connected/.test(t),'Microsoft sign-in completes and shows connected'); if(!/is connected/.test(t)) console.log(t.slice(0,700));
  if (authUrl) { const s=authUrl.searchParams; console.log('  redirect_uri =',s.get('redirect_uri')); console.log('  scope =',s.get('scope')); console.log('  response_type/PKCE =',s.get('response_type'),s.get('code_challenge_method')); ok(/oauth\.html$/.test(s.get('redirect_uri')),'redirect is oauth.html'); }
  await p.locator('button',{hasText:'Continue'}).filter({visible:true}).first().click(); await p.waitForTimeout(600);
  t=await p.evaluate(()=>document.body.innerText); ok(/Outlook calendar is connected/.test(t),'one Microsoft sign-in connected the calendar too');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  await b.close();
 }})();
