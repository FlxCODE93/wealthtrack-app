const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  // set localStorage on actual domain
  await page.evaluate(() => {
    localStorage.setItem('wt_plan', '"couple"');
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Test", age: 30, coupleMode: true }));
  });
  // Enter app
  const start = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer')));
  await start.asElement().click(); await new Promise(r => setTimeout(r, 1000));
  for (let i = 0; i < 5; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer|Terminer|Démarrer/.test(b.textContent)));
    const el = btn?.asElement?.(); if (!el) break; await el.click(); await new Promise(r => setTimeout(r, 400));
  }
  await new Promise(r => setTimeout(r, 600));
  const btns = await page.evaluate(() => [...document.querySelectorAll('aside button')].map(b => b.textContent.trim()));
  console.log('sidebar:', btns.join(' | '));
  const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => /Couple/.test(b.textContent)));
  const coupleEl = coupleBtn?.asElement?.();
  if (coupleEl) {
    await coupleEl.click(); await new Promise(r => setTimeout(r, 700));
    const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("Étudiant")));
    const partnerEl = partnerBtn?.asElement?.();
    if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 600)); }
    await page.screenshot({ path: '/tmp/couple_withpartner.png' });
    console.log('done');
  } else { console.log('couple btn not found'); await page.screenshot({ path: '/tmp/couple_debug.png' }); }
  await browser.close();
})();
