# Out-of-Pocket Cost Estimator & Aid Navigator

Takes a patient's diagnosis, regimen, insurance terms and household income, and returns
a cycle-by-cycle out-of-pocket projection plus a ranked list of assistance programs they
are eligible for. Every dollar figure traces to a published federal source.

Built to the *Out-of-Pocket Cost Estimator & Aid Navigator — Product & Technical
Requirements* (2026-09-19).

## Run it

```bash
npm install
npm test          # 98 tests — engine, plan year, optimizer, matcher, validation, data
npm run dev       # http://localhost:3000
```

The form is pre-filled with the demo input, so the first screen is never empty: press
**Estimate my cost** and the result renders.

```bash
npm run build     # fully static; no API routes, no server actions
npm run rehearse  # drives the demo end to end twice in a real browser (S5)
```

`npm run rehearse` needs a Chromium binary. Point it at one:

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run rehearse
```

## Demo script

| Field | Value |
|---|---|
| Diagnosis | Breast cancer |
| Regimen | TCHP |
| Start date | 2026-10-15 |
| Insurance | Commercial |
| Deductible | $3,000 |
| Coinsurance | 20% |
| OOP max | $9,000 |
| Household size | 4 |
| Income | $85,000 |

Expected output — know these numbers before they appear:

- **$63,978** billed across 6 cycles
- **$15,665** out-of-pocket before aid
- **$3,665** after aid ($12,000 covered by the largest matching fund)
- **8** matching assistance programs
- Household is **258%** of the 2026 federal poverty guideline ($33,000 for a household of 4)
- Plan year resets **January 1, 2027**, mid-treatment — the deductible and the
  out-of-pocket maximum are both charged twice

Beats: state the problem → enter inputs live → land on the chart and point at the
January step → point at the gap between the curves → name a limitation before being
asked → close on the navigator pilot.

## The plan year is not always January 1

Almost every cost tool hardcodes a January 1 reset. That is correct for Medicare and for
marketplace plans, which are regulated to the calendar year — but an **employer** plan
follows the *employer's* benefit year, and July 1 and October 1 are both common. The
insurance company's name tells you nothing about it: the same insurer resets in January
for one member and July for another.

It is not a footnote. On the demo input, the boundary alone is the difference between
**$15,665 and $9,000** for identical treatment:

| Plan year starts | Patient pays | Why |
|---|---|---|
| January 1 | $15,665 | Treatment crosses the boundary; deductible and OOP max charged twice |
| July 1 | $9,000 | The same October–February course never crosses a July boundary |

`data/plan-years.json` holds seven coverage profiles with what is *regulated*, what is
merely *common*, and what genuinely *varies* — plus where to look it up. It never asserts
a reset date it cannot know; for an employer plan it tells you to ask HR.

## Smart start date

If the oncologist allows any window, the cheapest day to begin is worth real money. The
optimizer prices **every candidate date** in the window with the same engine the main
estimate uses — each point on the curve is a full cycle-by-cycle simulation, so there is
nothing to approximate and nothing to hallucinate.

On the demo input it finds **January 1, 2027, saving $6,665** against an October 15 start.

Three rules keep it honest:

- **Ties go to the earliest date.** Delaying treatment carries clinical risk this tool
  does not model, so it never recommends a later date for the same money.
- **The window never opens in the past.** A date that has already gone is not a choice.
- **It is a solver, not a model.** `lib/optimizer.ts` is a deterministic sweep; the tests
  assert every point matches a direct `estimate()` call exactly.

## Architecture

Next.js app router, Tailwind, TypeScript. Everything client-side. No database, no auth,
no API layer, no runtime fetching — the three data files are imported at build time.

```
lib/calculator.ts   gross cost, patient share, plan-year reset, cycle schedule
lib/optimizer.ts    start-date sweep — prices every candidate date
lib/matcher.ts      FPL percentage, eligibility filter, ranking, aid application
lib/validation.ts   field rules shared by the form and the engine
lib/url.ts          form state <-> query string, so links and Back/Forward work
lib/types.ts        shared interfaces
components/*        everything visual
data/*.json         regimens, programs, poverty guidelines, plan-year profiles
```

The two `lib` modules import nothing from React. That rule is what makes the test suite
possible: if a calculation needs component state to run, it is in the wrong file.

### Cost engine

Per cycle, in this order — the order is not interchangeable:

1. **Deductible.** The patient pays the lesser of the remaining deductible and the gross cost.
2. **Coinsurance.** On whatever gross cost remains, at the plan's rate.
3. **Out-of-pocket maximum.** The sum is capped so cumulative spend for the plan year
   never exceeds the max.

Gross cost per cycle is `sum over drugs of ceil(dose / billingUnit) * paymentLimit`, plus
a flat administration figure. The ceiling is load-bearing: drugs bill in whole units, so a
partial unit rounds up.

**Plan-year reset.** Before applying a cycle, if its date falls in a later plan year than
the previous cycle, both accumulators are zeroed. The boundary is configurable, not
assumed. This is the differentiator — most cost calculators ignore it, and it is the
single largest controllable swing in a patient's total cost. A patient starting TCHP in
October pays $15,665; the same patient starting January 1 pays $9,000. Identical
diagnosis, identical regimen, $6,665 of difference from the calendar alone.

Dates are handled in UTC throughout, so a browser timezone can never shift a cycle across
the boundary.

### Aid matching

A program matches when all four hold: the household is at or below the fund's FPL gate,
the fund covers the diagnosis (or is diagnosis-agnostic), the fund accepts the patient's
insurance type, and the fund is open. Matches are ranked by award cap descending.

**Only the single largest award cap is applied to the after-aid curve — caps are never
summed.** Programs frequently cannot be stacked, and a summed figure would overstate
relief. One principle governs every ambiguous modeling choice: *never overstate relief.* A
patient told they will owe less than they do has been harmed by the tool; one told they
might owe more has merely been over-prepared.

## Data sources

| Source | Supplies | Retrieved |
|---|---|---|
| [CMS Medicare Part B Drug Payment Limit File](https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files) | Per-unit payment limit by HCPCS code | October 2026 file (effective Oct 1 – Dec 31, 2026; ASP methodology on 2Q26 data) |
| [HHS poverty guidelines](https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines) | Income thresholds gating aid eligibility | 2026 guidelines, effective Jan 13, 2026 |
| Program websites | Eligibility rules, award caps | Hand-curated, dated per record |

### Codes actually used

Two of the J-codes named in older guides no longer exist in the current file — this is the
trap the PRD warns about, and it is real:

| Drug | Code | Unit | Limit |
|---|---|---|---|
| Doxorubicin HCl | J9000 | 10 mg | $3.120 |
| Cyclophosphamide (NOS) | **J9075** | 5 mg | $0.692 |
| Paclitaxel | J9267 | 1 mg | $0.108 |
| Oxaliplatin | J9263 | 0.5 mg | $0.087 |
| Leucovorin calcium | **J0643** | 1 mg | $0.054 |
| Fluorouracil | **J9192** | 10 mg | $0.039 |
| Docetaxel | J9171 | 1 mg | $0.471 |
| Carboplatin | J9045 | 50 mg | $3.101 |
| Trastuzumab (excl. biosimilar) | J9355 | 10 mg | $68.871 |
| Pertuzumab | J9306 | 1 mg | $17.269 |

`J9070` (cyclophosphamide) and `J9190` (fluorouracil) are **absent** from the October 2026
file. Cyclophosphamide is now billed per 5 mg, not per 100 mg. Where a drug has both a
generic (NOS) code and a brand-specific one, the generic is used — the brand codes run
100x to 380x higher and would not reflect what is typically billed.

## Requirements coverage

All P0 and P1 requirements ship. P2 was abandoned as planned.

| | Requirement | Status |
|---|---|---|
| FR-1 – FR-4 | Regimen, insurance terms, household, start date inputs | ✅ |
| FR-5 – FR-7 | Gross cost, deductible/coinsurance/cap, plan-year reset | ✅ |
| FR-8 – FR-9 | FPL percentage, program filter | ✅ |
| FR-10 – FR-12 | Cost chart, after-aid overlay, reset marked | ✅ |
| FR-13 – FR-14 | Program cards with `lastVerified`, persistent disclaimer | ✅ |
| FR-15 – FR-17 | Cycle table, ranking, insurance-type selector | ✅ (P1) |
| FR-18 – FR-20 | Delay-start toggle, shareable URL, third regimen | **all three shipped** — FR-18 became the start-date optimizer |

| | Success criterion | Status |
|---|---|---|
| S1 | Every price traces to the current-quarter CMS file | ✅ `sourceNote` on every regimen |
| S2 | Calculator passes the three-case test suite | ✅ 32 tests, written before the UI |
| S3 | Plan-year reset produces a visible step in the chart | ✅ demo input crosses Jan 1 |
| S4 | At least 10 real programs with real thresholds | ✅ 14 programs, 2 currently closed |
| S5 | Demo runs end to end twice without intervention | ✅ `npm run rehearse` |

## Deliberately absent

No database, no authentication, no API layer, no state library, no component library, no
error boundaries beyond parsing, no responsive design past "it doesn't break on the
projector." Network status, prior authorization and drug tiering are not modeled. No
hospital-specific pricing. No scraping. No accounts and no persistence — state lives in
React for the session, and the tool collects no identifiers, stores nothing and transmits
nothing.

Every one of these is a defensible cut, and each is stated in the product's own
assumptions block, not only here.

## Input validation

The UI owns validation; native constraint validation is turned off (`noValidate`) so
the submit button and the browser can never disagree. `lib/validation.ts` is shared by
the form and the engine:

- Money fields accept any real value — `step="any"`, not round hundreds. A $1,750
  deductible, $85,500 income and 17.5% coinsurance are all normal and all enterable.
- A blank field is missing, not zero, and says so per field.
- Dates are round-trip checked, so `0050-01-01` cannot become 1950 and `2026-13-45`
  cannot roll forward to 2027-02-14.
- The engine independently rejects what the UI should never send (`InvalidInputError`),
  and the page wraps the call so a guard renders a message rather than a blank screen.

## Two deviations from the PRD

1. **`drugs[].cycles`** was added to the regimen schema. The PRD assumes one flat drug
   list per regimen, but AC-T is sequential — doxorubicin and cyclophosphamide in cycles
   1–4, paclitaxel in cycles 5–8. A flat list would bill all three drugs in all eight
   cycles and overstate gross cost by roughly 2x. Omitting the field means "every cycle."

2. **A third regimen (TCHP) was added** and is the demo default. See below.

## One judgement call worth knowing about

Award caps are **annual**, but this tool applies the largest matching cap **once** across
the whole course of treatment, even when treatment crosses a plan year. On the demo
input that is the difference between showing $3,665 and showing $0.

The conservative figure is shown deliberately. Renewal in a second plan year depends on
the fund still being open and the patient still qualifying, and the PRD's governing
principle is *never overstate relief*. The assumption is now stated in the product's
assumptions block and on the program list, not just here. To change it, apply the cap
per plan year in `applyAid` (`lib/matcher.ts`).

## The one thing the PRD got wrong

The two regimens the PRD names are generic cytotoxics, and they are cheap:

| Regimen | Total billed | Patient pays (demo plan) |
|---|---|---|
| AC-T | $2,551 | $2,551 |
| FOLFOX | $3,965 | $3,965 |
| **TCHP** | **$63,978** | **$15,665** |

AC-T and FOLFOX never reach the deductible, let alone the out-of-pocket maximum. The
plan-year reset is invisible on them and the after-aid curve sits at zero, because the
largest matching fund's cap exceeds the entire cost of treatment. The problem statement's
"six-figure billed charges" and "five figures of out-of-pocket cost" do not come from
generic chemotherapy — they come from biologics.

TCHP (docetaxel + carboplatin + **trastuzumab** + **pertuzumab**) was added because it is
the regimen that actually demonstrates what the tool is for. Trastuzumab and pertuzumab
alone are $10,146 of the $10,663 billed per cycle. All three regimens ship; TCHP is the
default.
