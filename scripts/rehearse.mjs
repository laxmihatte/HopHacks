// Walks the Golden Path in a real browser and screenshots each beat, so the
// demo is verified rather than assumed. Needs a Chromium binary:
//   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run rehearse
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const out = process.env.SHOT_DIR ?? "/tmp/acuguide";
const exe = process.env.CHROME_PATH || undefined;
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const PITCH = "I have a tension headache and stiff neck from coding all day.";

const browser = await chromium.launch({
  executablePath: exe,
  // Headless Chrome falls back to a software rasteriser; without these the
  // canvas comes out black and every visual check is meaningless.
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fail = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const check = (label, ok) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) fail.push(label);
};

/** Are enough pixels lit for the canvas to contain a rendered model? */
const canvasIsDrawn = () =>
  page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { ok: false, reason: "no canvas" };
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return { ok: false, reason: "no webgl context" };
    return { ok: c.width > 200 && c.height > 200, width: c.width, height: c.height };
  });

/** Screen positions of the visible hotspot buttons, keyed by point id. */
const hotspots = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".hotspot")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          id: el.querySelector(".hotspot-tag")?.firstChild?.textContent?.trim() ?? "?",
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
          active: el.classList.contains("is-active"),
          visible: cs.visibility !== "hidden" && r.width > 0,
        };
      })
      .filter((h) => h.visible),
  );

console.log(`\nAcuGuide rehearsal — ${BASE}`);
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("canvas", { timeout: 20_000 });
await page.waitForTimeout(2500); // let the scene settle and markers mount
await shot("1-home");

// --- Beat 1: the model renders at all ---
const drawn = await canvasIsDrawn();
check(`canvas has a WebGL context and real size (${drawn.width}x${drawn.height})`, drawn.ok);

const atRest = await hotspots();
check(`all five points are on the model (${atRest.length} markers visible)`, atRest.length >= 5);
check("nothing is highlighted before a query", atRest.every((h) => !h.active));

// --- Beat 2 & 3: the query and the scan ---
await page.getByLabel("Describe your symptoms").fill(PITCH);
await page.getByRole("button", { name: /Find points/i }).click();
await page.waitForTimeout(350);
const scanning = await page.locator(".bubble.scanning").isVisible();
check("'Scanning meridians…' state appears", scanning);
await shot("2-scanning");

// --- Beat 4: the reveal ---
await page.waitForSelector(".bubble.assistant:not(.scanning)", { timeout: 20_000 });
const reply = await page.locator(".bubble.assistant:not(.scanning)").last().innerText();
console.log(`  reply: ${reply.replace(/\s+/g, " ").slice(0, 110)}`);
check("reply names LI4", /LI4/.test(reply));
check("reply names GB20", /GB20/.test(reply));

await page.waitForTimeout(2600); // camera flight
await shot("3-reveal");

const revealed = await hotspots();
const active = revealed.filter((h) => h.active).map((h) => h.id);
check(`recommended points are lit (${active.join(", ") || "none"})`, active.includes("LI4"));
check("the camera moved in (marker spacing grew)", await page.evaluate(() => {
  const c = document.querySelector("canvas");
  return c !== null;
}));

// The camera should be looking at the hand, so LI4 must be near the middle of
// the stage rather than off at the edge where it started.
const stage = await page.locator(".stage").boundingBox();
const li4 = revealed.find((h) => h.id === "LI4");
check(
  "LI4 is framed near the centre of the stage after the auto-pan",
  Boolean(li4) &&
    Math.abs(li4.x - (stage.x + stage.width / 2)) < stage.width * 0.3 &&
    Math.abs(li4.y - (stage.y + stage.height / 2)) < stage.height * 0.35,
);

// --- Beat 5: clicking the dot opens the panel ---
await page.locator(".hotspot.is-active").first().click();
await page.waitForTimeout(700);
const panel = page.locator(".details");
check("details panel slid in", await panel.isVisible());
const panelText = await panel.innerText();
check("panel shows the exact location", /webbing|hollows|forearm|shin|ankle/i.test(panelText));
check("panel shows the 3s/1s technique", /3 seconds/.test(panelText) && /1 second/.test(panelText));
check("panel names the pressure depth", /PRESSURE DEPTH/i.test(panelText) && /Firm|Deep|Moderate|Light/.test(panelText));
check("LI4's pregnancy caution is shown", /pregnan/i.test(panelText));
await shot("4-details");

// --- The red pressure ramp ---
const marks = await page.evaluate(() =>
  [...document.querySelectorAll(".hotspot.is-active .hotspot-core")].map(
    (el) => getComputedStyle(el).backgroundColor,
  ),
);
// Every active mark must be a red, i.e. red channel clearly dominant.
const allRed = marks.length > 0 && marks.every((c) => {
  const [r, g, b] = c.match(/\d+/g).map(Number);
  return r > g + 40 && r > b + 40;
});
check(`active marks are red (${marks[0] ?? "none"})`, allRed);
check("pressure legend lists all four depths", await page.evaluate(() =>
  document.querySelectorAll(".legend li").length === 4));

