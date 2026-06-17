const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/?preview=hero", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));

  // Grab the current WebGL frame as an image, then bake it in as a CSS
  // background and hide the live canvas, so page.screenshot() (which can't
  // composite WebGL layers in this headless setup) captures bg + text together.
  const dataUrl = await page.evaluate(() => document.querySelector("canvas").toDataURL());

  await page.evaluate((url) => {
    const canvas = document.querySelector("canvas");
    canvas.style.display = "none";
    // the wrapper div (canvas's parent) has its own opaque background
    // color covering the viewport — override it with the captured frame.
    const wrapper = canvas.parentElement;
    wrapper.style.backgroundImage = `url(${url})`;
    wrapper.style.backgroundSize = "cover";
    wrapper.style.backgroundPosition = "center";
    wrapper.style.backgroundRepeat = "no-repeat";
  }, dataUrl);

  await page.screenshot({ path: "preview_full.png" });
  await browser.close();
})();
