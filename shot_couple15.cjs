const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', JSON.stringify("couple"));  // couple tier
    localStorage.setItem('wt_onboarded', JSON.stringify(true));
    localStorage.setItem('wt_couple_partner', JSON.stringify("L'Intérimaire"));
    localStorage.setItem('wt_trial_popup_seen', JSON.stringify(true));
  });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  // Click start (landing)
  const startBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit'))
  );
  await startBtn.asElement().click(); await new Promise(r => setTimeout(r, 800));
  for (const txt of ['Passer ›', 'Plus tard']) {
    const btn = await page.evaluateHandle((t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t), txt);
    const el = btn?.asElement?.(); if (el) { await el.click(); await new Promise(r => setTimeout(r, 300)); }
  }
  // Navigate to Couple
  const coupleBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => /Couple/.test(b.textContent) && b.getBoundingClientRect().x < 200)
  );
  const coupleEl = coupleBtn?.asElement?.();
  if (coupleEl) {
    await coupleEl.click(); await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/tmp/couple_unlocked.png', fullPage: false });
    // Also scroll down and screenshot
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: '/tmp/couple_unlocked2.png', fullPage: false });
    console.log('done');
  } else { console.log('no couple btn'); }
  await browser.close();
})();
