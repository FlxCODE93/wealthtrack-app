const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message, '\n', e.stack?.split('\n').slice(0,4).join('\n')));
  page.on('console', m => { if (['error','warn'].includes(m.type())) console.log(m.type().toUpperCase()+':', m.text()); });
  page.on('requestfailed', r => console.log('404:', r.url(), r.failure()?.errorText));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
