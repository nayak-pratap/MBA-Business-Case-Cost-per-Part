# Worked example

The page loads with these numbers so you can see it work. All figures are synthetic and in rupees.

## Inputs

| | Current tool | Proposed tool |
|---|---|---|
| Insert price | 450 | 600 |
| Edges per insert | 4 | 4 |
| Parts per edge (tool life) | 20 | 35 |
| Cycle time (min per part) | 4.0 | 3.8 |
| Tool change time (min per edge change) | 2 | 2 |

Machine rate 30 per minute and the machine is the bottleneck. Volume 60,000 parts a year. One-time cost 150,000. Trial of the proposed tool: 5 edges tested, standard deviation 6, 95% confidence.

## Cost per part

| Per part | Current | Proposed | Saved |
|---|---|---|---|
| Machine time (30 x cycle time) | 120.00 | 114.00 | 6.00 |
| Insert (price / (edges x life)) | 5.63 | 4.29 | 1.34 |
| Tool change (30 x 2 / life) | 3.00 | 1.71 | 1.29 |
| **Cost per part** | **128.63** | **120.00** | **8.63** |

## Decision metrics

- Annual saving: 8.625 x 60,000 = **517,500**
- Break-even: 150,000 / 8.625 = **17,391 parts**
- Payback: 17,391 / (60,000 / 12) = **3.5 months**
- Margin of safety: (60,000 - 17,391) / 60,000 = **71%**

## How firm is it?

With 5 edges the t value (4 degrees of freedom, 95%) is 2.776, so the half-width is 2.776 x 6 / sqrt(5) = 7.45. The interval for parts per edge is **27.55 to 42.45**.

| Case | Parts per edge | Cost per part | Saving per part | Break-even |
|---|---|---|---|---|
| Pessimistic | 27.55 | 121.62 | 7.00 | 21,421 parts |
| Expected | 35.00 | 120.00 | 8.63 | 17,391 parts |
| Optimistic | 42.45 | 118.95 | 9.68 | 15,499 parts |

The saving survives the pessimistic case and break-even is well inside a year, so the verdict is **Go**.

## What the example teaches

**Most of the saving is cycle time.** About 70% of the 8.63 comes from the 0.2 minute shorter cycle (6.00 of 8.63). Tool life, the thing the trial measured, accounts for the other 2.63. The sensitivity table shows the same thing: a 10% error in either cycle time is worth roughly 11 to 12 per part, more than the whole saving. Measure the cycle times, do not quote them.

**It only counts if the machine is the bottleneck.** Switch the bottleneck setting off and machine time stops counting as money. Only the insert cost differs: 5.63 against 4.29, a saving of 1.34 per part. Break-even becomes 112,000 parts, almost two years of volume, and the verdict changes to **Conditional** because payback is beyond a year.

**A noisier trial changes the answer.** Keep everything else and raise the trial standard deviation from 6 to 25. The interval widens to about 4.0 to 66.0 parts per edge, the pessimistic case now costs more per part than the current tool, and the verdict becomes **Conditional**. The calculator estimates that the saving only disappears if tool life falls below 14.4 parts per edge, and that testing about 4 more edges (9 in all) should settle it, if the spread stays similar.

## Reproduce it

```
npm test
```

runs `tests/calc.test.js`, which checks every number on this page.
