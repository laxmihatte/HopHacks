import { chromium } from 'playwright-core';
const out = process.env.SHOT_DIR ?? '/tmp';
const exe = process.env.CHROME_PATH || undefined;
const b = await chromium.launch({ executablePath: exe });
const ctx = await b.newContext({ viewport: { width: 1180, height: 1000 } });
const p = await ctx.newPage();
const fail = [];

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
await p.goto('http://localhost:3847/', { waitUntil: 'networkidle' });
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

// --- Validation: OOP max below deductible blocks submit ---
await p.getByRole('button', { name: /Change inputs/i }).click();
await p.waitForTimeout(200);
await p.fill('input[type="number"] >> nth=2', '1000'); // oopMax
await p.waitForTimeout(150);
const msg = await p.locator('text=/cannot be below the deductible/i').isVisible();
const disabled = await p.getByRole('button', { name: /Estimate my cost/i }).isDisabled();
console.log(`Validation: message=${msg} submit disabled=${disabled}`);
if (!msg || !disabled) fail.push('OOP-max validation did not block submit');

await b.close();
console.log(fail.length ? `\nFAILURES:\n- ${fail.join('\n- ')}` : '\nALL CHECKS PASSED');
process.exit(fail.length ? 1 : 0);
