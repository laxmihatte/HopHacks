// Drives the demo end to end in a real browser and pins the behaviours that
// have regressed before. Needs a Chromium binary:
//   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run rehearse
import { chromium } from 'playwright-core';

const out = process.env.SHOT_DIR ?? '/tmp';
const exe = process.env.CHROME_PATH || undefined;
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: 1180, height: 1000 } });
const fail = [];

const submit = () => p.getByRole('button', { name: /Estimate my cost/i });
const change = () => p.getByRole('button', { name: /Change inputs/i });
const reset = () => p.getByRole('button', { name: /^Reset$/ });
const sel = (name) => p.locator(`select[aria-label="${name}"]`);
// Address fields by their visible label, never by position: adding a field
// used to silently shift every positional index in this script. Matching is
// case-insensitive because the label styling uppercases the accessible name.
const byLabel = (label) => p.getByLabel(label, { exact: true });
const num = byLabel;
const pick = byLabel;

// Only the app's own field errors: Playwright pierces shadow DOM and Chrome's
// form controls expose an empty role="alert" node inside theirs.
const countErrors = () => p.evaluate(() =>
  [...document.querySelectorAll('[role="alert"]')].filter(e => e.textContent.trim()).length);

const headline = () => p.evaluate(() => {
  const el = [...document.querySelectorAll('p')].find(e => /your cost before aid/i.test(e.textContent));
  return el ? el.nextElementSibling.textContent.trim() : null;
});

const optimizer = () => p.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find(e => /any choice/i.test(e.textContent));
  if (!h) return null;
  const t = h.closest('section').innerText.split('\n').filter(Boolean);
  const i = t.findIndex(x => /CHEAPEST DATE/i.test(x));
  const j = t.findIndex(x => /SAVES|CHOSEN DATE/i.test(x));
  return { cheapest: i >= 0 ? t[i + 1] : null, saves: j >= 0 ? t[j + 1] : null };
});

async function run(label) {
  await submit().click();
  await p.waitForTimeout(350);
  const h = await headline();
  const chart = await p.locator('svg[role="img"]').first().isVisible();
  console.log(`  ${label}: ${h} (chart=${chart})`);
  if (!h || !chart) fail.push(`${label}: results did not render`);
  return h;
}

// --- S5: the demo, twice, without intervention ---
await p.goto(BASE, { waitUntil: 'networkidle' });
console.log('Run 1 — demo defaults (TCHP, 2026-10-15, January plan year)');
const total1 = await run('run1');
await p.screenshot({ path: `${out}/final-results.png`, fullPage: true });

await change().click(); await p.waitForTimeout(200);
console.log('Run 2 — same inputs');
const total2 = await run('run2');
if (total1 !== total2) fail.push('run2 differs from run1');
console.log('    identical to run 1:', total1 === total2);

// --- The start-date optimizer ---
const opt = await optimizer();
console.log(`Optimizer — cheapest ${opt?.cheapest}, saves ${opt?.saves}`);
if (!opt?.cheapest) fail.push('optimizer did not render');
const today = new Date().toISOString().slice(0, 10);
const cheapestIso = await p.evaluate(() => {
  const i = document.querySelectorAll('input[type="date"]');
  return i.length > 1 ? i[i.length - 2].value : null;
});
if (cheapestIso && cheapestIso < today) fail.push(`optimizer window opens in the past (${cheapestIso})`);
console.log('    window does not open before today:', !cheapestIso || cheapestIso >= today);

// --- The plan-year boundary changes the answer ---
await change().click(); await p.waitForTimeout(200);
await pick('Where your coverage comes from').selectOption('employer-other');
await p.waitForTimeout(150);
await sel('Plan year start month').selectOption('7');
await p.waitForTimeout(150);
const july = await run('july plan year');
console.log(`    January ${total1}  vs  July ${july}`);
if (july === total1) fail.push('changing the plan-year boundary did not change the estimate');

// --- Other regimens ---
await change().click(); await p.waitForTimeout(200);
await sel('Plan year start month').selectOption('1');
await pick('Where your coverage comes from').selectOption('employer-calendar');
await p.waitForTimeout(150);
await pick('Regimen').selectOption('ac-t');
await run('ac-t');
await change().click(); await p.waitForTimeout(200);
await pick('Diagnosis').selectOption('colorectal-cancer');
await p.waitForTimeout(150);
await run('folfox');

// --- Empty aid state ---
await change().click(); await p.waitForTimeout(200);
await num('Annual household income').fill('900000');
await run('no-aid');
const empty = await p.locator('text=/No programs in this list matched/i').isVisible();
console.log('    empty state shown:', empty);
if (!empty) fail.push('empty state not shown at $900k income');

// --- Reset restores every field and clears errors (self-contained) ---
await p.goto(BASE, { waitUntil: 'networkidle' });
const disabledAtDefaults = await reset().isDisabled();
await num('Deductible').fill('-999');
await num('Annual household income').fill('85500');
await pick('Diagnosis').selectOption('colorectal-cancer');
await p.waitForTimeout(250);
const erroredBefore = await countErrors();
const enabledAfterEdit = !(await reset().isDisabled());
await reset().click();
await p.waitForTimeout(400);
const restored = {
  ded: await num('Deductible').inputValue(),
  inc: await num('Annual household income').inputValue(),
  dx: await pick('Diagnosis').inputValue(),
};
const alertsAfter = await countErrors();
console.log(`Reset — disabled at defaults=${disabledAtDefaults}, enabled after edit=${enabledAfterEdit}, errors ${erroredBefore}->${alertsAfter}, restored=${JSON.stringify(restored)}`);
if (!disabledAtDefaults) fail.push('Reset was enabled on a freshly loaded form');
if (!enabledAfterEdit) fail.push('Reset stayed disabled after editing a field');
if (erroredBefore === 0) fail.push('test setup produced no error to clear');
if (alertsAfter !== 0) fail.push('validation errors survived Reset');
if (restored.ded !== '3000' || restored.inc !== '85000' || restored.dx !== 'breast-cancer') {
  fail.push(`Reset did not restore defaults: ${JSON.stringify(restored)}`);
}

// --- Browser Back / Forward / reload ---
await submit().click(); await p.waitForTimeout(350);
await p.goBack(); await p.waitForTimeout(350);
const backToForm = await submit().isVisible();
await p.goForward(); await p.waitForTimeout(350);
const fwdToResults = !!(await headline());
console.log(`Navigation — Back to form: ${backToForm}, Forward to results: ${fwdToResults}`);
if (!backToForm) fail.push('browser Back did not return to the form');
if (!fwdToResults) fail.push('browser Forward did not return to results');

await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(350);
const survived = !!(await headline());
console.log('    results survive a reload:', survived);
if (!survived) fail.push('reloading a results URL lost the estimate');

// --- "Change inputs" reachable from the bottom of a long page ---
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(250);
const reachable = await change().evaluate(el => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight;
});
console.log('    Change inputs on screen at page bottom:', reachable);
if (!reachable) fail.push('Change inputs is not reachable when scrolled to the bottom');

// --- Validation blocks submit with a visible message ---
await change().click(); await p.waitForTimeout(200);
await num('Out-of-pocket max').fill('1000'); // below the deductible
await p.waitForTimeout(200);
const msg = await p.locator('text=/below the deductible/i').isVisible();
const disabled = await submit().isDisabled();
console.log(`Validation — message=${msg} submit disabled=${disabled}`);
if (!msg || !disabled) fail.push('OOP-max validation did not block submit');

await b.close();
console.log(fail.length ? `\nFAILURES:\n- ${fail.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(fail.length ? 1 : 0);
