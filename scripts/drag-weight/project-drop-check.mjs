// Requires the local Vite server. Run: node scripts/drag-weight/project-drop-check.mjs
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const url = process.env.PROJECT_BOARD_URL || 'http://127.0.0.1:4181/projects?design-state=populated';
// Keep live workspace edits from reloading the page halfway through a frame trace.
await page.routeWebSocket(socketUrl => socketUrl.host === new URL(url).host, () => {});

async function drag(id, destination, { cancel = false, below = false } = {}) {
  const card = page.locator(`[data-project-item="${id}"]`);
  const sourceColumn = await card.evaluate(el => el.closest('[data-project-column]').dataset.projectColumn);
  const source = await card.boundingBox();
  const lane = await page.locator(`[data-project-column="${destination}"]`).boundingBox();
  await page.mouse.move(source.x + 65, source.y + 95);
  await page.mouse.down();
  await page.mouse.move(source.x + 90, source.y + 95, { steps: 2 });
  await expect(page.locator('.project-weight-overlay')).toHaveCount(1);
  // Register after the drag loop, so sampling observes its result in the same
  // animation frame, before the browser paints. Sampling before it misses gaps.
  await page.evaluate(id => {
    window.dropTrace = { stop: false, frames: [] };
    function sample() {
      if (window.dropTrace.stop) return;
      const real = document.querySelector(`[data-project-item="${id}"]`);
      const overlay = document.querySelector('.project-weight-overlay');
      window.dropTrace.frames.push({ real: !!real, overlay: !!overlay, buttons: [...document.querySelectorAll('.project-header-actions>button')].map(button => Number(getComputedStyle(button).opacity)) });
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, id);
  await page.mouse.move(lane.x + 100, below ? source.y + source.height * 2 + 40 : source.y + 95, { steps: 18 });
  await page.waitForTimeout(150);
  if (cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.project-weight-overlay')).toHaveCount(0);
  await expect(page.locator(`[data-project-column="${cancel ? sourceColumn : destination}"] [data-project-item="${id}"]`)).toHaveCount(1);
  await page.waitForTimeout(200);
  const frames = await page.evaluate(() => { window.dropTrace.stop = true; return window.dropTrace.frames; });
  assert.ok(frames.some(frame => frame.overlay), 'trace must observe the carried card');
  assert.equal(frames.filter(frame => !frame.real && !frame.overlay).length, 0, 'drop must never paint a missing card');
  assert.ok(frames.every(frame => frame.buttons.length === 2 && frame.buttons.every(opacity => opacity === 1)), 'header buttons must not dim during save');
  console.log(`PASS ${cancel ? 'cancel' : sourceColumn === destination ? 'same-column' : 'cross-column'}: ${frames.length} frames, no blank frame`);
}

try {
  await page.goto(url);
  const first = page.locator('[data-project-column="todo"] [data-project-item]').first();
  await first.waitFor();
  const id = await first.getAttribute('data-project-item');
  await drag(id, 'in_progress');
  await drag(id, 'in_progress', { below: true });
  await drag(id, 'waiting', { cancel: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await drag(id, 'waiting');
  assert.deepEqual(errors, [], 'no browser errors');
} finally {
  await page.close();
  await browser.close();
}
