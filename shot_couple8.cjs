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
  // set couple plan
  await page.evaluate(() => localStorage.setItem('wt_plan', '"couple"'));
  // find toggle by its aria or by xpath — try finding button next to "Mode Couple" text
  const toggle = await page.evaluateHandle(() => {
    const allElements = [...document.querySelectorAll('*')];
    const label = allElements.find(el => el.textContent.trim() === 'Mode Couple / Famille' && el.tagName !== 'BODY' && el.tagName !== 'HTML');
    if (!label) return null;
    const container = label.closest('.flex');
    if (!container) return null;
    return container.querySelector('button');
  });
  const toggleEl = toggle?.asElement?.();
  console.log('toggle found:', !!toggleEl);
  if (toggleEl) {
    await toggleEl.click(); await new Promise(r => setTimeout(r, 500));
    const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => /Couple/.test(b.textContent)));
    const coupleEl = coupleBtn?.asElement?.();
    console.log('couple in sidebar:', !!coupleEl);
    if (coupleEl) {
      await coupleEl.click(); await new Promise(r => setTimeout(r, 700));
      const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("Étudiant")));
      const partnerEl = partnerBtn?.asElement?.();
      if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 700)); }
      await page.screenshot({ path: '/tmp/couple_withpartner.png' });
      console.log('done');
    }
  }
  await browser.close();
})();
