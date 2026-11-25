import assert from 'node:assert/strict';

const phone = { width: 390, height: 844 };
const controls = {
  header: '.atlas-menu > summary',
  layers: '.atlas-layers summary',
  watch: '.atlas-watch-shell > summary',
  quick: '.atlas-quick-details > summary',
};

function measure(selectors) {
  const width = document.documentElement.clientWidth;
  const bounds = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
    const element = document.querySelector(selector);
    const rect = element.getBoundingClientRect();
    return [key, { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
  }));
  const clipped = Object.entries(bounds).filter(([, rect]) =>
    rect.left < -1 || rect.right > width + 1 || rect.top < 0 || rect.bottom > innerHeight
  ).map(([key]) => key);
  const intersects = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
    && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
  const dock = document.querySelector('.atlas-quick').getBoundingClientRect();
  const navigationOverlap = [...document.querySelectorAll('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group button')]
    .some(button => intersects(dock, button.getBoundingClientRect()));
  return {
    width, scrollWidth: document.documentElement.scrollWidth, clipped,
    overlap: intersects(bounds.layers, bounds.watch), navigationOverlap,
  };
}

export async function auditAtlasTextReflow(browser, base) {
  const context = await browser.newContext({ viewport: phone, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(base + '/atlas?lang=id', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const size = () => page.locator(controls.header).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const normalSize = await size();
    await page.addStyleTag({ content: 'html, body { -webkit-text-size-adjust: 200% !important; text-size-adjust: 200% !important; }' });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    assert.ok(await size() >= normalSize * 1.9, 'the mobile browser applied enlarged text');
    const reflow = await page.evaluate(measure, controls);
    assert.deepEqual(reflow, { width: phone.width, scrollWidth: phone.width, clipped: [], overlap: false, navigationOverlap: false }, 'enlarged atlas retains every edge action');
    for (const selector of Object.values(controls)) {
      const summary = page.locator(selector).first();
      await summary.tap({ timeout: 20000 });
      assert.ok(await summary.evaluate(el => el.parentElement.open), `${selector} opens at 200% text`);
      if (selector === controls.header) {
        const menu = await page.locator('#atlas-menu > .atlas-menu-body').boundingBox();
        assert.ok(menu && menu.x >= 0 && menu.x + menu.width <= phone.width, 'open Controls panel fits the viewport');
      }
      if (selector === controls.quick) {
        assert.equal((await page.evaluate(measure, controls)).navigationOverlap, false, 'open Quick jump leaves map navigation clear');
      }
      if (selector === controls.layers) {
        assert.equal((await page.evaluate(measure, controls)).overlap, false, 'open Layers leaves the City watch summary clear');
        await page.locator('.atlas-layers button[data-layer-toggle="waterways-line"]').tap({ trial: true, timeout: 10000 });
      }
      await summary.tap({ timeout: 10000 });
      assert.equal(await summary.evaluate(el => el.parentElement.open), false, `${selector} closes at 200% text`);
    }

    // Restore the original intrinsic grid and single-line header in this
    // private browser context. The same geometry check must see the failure.
    await page.addStyleTag({ content: `
      body.atlas-workbench .atlas-page { grid-template-columns: auto !important; }
      body.atlas-workbench .atlas-header { flex-wrap: nowrap !important; }
      body.atlas-workbench .atlas-header-meta { flex-basis: 0% !important; }
      body.atlas-workbench .atlas-header-nav { max-width: none !important; }
      body.atlas-workbench .atlas-header-nav > .atlas-theme-control { min-width: auto !important; }
    ` });
    const broken = await page.evaluate(measure, controls);
    assert.ok(broken.scrollWidth > phone.width || broken.clipped.length || broken.overlap,
      `the original atlas phone overflow must be detected: ${JSON.stringify(broken)}`);
  } finally {
    await context.close();
  }
}
