import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH,
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1440, height: 940 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector("canvas");
await p.waitForTimeout(3500);
const ids = () => p.evaluate(() => [...document.querySelectorAll(".hotspot")]
  .map(el => ({ id: el.querySelector(".hotspot-tag")?.firstChild?.textContent?.trim(),
                w: Math.round(el.getBoundingClientRect().width) }))
  .filter(m => m.w > 0).map(m => m.id));
console.log("visible at home view:", (await ids()).join(" "));
await p.getByLabel("Describe your symptoms").fill("motion sickness");
await p.getByRole("button", { name: /Find points/i }).click();
await p.waitForTimeout(3400);
console.log("visible focused on PC6:", (await ids()).join(" ") || "(none)");
await p.locator(".stage").screenshot({ path: "/tmp/acuguide/p-pc6.png" });
await b.close();
