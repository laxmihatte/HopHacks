import { chromium } from 'playwright-core';
const out = process.env.SHOT_DIR ?? '/tmp';
const exe = process.env.CHROME_PATH || undefined;
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 1180, height: 1000 } });
const p = await ctx.newPage();
const fail = [];

const countErrors = () => p.evaluate(() =>
  [...document.querySelectorAll('[role="alert"]')].filter(e => e.textContent.trim()).length);

async function run(label) {
  await p.getByRole('button', { name: /Estimate my cost/i }).click();
  await p.waitForTimeout(300);
  const before = await p.locator('text=/YOUR COST BEFORE AID/i').first().isVisible();
  const chart = await p.locator('svg[role="img"]').isVisible();
  const headline = (await p.locator('.tnum.mt-1\\.5').first().textContent().catch(() => null));
  console.log(`  ${label}: headline card=${before} chart=${chart}`);
  if (!before || !chart) fail.push(`${label}: results did not render`);
}

// --- Demo rehearsal run 1 (S5) ---
await p.goto(BASE, { waitUntil: 'networkidle' });
console.log('Run 1 — demo defaults (TCHP, 2026-10-15)');
await run('run1');
const total1 = await p.locator('section.grid div').nth(0).innerText();
console.log('   ', total1.replace(/\n/g, ' | '));
await p.screenshot({ path: `${out}/final-results.png`, fullPage: true });

// --- Demo rehearsal run 2, typed fresh (S5) ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
console.log('Run 2 — same inputs re-entered');
await p.fill('input[type="date"]', '2026-10-15');
await run('run2');
const total2 = await p.locator('section.grid div').nth(0).innerText();
if (total1 !== total2) fail.push('run2 differs from run1');
console.log('    identical to run 1:', total1 === total2);

// --- AC-T ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
await p.selectOption('select >> nth=1', 'ac-t');
console.log('AC-T');
await run('ac-t');
await p.screenshot({ path: `${out}/act.png`, fullPage: true });

// --- FOLFOX (colorectal) ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
await p.selectOption('select >> nth=0', 'colorectal-cancer');
await p.waitForTimeout(150);
console.log('FOLFOX');
await run('folfox');

// --- Empty state: income far above every gate ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
await p.fill('input[type="number"] >> nth=4', '900000');
await run('no-aid');
const empty = await p.locator('text=/No programs in this list matched/i').isVisible();
console.log('    empty state shown:', empty);
if (!empty) fail.push('empty state not shown at $900k income');
await p.screenshot({ path: `${out}/empty-state.png`, fullPage: true });

// --- Regression: Reset restores every field and clears errors ---
// Self-contained: start from a clean load so no earlier step leaks state in.
await p.goto(BASE, { waitUntil: 'networkidle' });
const resetBtn = p.getByRole('button', { name: /^Reset$/ });
const disabledAtDefaults = await resetBtn.isDisabled();
await p.fill('input[type="number"] >> nth=0', '-999');
await p.fill('input[type="number"] >> nth=4', '85500');
await p.selectOption('select >> nth=0', 'colorectal-cancer');
await p.waitForTimeout(250);
const erroredBefore = await countErrors();
const enabledAfterEdit = !(await resetBtn.isDisabled());
await resetBtn.click();
await p.waitForTimeout(400);
const restored = {
  ded: await p.locator('input[type="number"]').nth(0).inputValue(),
  inc: await p.locator('input[type="number"]').nth(4).inputValue(),
  dx: await p.locator('select').nth(0).inputValue(),
  date: await p.locator('input[type="date"]').inputValue(),
};
const alertsAfter = await countErrors();
console.log(`Regression — Reset: disabled at defaults=${disabledAtDefaults}, enabled after edit=${enabledAfterEdit}, errors ${erroredBefore}->${alertsAfter}, restored=${JSON.stringify(restored)}`);
if (!disabledAtDefaults) fail.push('Reset was enabled on a freshly loaded form');
if (!enabledAfterEdit) fail.push('Reset stayed disabled after editing a field');
if (erroredBefore === 0) fail.push('test setup produced no error to clear');
if (alertsAfter !== 0) fail.push('validation errors survived Reset');
if (restored.ded !== '3000' || restored.inc !== '85000' ||
    restored.dx !== 'breast-cancer' || restored.date !== '2026-10-15') {
  fail.push(`Reset did not restore defaults: ${JSON.stringify(restored)}`);
}
if (!(await p.getByRole('button', { name: /Estimate my cost/i }).isVisible())) {
  fail.push('Reset navigated away from the form');
}
await p.getByRole('button', { name: /Estimate my cost/i }).click();
await p.waitForTimeout(300);

