const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
  page.on("requestfailed", (req) => console.log("REQFAILED:", req.url(), req.failure()?.errorText));
  page.on("response", (res) => { if (res.status() >= 400) console.log("HTTP", res.status(), res.url()); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/?preview=hero", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const glCheck = await page.evaluate(() => {
    const c = document.createElement("canvas");
    const gl2 = c.getContext("webgl2");
    return { hasWebGL2: !!gl2, renderer: gl2 ? gl2.getParameter(gl2.RENDERER) : null, vendor: gl2 ? gl2.getParameter(gl2.VENDOR) : null };
  });
  console.log("GLCHECK:", JSON.stringify(glCheck));
  const info = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const wrapper = canvas ? canvas.closest("div") : null;
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const cs = canvas ? getComputedStyle(canvas) : null;
    // sample a few pixels
    let pixels = null;
    if (canvas) {
      const ctx2 = canvas.getContext("2d", { willReadFrequently: true });
      // canvas is webgl, getContext("2d") would fail if webgl already attached; use toDataURL instead
    }
    let dataUrlSnippet = null;
    let fullDataUrl = null;
    try {
      fullDataUrl = canvas.toDataURL();
      dataUrlSnippet = fullDataUrl.slice(0, 60);
    } catch (e) {
      dataUrlSnippet = "ERR:" + e.message;
    }
    return {
      canvasCount: document.querySelectorAll("canvas").length,
      canvasRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      canvasW: canvas ? canvas.width : null,
      canvasH: canvas ? canvas.height : null,
      computedWidth: cs ? cs.width : null,
      computedHeight: cs ? cs.height : null,
      computedPosition: cs ? cs.position : null,
      computedDisplay: cs ? cs.display : null,
      wrapperStyle: wrapper ? wrapper.getAttribute("style") : null,
      canvasStyle: canvas ? canvas.getAttribute("style") : null,
      dataUrlSnippet,
      fullDataUrl,
    };
  });
  console.log("INFO:", JSON.stringify({ ...info, fullDataUrl: undefined }, null, 2));
  if (info.fullDataUrl) {
    const base64 = info.fullDataUrl.split(",")[1];
    fs.writeFileSync("canvas_raw.png", Buffer.from(base64, "base64"));
  }
  await page.screenshot({ path: "preview_mesh.png" });
  await browser.close();
})();
