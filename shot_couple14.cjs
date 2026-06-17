const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();

  // Set localStorage BEFORE React initializes by injecting on first navigation
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', JSON.stringify("pro"));
    localStorage.setItem('wt_onboarded', JSON.stringify(true));
    localStorage.setItem('wt_couple_partner', JSON.stringify("L'Intérimaire"));
    localStorage.setItem('wt_trial_dismissed', JSON.stringify(true));
    localStorage.setItem('wt_trial_popup_seen', JSON.stringify(true));
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('body:', bodyText);

  // Still on landing - click Start
  const startBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit') || b.textContent.includes('Se connecter'))
  );
  if (startBtn?.asElement?.()) {
    await startBtn.asElement().click();
    await new Promise(r => setTimeout(r, 800));
  }

  // Dismiss modals
  for (const txt of ['Passer ›', 'Plus tard']) {
    const btn = await page.evaluateHandle((t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t), txt);
    const el = btn?.asElement?.(); if (el) { await el.click(); await new Promise(r => setTimeout(r, 400)); }
  }

  const sidebarBtns = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().x < 200).map(b => b.textContent.trim().slice(0,25))
  );
  console.log('sidebar btns:', sidebarBtns);
  await page.screenshot({ path: '/tmp/couple_debug3.png' });

  // Click Couple
  const coupleBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => /Couple/.test(b.textContent) && b.getBoundingClientRect().x < 200)
  );
  const coupleEl = coupleBtn?.asElement?.();
  if (coupleEl) {
    await coupleEl.click(); await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/tmp/couple_final.png' });
    console.log('couple screenshot done');
  } else { console.log('no couple btn in sidebar'); }

  await browser.close();
})();
