# Spec: Cost-per-Part Business Case Calculator

**Repo:** `MBA-Business-Case-Cost-per-Part` | **Status:** v0.2, decisions recorded and version 1 built | **Author:** Pratap Nayak

## 1. Purpose

Turn a cutting-tool trial into a go/no-go financial decision. The user enters the cost and performance of the current tool and a proposed tool. The calculator returns cost per part for both, the saving, the break-even volume, and whether the decision still holds once the uncertainty in the trial data is taken into account.

**One-line pitch:** "From 'this grade lasts longer' to 'this saves X per part and pays back in Y parts', with a confidence check."

## 2. Who it is for

| User | Question they bring |
|---|---|
| Applications / process engineer | Is the new grade worth recommending, and how do I show it? |
| Plant or production manager | Will it pay back, and is the trial evidence strong enough to approve? |
| Finance partner | What is the break-even volume and how sensitive is the case? |
| Recruiter or hiring manager reading the repo | Can this person connect engineering data to a financial decision? |

## 3. Scope

**Version 1 (build this)**
- Cost per part for two tool options (current vs proposed)
- Saving per part, annual saving, one-time cost, break-even parts, payback months, margin of safety
- Confidence interval on tool life from trial data, flowing through to a pessimistic and optimistic case
- Bottleneck switch: is cycle-time saving worth money on this machine?
- Required trial sample size (a "Plan a trial" panel) and a sensitivity table that flexes each input by 10%
- Plain-language verdict: Go / Conditional / No-go
- Single page, works on a phone at the machine, no login, no backend, selectable currency symbol (default ₹)

**Not in version 1 (parked)**
- NPV / IRR (time value of money is not covered in Trimester I; add in v2 once the finance material is covered)
- Speeds, feeds, power and tool-life models (separate calculators in the same repo)
- Saving and loading cases, PDF export, multi-operation parts

## 4. Inputs

All money in a user-selectable currency symbol (default ₹). All times in minutes.

| Group | Field | Notes |
|---|---|---|
| Machine | Machine rate (per min) | Fully loaded rate, not just labour |
| Machine | Bottleneck? (yes / no) | If no, cycle-time saving is valued at the *time value factor* below |
| Machine | Time value factor (0 to 1) | Default 1 if bottleneck, 0 if not; user can override |
| Current tool | Insert price | Per insert |
| Current tool | Edges per insert | Usable cutting edges |
| Current tool | Parts per edge (tool life) | Mean from history |
| Current tool | Cycle time per part | Includes cutting and non-cutting time |
| Current tool | Tool change time | Per edge change |
| Proposed tool | Same five fields as above | |
| Volume | Annual part volume | |
| One-time cost | Requalification / trial / programming | Treated as the amount to recover |
| Trial data (optional) | n edges tested, standard deviation | Enables the confidence module. The trial mean is the proposed tool's parts per edge, so the two can never disagree |
| Settings | Confidence level (90 / 95 / 99%) | Default 95% |

## 5. Calculation modules

### Module A: Cost per part

```
Machine cost per part     = R x cycle_time
Tool cost per part        = insert_price / (edges_per_insert x parts_per_edge)
Tool change cost per part = R x tool_change_time / parts_per_edge
Cost per part (CPP)       = machine + tool + tool change
```

Where the machine is not the bottleneck, the machine and tool-change terms use `R x time_value_factor` instead of `R`.

Cost-driver view (ties to activity-based costing): report the three components separately so the user sees *which driver* produces the saving.

### Module B: Decision metrics

```
Saving per part       = CPP_current - CPP_proposed
Annual saving         = saving_per_part x annual_volume
Break-even parts      = one_time_cost / saving_per_part
Payback (months)      = break_even_parts / (annual_volume / 12)
Margin of safety      = (annual_volume - break_even_parts) / annual_volume
```

If saving per part is zero or negative, break-even is shown as "not reached" rather than a number. Sunk cost of existing tooling inventory is deliberately excluded (only future, differing costs count).

### Module C: Confidence on trial data

Tool life from a small trial is uncertain, so the calculator uses the t-distribution (sigma is unknown):

```
CI for mean parts per edge = x_bar +/- t(alpha/2, df = n-1) x s / sqrt(n)
```

The low and high ends of the interval are run back through Modules A and B to give a **pessimistic case** (low end of the interval) and an **optimistic case** (high end).

Sample-size helper (from the course formula, with a note that it assumes a normal distribution and a rough sigma):

```
n = (Z(alpha/2) x sigma / E)^2     # edges needed to estimate mean life within +/- E
```

### Module D: Verdict

| Condition | Verdict |
|---|---|
| Saving positive in the pessimistic case, and break-even inside the planning horizon | **Go** |
| Saving positive on the mean but not in the pessimistic case (or the interval reaches zero life) | **Conditional**: test more edges (shows the sample-size answer) |
| Saving positive across the interval, but break-even needs more than a year of volume | **Conditional**: payback is beyond the horizon, so more testing will not help |
| Saving positive on the mean, but no trial data entered | **Conditional**: uncertainty not assessed |
| Saving zero or negative on the mean | **No-go** |

