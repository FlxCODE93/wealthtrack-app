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
  // go to Profil
  const profilBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => b.textContent.includes('Profil')));
  await profilBtn.asElement().click(); await new Promise(r => setTimeout(r, 500));
  // set plan to couple (find pricing or set directly)
  await page.evaluate(() => localStorage.setItem('wt_plan', '"couple"'));
  // enable coupleMode toggle
  const toggle = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll('button')];
    // find toggle near "coupleMode" area — look for button with w-11 or specific size
    return btns.find(b => {
      const s = b.getAttribute('style') || '';
      return s.includes('width: 44px') || s.includes('width:44px') || s.includes('borderRadius: 12px');
    });
  });
  const toggleEl = toggle?.asElement?.();
  if (toggleEl) { await toggleEl.click(); await new Promise(r => setTimeout(r, 500)); console.log('toggled coupleMode'); }
  else { console.log('toggle not found'); }
  // now find Couple in sidebar
  const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('aside button')].find(b => /Couple/.test(b.textContent)));
  const coupleEl = coupleBtn?.asElement?.();
  console.log('couple found:', !!coupleEl);
  if (coupleEl) {
    await coupleEl.click(); await new Promise(r => setTimeout(r, 700));
    const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("Étudiant")));
    const partnerEl = partnerBtn?.asElement?.();
    if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 600)); }
    await page.screenshot({ path: '/tmp/couple_withpartner.png' });
    console.log('screenshot done');
  }
  await browser.close();
})();
