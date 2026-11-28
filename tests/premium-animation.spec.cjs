const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = "http://127.0.0.1:4173";

function durationInMs(value) {
  const v = value.trim();
  return v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));

  try {
    const pages = [
      { path: "/", css: "styles.css", checks: [
        [".site-header", "pmFadeIn"],
        [".hero-copy", "pmFadeIn"],
        [".hero-visual-glow", "pmSoftPulse"],
        [".hero-orbit-one", "pmOrbitTurn"],
        [".hero-orbit-two", "pmOrbitTurn"],
        [".hero-product-tile", "pmFadeIn"],
        [".hero-floating-card", "pmFadeIn"],
        [".benefits-premium > div", "pmFadeIn"]
      ]},
      { path: "/product.html", css: "styles.css", checks: [
        [".product-detail-shell > #productDetail", "pmFadeIn"]
      ]},
      { path: "/admin.html", css: "admin.css", checks: [
        [".topbar", "pmAdminFadeIn"],
        [".welcome", "pmAdminFadeIn"],
        [".stats > article", "pmAdminFadeIn"],
        [".panel", "pmAdminFadeIn"]
      ]}
    ];

    for (const item of pages) {
      const response = await page.goto(BASE + item.path, { waitUntil: "domcontentloaded" });
      assert(response && response.ok(), item.path + " should load");
      const cssResponse = await page.request.get(BASE + "/" + item.css);
      assert(cssResponse.ok(), item.css + " should load");
      const cssText = await cssResponse.text();
      assert(cssText.includes("prefers-reduced-motion: reduce"), item.css + " must support reduced motion");

      for (const [selector, expectedAnimation] of item.checks) {
        const element = page.locator(selector).first();
        assert(await element.count() > 0, item.path + " must contain " + selector);
        const animation = await element.evaluate(el => getComputedStyle(el).animationName);
        assert(animation.split(",").map(value => value.trim()).includes(expectedAnimation),
          selector + " should use " + expectedAnimation + ", got " + animation);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    assert(await page.locator(".hero-visual").count() === 1, "mobile home hero should remain present");
    assert(await page.locator(".benefits-premium > div").count() === 3, "all benefit items should remain present");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedDurationValues = await page.locator(".hero-visual-glow").evaluate(el =>
      getComputedStyle(el).animationDuration.split(","));
    const reducedDurations = reducedDurationValues.map(durationInMs);
    assert(reducedDurations.every(value => value <= 0.1),
      "reduced-motion preference should shorten animation duration to 0.1ms or less");

    assert.deepEqual(failures, [], "pages should not throw uncaught JavaScript errors");
    console.log("PASS: desktop pages, mobile layout hooks, animation selectors and reduced-motion behavior.");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