The planning horizon is one year of volume, applied to the expected case. The two extra Conditional rows were added during the build: they cover cases the first draft left undefined.

## 6. Outputs

1. Side-by-side table: cost per part by component, current vs proposed
2. Headline numbers: saving per part, annual saving, break-even parts, payback months, margin of safety
3. Three-case strip: pessimistic, expected, optimistic
4. Verdict with a one-sentence reason
5. "Edges to test" recommendation when the verdict is Conditional because of uncertainty
6. Go/no-go gauge: the saving range against the break-even line
7. Sensitivity table: payback when each input moves by 10%
8. Plain-text summary the user can paste into an email or report

## 7. Worked example (verified in code)

Inputs: machine rate 30/min; current insert 450, 4 edges, 20 parts per edge, 4.0 min cycle; proposed insert 600, 4 edges, 35 parts per edge, 3.8 min cycle; 2 min tool change on both; 60,000 parts per year; one-time cost 150,000. Trial: n = 5, mean 35, s = 6, 95% confidence.

| Result | Expected value |
|---|---|
| CPP current | 128.625 |
| CPP proposed | 120.000 |
| Saving per part | 8.625 |
| Annual saving | 517,500 |
| Break-even parts | 17,391 |
| Payback | 3.5 months |
| Margin of safety | 71.0% |
| t critical (df = 4) | 2.776 |
| 95% CI for parts per edge | 27.55 to 42.45 |
| CPP proposed at pessimistic life (27.55) | 121.62 |
| Saving per part, pessimistic | 7.00 |
| Break-even parts, pessimistic | about 21,421 |
| Verdict | Go |

Use these as the first automated test cases.

## 8. Pressure test: weaknesses to design around

1. **Small trials and skewed data.** Tool life is often skewed (closer to a Weibull shape than a normal one), and n = 5 is thin. The tool must display a warning when n < 10 and say the interval is approximate.
2. **Only one input is uncertain in the model.** Price, cycle time and volume are treated as exact. Add a simple sensitivity table (plus or minus 10% on each input) so the user sees which input moves the answer most.
3. **The current tool's life is also an estimate.** v1 treats it as fixed. v1.1 should accept trial data for both tools and use a two-sample (Welch) interval.
4. **Cycle-time savings are only real at a bottleneck.** The bottleneck switch handles this, and the verdict text must say which assumption was used.
5. **Machine rate definition varies by company.** Add a tooltip: use the fully loaded rate your finance team uses for decisions, and state it with the result.
6. **Employer overlap.** Use only synthetic or public numbers, label it an educational framework, and confirm your employment policy before publishing. Keep company names and customer data out of the repo.
7. **Correctness on the shop floor.** The README disclaimer applies: verify against manufacturer recommendations. The tool makes an *economic* comparison, not a cutting-condition recommendation.

## 9. Technical approach

- Single static page: `index.html` with vanilla JavaScript, no framework, no build step
- Mobile-first layout, large tap targets, works offline once loaded
- t-distribution critical values by a small tested function (avoid a heavy library)
- Hosted free on GitHub Pages
- Pure calculation functions kept in `calc.js`, separate from the UI, so they can be tested and reused in the Six Sigma toolkit
- Tests in `tests/calc.test.js` using the worked example and edge cases (zero saving, negative saving, n = 2, volume below break-even)

## 10. Repo layout

```
MBA-Business-Case-Cost-per-Part/
  README.md                  # what it is, worked example, how to run, disclaimer
  package.json               # npm test runs the unit tests
  LICENSE                    # MIT
  index.html                 # page and styles
  app.js                     # reads the form, draws the results
  calc.js                    # pure calculation engine, no DOM
  tests/calc.test.js         # 25 tests, including the section 7 example
  docs/
    SPEC.md                  # this document
    method.md                # formulas, assumptions, limits
    worked-example.md        # the example in section 7
    course-links.md          # which MBA concepts it applies, in plain words
```

## 11. Milestones

| Step | Deliverable | Definition of done |
|---|---|---|
| 1 | `calc.js` plus tests | All section 7 values reproduced |
| 2 | UI with Modules A and B | Matches the worked example on a phone-width screen |
| 3 | Confidence module and verdict | Pessimistic, expected and optimistic cases shown |
| 4 | Docs and README | A new reader can run the example in under two minutes |
| 5 | Publish and link from profile README | Status changes from Planned to Live |

## 12. Decisions

1. Currency: selectable symbol, default ₹ (Indian digit grouping is used when ₹ is selected).
2. One-time cost: a single field.
3. Two-sample (Welch) comparison: kept for v1.1.
4. Name: Cost-per-Part Business Case.
5. Repository name: `MBA-Business-Case-Cost-per-Part`, with the tool at the repo root (flat layout) so GitHub Pages serves it directly.