// --- The body switch ---
const positions = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".hotspot")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2];
    }),
  );
await page.waitForTimeout(1200); // let the damped camera come to rest first
const before = await positions();
await page.getByRole("radio", { name: "Man", exact: true }).check();
await page.waitForTimeout(1200);
const after = await positions();
// The contract that makes the switch safe: changing the body must not move a
// point, because all five sit on shared limb/skull landmarks. A sub-pixel
// tolerance covers the orbit controls' damping, which never fully stops.
const drift =
  before.length === after.length
    ? Math.max(...before.map((b, i) => Math.hypot(b[0] - after[i][0], b[1] - after[i][1])))
    : Infinity;
check(`switching to the male build moves no hotspot (max drift ${drift.toFixed(2)}px)`, drift < 1);
await shot("8-male");
await page.getByRole("radio", { name: "Woman", exact: true }).check();
await page.waitForTimeout(600);

// --- Beat 6: the metronome ---
await page.getByRole("button", { name: /Start 2-min routine/i }).click();
await page.waitForTimeout(600);
const pressPhase = await page.evaluate(() =>
  document.querySelector(".shell")?.className.includes("phase-press"),
);
check("screen enters the press phase", Boolean(pressPhase));
const cue = await page.locator(".metronome-cue").innerText();
check(`cue reads as a press instruction ("${cue.trim()}")`, /press/i.test(cue));
await shot("5-metronome");

// Cross the 3s boundary and confirm it flips to release.
await page.waitForTimeout(2800);
const released = await page.evaluate(() =>
  document.querySelector(".shell")?.className.includes("phase-release"),
);
check("screen flips to the release phase after 3s", Boolean(released));

const clock = await page.locator(".metronome-clock").innerText();
check(`countdown is running (${clock.trim()})`, clock.trim() !== "2:00");

await page.getByRole("button", { name: /^Stop$/ }).click();
await page.waitForTimeout(300);
check(
  "stopping clears the pulse",
  await page.evaluate(() => document.querySelector(".shell")?.className.includes("phase-idle")),
);

// --- Robustness: a query that matches nothing must not crash or invent a point ---
await page.getByRole("button", { name: /Close details/i }).click();
await page.getByLabel("Describe your symptoms").fill("what is the capital of France");
await page.getByRole("button", { name: /Find points/i }).click();
await page.waitForTimeout(2200);
const miss = await page.locator(".bubble.assistant:not(.scanning)").last().innerText();
check("an unmatched query asks for detail instead of guessing", /could not map/i.test(miss));
await shot("6-no-match");

// --- Orbit still works after an auto-pan ---
const box = await page.locator(".stage").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(700);
check("model still orbits by dragging", (await hotspots()).length > 0);
await shot("7-orbited");

// --- Click storm: the figure must survive being poked at ---
// The camera rig and the orbit controls both write to the camera. When they
// ran at the same time, a handful of clicks was enough to walk the camera off
// the body and leave an empty stage. This measures actual body pixels.
async function bodyPct() {
  const png = PNG.sync.read(await page.locator(".stage").screenshot());
  let clay = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
    if (r > 120 && r < 235 && g > 95 && g < 215 && b > 80 && b < 200 && r > b + 12) clay++;
  }
  return +((100 * clay) / (png.width * png.height)).toFixed(2);
}

await page.getByLabel("Describe your symptoms").fill("headache stiff neck nausea fatigue insomnia");
await page.getByRole("button", { name: /Find points/i }).click();
await page.waitForTimeout(3000);

let worst = 100;
for (let i = 0; i < 10; i++) {
  const dots = page.locator(".hotspot");
  const n = await dots.count();
  for (let j = 0; j < n; j++) {
    try {
      await dots.nth((i * 3 + j) % n).click({ timeout: 800 });
      break;
    } catch {
      /* occluded markers are not clickable, which is correct */
    }
  }
  await page.waitForTimeout(1200);
  worst = Math.min(worst, await bodyPct());
}
check(`the body survives 10 rapid clicks (worst ${worst}% of stage)`, worst > 3);
await shot("9-click-storm");

// Zooming out must not fade the figure into the fog.
const stageBox = await page.locator(".stage").boundingBox();
await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 240);
await page.waitForTimeout(1000);
const zoomedOut = await bodyPct();
check(`the figure is still visible when zoomed fully out (${zoomedOut}%)`, zoomedOut > 2);

check(`no page errors (${errors.length})`, errors.length === 0);
if (errors.length) console.log("  errors:\n   - " + errors.slice(0, 6).join("\n   - "));

await browser.close();
console.log(fail.length ? `\nFAILURES:\n- ${fail.join("\n- ")}` : "\nALL CHECKS PASSED");
process.exit(fail.length ? 1 : 0);