// --- Regression: browser Back/Forward move between form and results ---
// (the previous check left us on the results view)
await p.goBack(); await p.waitForTimeout(300);
const backToForm = await p.getByRole('button', { name: /Estimate my cost/i }).isVisible();
await p.goForward(); await p.waitForTimeout(300);
const fwdToResults = await p.locator('section.grid > div').nth(0).isVisible();
console.log(`Regression — Back returns to form: ${backToForm}, Forward returns to results: ${fwdToResults}`);
if (!backToForm) fail.push('browser Back did not return to the form');
if (!fwdToResults) fail.push('browser Forward did not return to results');

// --- Regression: a results URL survives a reload ---
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300);
const survived = await p.locator('section.grid > div').nth(0).isVisible();
console.log('Regression — results survive a reload:', survived);
if (!survived) fail.push('reloading a results URL lost the estimate');

// --- Regression: "Change inputs" is reachable from the bottom of the page ---
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(250);
const reachable = await p.getByRole('button', { name: /Change inputs/i })
  .evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
console.log('Regression — Change inputs on screen at page bottom:', reachable);
if (!reachable) fail.push('Change inputs is not reachable when scrolled to the bottom');

// --- Regression: re-picking the SAME diagnosis must not change the regimen ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
await p.selectOption('select >> nth=0', 'breast-cancer');
await p.selectOption('select >> nth=1', 'tchp');
await p.waitForTimeout(150);
await p.selectOption('select >> nth=0', 'breast-cancer'); // same value again
await p.waitForTimeout(150);
const stillTchp = await p.locator('select').nth(1).inputValue();
console.log('Regression — regimen after re-picking same diagnosis:', stillTchp);
if (stillTchp !== 'tchp') fail.push(`re-picking the same diagnosis changed the regimen to ${stillTchp}`);

// --- Regression: the same inputs must produce the same number, every time ---
const totals = new Set();
for (let i = 0; i < 4; i++) {
  await p.getByRole('button', { name: /Estimate my cost/i }).click();
  await p.waitForTimeout(250);
  totals.add((await p.locator('section.grid > div').nth(0).innerText()).split('\n')[1]);
  await p.getByRole('button', { name: /Change inputs/i }).click();
  await p.waitForTimeout(150);
}
console.log('Regression — distinct totals over 4 identical submits:', totals.size, [...totals].join(','));
if (totals.size !== 1) fail.push(`same inputs produced ${totals.size} different totals: ${[...totals].join(', ')}`);

// --- Regression: clearing a number field must not silently become 0 ---
const dedField = p.locator('input[type="number"]').nth(0);
await dedField.fill('');
await p.waitForTimeout(150);
const cleared = await dedField.inputValue();
const submitOff = await p.getByRole('button', { name: /Estimate my cost/i }).isDisabled();
console.log(`Regression — cleared deductible reads ${JSON.stringify(cleared)}, submit disabled=${submitOff}`);
if (cleared === '0') fail.push('clearing the deductible silently coerced it to 0');
if (!submitOff) fail.push('a blank required number did not block submit');
await dedField.fill('3000');
await p.waitForTimeout(150);

// --- Validation: OOP max below deductible blocks submit ---
// (already on the form view after the regression checks above)
await p.fill('input[type="number"] >> nth=2', '1000'); // oopMax
await p.waitForTimeout(150);
const msg = await p.locator('text=/cannot be below the deductible/i').isVisible();
const disabled = await p.getByRole('button', { name: /Estimate my cost/i }).isDisabled();
console.log(`Validation: message=${msg} submit disabled=${disabled}`);
if (!msg || !disabled) fail.push('OOP-max validation did not block submit');

await b.close();
console.log(fail.length ? `\nFAILURES:\n- ${fail.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(fail.length ? 1 : 0);
