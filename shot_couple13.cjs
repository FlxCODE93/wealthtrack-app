const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', '"pro"');
    localStorage.setItem('wt_onboarded', 'true');
    localStorage.setItem('wt_couple_partner', JSON.stringify("L'Intérimaire"));
    // Dismiss pro trial
    localStorage.setItem('wt_trial_dismissed', 'true');
    localStorage.setItem('wt_pro_trial_shown', 'true');
  });
  // Also check what wt_trial keys exist
  const keys = await page.evaluate(() => Object.keys(localStorage));
  console.log('ls keys:', keys);
  
  const startBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit'))
  );
  await startBtn.asElement().click();
  await new Promise(r => setTimeout(r, 600));

  // Dismiss any modal with "Passer" or "Plus tard"
  for (const txt of ['Passer ›', 'Plus tard', 'Ignorer', 'Fermer']) {
    const btn = await page.evaluateHandle((t) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t), txt);
    const el = btn?.asElement?.();
    if (el) { console.log('clicking', txt); await el.click(); await new Promise(r => setTimeout(r, 400)); }
  }
  await new Promise(r => setTimeout(r, 600));

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('body:', bodyText);
  await page.screenshot({ path: '/tmp/couple_debug2.png' });

  // Find couple sidebar btn
  const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => ({ t: b.textContent.trim().slice(0,25), x: Math.round(b.getBoundingClientRect().x) })));
  console.log('btns with x<100:', btns.filter(b => b.x < 100).map(b => b.t));
  
  await browser.close();
})();
