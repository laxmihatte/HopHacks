# AcuGuide AI

Describe a symptom in plain words; the app shows you **where** to press on a 3D
human body, **how hard**, and **at what rhythm**.

```bash
npm install
npm run dev          # http://localhost:3000
```

No API key is required to run the demo. See *Routing* below.

## How it works

```
symptom text ──▶ /api/recommend ──▶ Claude (closed-set classifier)
                       │                  └─▶ ids only: ["LI4","GB20"]
                       │
                       ├─▶ lib/router.ts   (offline keyword matcher, the fallback)
                       │
                       └─▶ data/acupoints.json ──▶ full point text ──▶ UI
```

The model **never writes medical text.** Its entire output is a list of ids
drawn from a five-item enum, enforced by a tool schema. Every word of location
and technique the user reads is looked up from `data/acupoints.json` after the
call. A hallucination can therefore only ever produce a wrong-but-safe point,
never invented instructions.

### Routing

| `ANTHROPIC_API_KEY` | Behaviour |
| --- | --- |
| unset | `lib/router.ts` matches symptoms directly. Fully offline. |
| set | `claude-haiku-4-5` routes; the matcher still catches an empty, malformed, timed-out or errored response. |

The UI says which one produced the answer — there is no silent downgrade. This
is deliberate: a hackathon venue's wifi should not be able to break the demo.

## The 3D body

There is no `.glb`. The figure is generated from `lib/anatomy.ts`, and the
acupoint coordinates are expressed against **the same landmarks** that build
it — `PC6` is literally "two cun above `WRIST`". `lib/__tests__/anatomy.test.ts`
fails the build if a point leaves the body it is supposed to sit on.

That removes the usual "tweak X/Y/Z for hours against a downloaded model" step,
and it is why switching between the male and female build is safe: both use the
same limb and skull landmarks and differ only in trunk silhouette, so a point
cannot move. The rehearsal asserts this directly (max drift `0.00px`).

## Pressure depth

Depth is an ordinal quantity, so it is drawn as a **sequential ramp**: one hue
(rose), four steps, light → deep. Lightness carries the magnitude, which means
the order survives greyscale, a washed-out projector and colour-vision
deficiency. It is never colour-alone — depth is also carried by ring thickness,
a text label on the marker, and a named force description in the panel.

| Step | Used by | Why |
| --- | --- | --- |
| Light | SP6 | Thin tissue directly over bone |
| Moderate | PC6 | Between tendons, on the forearm |
| Firm | LI4, GB20 | Muscle belly and suboccipital hollow |
| Deep | ST36 | Belly of tibialis anterior |

## Verifying it

```bash
npm test             # 81 unit tests
npm run rehearse     # drives the Golden Path in a real browser
```

`npm run rehearse` needs a Chromium binary and a running dev server:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  BASE_URL=http://localhost:3000 npm run rehearse
```

It walks every beat of the pitch — query, scan, reveal, auto-pan, panel,
metronome phases — screenshots each one, and checks the things that have
actually broken before: WebGL context loss, markers drifting off the anatomy,
and the router inventing a point for a query that matches nothing.

## Not medical advice

Acupressure is a self-care practice. The app says so on every point, flags the
two points contraindicated in pregnancy (`LI4`, `SP6`), and tells the user to
stop if pressing hurts.
