const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  console.log(errors.length ? errors.join('\n') : 'No errors on landing');

  // Try entering app
  await page.evaluateOnNewDocument(() => {});
  await page.evaluate(() => {
    localStorage.setItem('wt_profile', JSON.stringify({ firstName: "Felix", lastName: "M", age: 30, email: "", coupleMode: false }));
    localStorage.setItem('wt_plan', JSON.stringify("couple"));
    localStorage.setItem('wt_onboarded', JSON.stringify(true));
    localStorage.setItem('wt_trial_popup_seen', JSON.stringify(true));
  });
  const btn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Commencer gratuit')));
  if (btn?.asElement?.()) {
    await btn.asElement().click();
    await new Promise(r => setTimeout(r, 1500));
    const appErrors = [];
    page.on('pageerror', e => appErrors.push('APP: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') appErrors.push('APP_CON: ' + m.text()); });
    await new Promise(r => setTimeout(r, 1000));
    console.log(appErrors.length ? appErrors.join('\n') : 'No errors in app');
  }
  await page.screenshot({ path: '/tmp/debug_screen.png' });
  await browser.close();
})();
