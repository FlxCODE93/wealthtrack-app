const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Set localStorage before clicking Start — so onboarding is skipped
  await page.evaluate(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', '"pro"');
    localStorage.setItem('wt_onboarded', 'true');
    localStorage.setItem('wt_couple_partner', JSON.stringify("L'Intérimaire"));
  });

  // Click Commencer gratuitement
  const startBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit'))
  );
  await startBtn.asElement().click();
  await new Promise(r => setTimeout(r, 1200));

  // Check what's on screen now
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('after start:', bodyText);

  // Look for couple sidebar
  const coupleNav = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button, li')].find(b => b.textContent.trim().includes('Couple'))
  );
  const coupleEl = coupleNav?.asElement?.();
  if (coupleEl) {
    const r = await page.evaluate(el => { const b = el.getBoundingClientRect(); return {x:b.x, y:b.y}; }, coupleEl);
    console.log('Couple nav at:', r);
    await coupleEl.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: '/tmp/couple_view2.png' });
    console.log('done');
  } else {
    console.log('no couple nav found');
    await page.screenshot({ path: '/tmp/couple_debug.png' });
  }
  await browser.close();
})();
