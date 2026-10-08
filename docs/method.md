# Method

How the Cost-per-Part Business Case Calculator reaches its answer, what it assumes, and where it can mislead you. Everything here is implemented in `calc.js` and covered by `tests/calc.test.js`.

## 1. Cost per part

```
Machine cost per part     = R x cycle_time
Tool cost per part        = insert_price / (edges_per_insert x parts_per_edge)
Tool change cost per part = R x tool_change_time / parts_per_edge
Cost per part             = machine + tool + tool change
```

- `R` is the effective machine rate: the machine rate you enter multiplied by the *share of machine time counted as money* (see section 5).
- One edge change happens every `parts_per_edge` parts, which is why the change time is divided by tool life.
- The three components are reported separately so you can see which one produces the saving.

## 2. Decision metrics

```
Saving per part  = cost_per_part_current - cost_per_part_proposed
Annual saving    = saving_per_part x parts_per_year
Break-even parts = one_time_cost / saving_per_part
Payback (months) = break_even_parts / (parts_per_year / 12)
Margin of safety = (parts_per_year - break_even_parts) / parts_per_year
```

- If the saving per part is zero or negative, break-even is shown as "Not reached" rather than a number.
- Margin of safety here is the share of a year's volume left after break-even. It goes negative when break-even needs more than a year of parts.
- The cost of tooling you already own is a sunk cost and is left out on purpose. Only future costs that differ between the two options count.

## 3. How firm is the saving?

Tool life from a small trial is an estimate, so the calculator puts an interval around it. Because the population standard deviation is unknown and estimated from the trial, it uses the t-distribution:

```
interval = mean +/- t(alpha/2, df = n - 1) x s / sqrt(n)
```

- `mean` is the proposed tool's parts per edge, `s` is the trial standard deviation, `n` is the number of edges tested.
- Confidence levels offered: 90%, 95%, 99%.
- t values for 1 to 30 degrees of freedom come from an exact table. Beyond 30 a Cornish-Fisher expansion is used; checked against scipy it differs from the exact value by 0.00001 or less for 31 to 2,000 degrees of freedom.
- The low end of the interval is run back through the cost model to give the **pessimistic case**, and the high end gives the **optimistic case**. The expected case uses the trial mean.

### Edges to test

When the saving is positive on average but not at the pessimistic end, the calculator estimates how many edges would settle it:

```
zero_saving_life = (insert_p / edges_p + R x change_p) / (CPP_current - R x cycle_p)
margin           = trial_mean - zero_saving_life
```

`zero_saving_life` is the proposed tool life at which the saving is exactly zero. The answer is the smallest `n` for which `t(n - 1) x s / sqrt(n) <= margin`, assuming the mean and standard deviation stay as observed.

The course formula `n = (Z x sigma / E)^2` is shown alongside as a cross-check. It uses the normal distribution, so it tends to give a smaller number than the t-based figure, because with a small sample the critical value is larger than Z. The t-based figure is the one used for the recommendation because it matches the interval the calculator actually draws.

## 4. Verdict rules

| Situation | Verdict |
|---|---|
| Expected saving is zero or negative | **No-go** |
| Expected saving is positive, no trial data entered | **Conditional**: uncertainty not assessed |
| Saving stays positive at the low end of the interval, and break-even falls inside one year of volume | **Go** |
| Saving stays positive at the low end of the interval, but break-even needs more than a year of volume | **Conditional**: payback is the issue, not the data |
| Saving is positive on average but not at the low end (or the interval reaches zero tool life) | **Conditional**: more trial edges needed |

The one-year horizon is applied to the expected case.

## 5. The bottleneck switch

A shorter cycle time is only worth money if the machine limits how many good parts you can make. If it does not (the machine is not the bottleneck), the saved minutes do not turn into extra parts, so counting them overstates the saving.

The calculator therefore multiplies the machine rate by a *share of machine time counted as money*:

- 1 when the machine is the bottleneck (default)
- 0 when it is not
- any value between 0 and 1 if only part of the time has a use

With a share of 0, only the insert cost differs between the two tools. See `worked-example.md` for how much this can change a verdict.

## 6. Sensitivity

For each input the calculator recomputes the expected case with that input 10% lower and 10% higher, everything else unchanged, and shows the payback in months. Rows are ordered by how far payback moves. "Not reached" means the saving disappears at that value.

## 7. Limits

1. **Skewed tool-life data.** Tool life is often skewed (closer to a Weibull shape than a normal one), and the interval assumes it is roughly normal. A warning appears when fewer than 10 edges were tested.
2. **Only one input has an interval.** Prices, cycle times, volume and the current tool's parts per edge are treated as exact. The sensitivity table is the guard against that. Treating the current tool's life as uncertain too (a two-sample comparison) is planned for v1.1.
3. **The interval is for the average, not for individual edges.** It says nothing about how often a single edge will fail early.
4. **One operation, one part number.** No part mix, scrap, or interaction between operations.
5. **No time value of money.** Payback is simple payback. NPV and IRR are planned for a later version.
6. **A single machine rate.** Its definition (what overheads are in it) is your responsibility. Use the fully loaded rate your finance team uses for decisions, and state it when you share the result.
7. **A steady saving.** Break-even assumes the saving per part is the same for every part, with no learning curve and no price change.
8. **Economics only.** The calculator compares costs. It does not say whether the proposed tool can run safely at the stated cycle time and conditions. Verify those against the manufacturer's recommendations.
