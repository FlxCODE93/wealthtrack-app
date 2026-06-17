const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const start = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer')));
  await start.asElement().click(); await new Promise(r => setTimeout(r, 800));
  for (let i = 0; i < 6; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer →|Démarrer →/.test(b.textContent)));
    const el = btn.asElement(); if (!el) break; await el.click(); await new Promise(r => setTimeout(r, 350));
  }
  for (let i = 0; i < 4; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer|Terminer/.test(b.textContent)));
    const el = btn.asElement(); if (!el) break; await el.click(); await new Promise(r => setTimeout(r, 350));
  }
  await page.evaluate(() => {
    localStorage.setItem('wt_plan', '"couple"');
    const p = JSON.parse(localStorage.getItem('wt_profile') || '{}');
    p.coupleMode = true; localStorage.setItem('wt_profile', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  // find sidebar couple item text exactly
  const btns = await page.evaluate(() => [...document.querySelectorAll('aside button')].map(b => b.textContent.trim()));
  console.log('sidebar buttons:', btns.join(' | '));
  const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => /Couple/.test(b.textContent)));
  const coupleEl = coupleBtn.asElement();
  if (coupleEl) { await coupleEl.click(); await new Promise(r => setTimeout(r, 700)); }
  await page.screenshot({ path: '/tmp/couple_full.png' });
  // Select partner
  const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("Étudiant")));
  const partnerEl = partnerBtn.asElement();
  if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 600)); }
  await page.screenshot({ path: '/tmp/couple_withpartner.png' });
  await browser.close();
})();
