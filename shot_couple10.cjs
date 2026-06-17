const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  // Set all needed localStorage upfront
  await page.evaluate(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: true }));
    localStorage.setItem('wt_plan', '"pro"');
    localStorage.setItem('wt_onboarding_done', 'true');
    localStorage.setItem('wt_couple_partner', '"L\'Intérimaire"');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  // See current state
  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('page:', pageText);
  // Find couple nav button
  const allBtns = await page.evaluate(() => [...document.querySelectorAll('button, a')].map(b => b.textContent.trim().slice(0,30)).filter(t => t));
  console.log('buttons:', allBtns.slice(0, 20));
  await page.screenshot({ path: '/tmp/couple_state.png' });
  await browser.close();
})();
