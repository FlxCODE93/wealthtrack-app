const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', '"pro"');
    localStorage.setItem('wt_onboarding_done', 'true');
    localStorage.setItem('wt_couple_partner', '"L\'Intérimaire"');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200));

  // Click "Mode Couple" button — could be in sidebar
  const coupleBtn = await page.evaluateHandle(() => {
    return [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Mode Couple');
  });
  const coupleEl = coupleBtn?.asElement?.();
  if (!coupleEl) { console.log('No exact "Mode Couple" btn'); }
  else {
    const rect = await page.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, coupleEl);
    console.log('Couple btn rect:', rect);
    await coupleEl.click();
    await new Promise(r => setTimeout(r, 800));
  }
  await page.screenshot({ path: '/tmp/couple_view.png' });
  console.log('screenshot done');
  await browser.close();
})();
