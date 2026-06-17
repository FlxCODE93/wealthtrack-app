const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', JSON.stringify("couple"));
    localStorage.setItem('wt_onboarded', JSON.stringify(true));
    localStorage.setItem('wt_couple_partner', JSON.stringify("L'Étudiant"));
    localStorage.setItem('wt_trial_popup_seen', JSON.stringify(true));
  });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  const startBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit')));
  await startBtn.asElement().click(); await new Promise(r => setTimeout(r, 600));
  for (const txt of ['Passer ›', 'Plus tard']) {
    const btn = await page.evaluateHandle((t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t), txt);
    const el = btn?.asElement?.(); if (el) { await el.click(); await new Promise(r => setTimeout(r, 300)); }
  }
  const coupleBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => /Couple/.test(b.textContent) && b.getBoundingClientRect().x < 200)
  );
  await coupleBtn.asElement().click(); await new Promise(r => setTimeout(r, 800));

  // Click first partner card
  const partnerBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Étudiant') || b.textContent.includes('Salarié'))
  );
  const partnerEl = partnerBtn?.asElement?.();
  if (partnerEl) { await partnerEl.click(); await new Promise(r => setTimeout(r, 600)); }

  await page.screenshot({ path: '/tmp/couple_top.png', fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '/tmp/couple_mid.png', fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '/tmp/couple_bot.png', fullPage: false });
  console.log('done');
  await browser.close();
})();
