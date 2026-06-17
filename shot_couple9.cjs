const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const start = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer')));
  await start.asElement().click(); await new Promise(r => setTimeout(r, 1000));
  for (let i = 0; i < 6; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer|Démarrer/.test(b.textContent)));
    const el = btn?.asElement?.(); if (!el) break; await el.click(); await new Promise(r => setTimeout(r, 400));
  }
  await new Promise(r => setTimeout(r, 600));
  const profilBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.includes('Profil')));
  await profilBtn.asElement().click(); await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => localStorage.setItem('wt_plan', '"couple"'));
  // find toggle by computing rect — small pill-shaped button (44x24)
  const toggleInfo = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect();
      return { txt: b.textContent.trim().slice(0,20), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(b => b.w <= 50 && b.h <= 30 && b.w > 0);
  });
  console.log('small buttons:', JSON.stringify(toggleInfo));
  // click the 44x24 toggle
  const toggle = await page.evaluateHandle(() => {
    return [...document.querySelectorAll('button')].find(b => {
      const r = b.getBoundingClientRect();
      return Math.round(r.width) === 44 && Math.round(r.height) === 24;
    });
  });
  const toggleEl = toggle?.asElement?.();
  if (toggleEl) {
    await toggleEl.click(); await new Promise(r => setTimeout(r, 500));
    const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => /Couple/.test(b.textContent)));
    const coupleEl = coupleBtn?.asElement?.();
    if (coupleEl) {
      await coupleEl.click(); await new Promise(r => setTimeout(r, 700));
      const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("Étudiant")));
      const partnerEl = partnerBtn?.asElement?.();
      if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 700)); }
      await page.screenshot({ path: '/tmp/couple_withpartner.png' });
      console.log('done');
    } else { console.log('couple not in sidebar after toggle'); }
  } else { console.log('toggle (44x24) not found'); }
  await browser.close();
})();
