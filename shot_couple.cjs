const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  page.on('console', m => { if (m.type()==='error') console.log('ERR:', m.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const start = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer')));
  await start.asElement().click();
  await new Promise(r => setTimeout(r, 1000));
  for (let i = 0; i < 5; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer →|Démarrer →|Terminer/.test(b.textContent)));
    const el = btn.asElement(); if (!el) break;
    await el.click(); await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 800));
  for (let i = 0; i < 3; i++) {
    const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /Continuer|Terminer/.test(b.textContent)));
    const el = btn.asElement(); if (!el) break; await el.click(); await new Promise(r => setTimeout(r, 500));
  }
  // navigate to couple view via sidebar
  const coupleBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button,a,[role="button"]')].find(b => b.textContent.includes('Couple')));
  const coupleEl = coupleBtn.asElement();
  if (coupleEl) { await coupleEl.click(); await new Promise(r => setTimeout(r, 600)); }
  else { console.log('no couple nav found'); }
  // select a test profile
  const partnerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes("L'Étudiant")));
  const partnerEl = partnerBtn.asElement();
  if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 500)); }
  await page.screenshot({ path: '/tmp/couple_new.png' });
  await browser.close();
})();
