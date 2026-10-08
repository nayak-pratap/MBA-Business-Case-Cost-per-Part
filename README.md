# MBA-Business-Case-Cost-per-Part

A mobile-friendly business-case calculator for cutting-tool decisions. Free, no sign-in, nothing leaves your browser. It applies cost accounting, break-even analysis and statistical confidence (MBA coursework) to a shop-floor question.

Will the tool you are trialling pay for itself? Enter the tool you run today, the one you are testing, and your trial results. You get:

- cost per part for both tools, split into machine time, insert and tool change
- saving per part and per year, break-even parts, payback and margin of safety
- how firm the saving is: a confidence interval on the trial's tool life, run back through the cost model
- a Go, Conditional or No-go verdict, with a plain-language reason
- how many more edges to test when the trial is too noisy to decide
- a sensitivity table showing which input moves the answer most
- a short summary you can paste into an email

**Try it:** https://pratapnayak-eng.github.io/MBA-Business-Case-Cost-per-Part/index.html

Or open `index.html` in any browser. It works offline once loaded.

### A quick example

Current tool: 450 per insert, 4 edges, 20 parts per edge, 4.0 minute cycle. Proposed tool: 600 per insert, 4 edges, 35 parts per edge, 3.8 minute cycle. Machine rate 30 per minute, 60,000 parts a year, one-time cost 150,000, trial of 5 edges with a standard deviation of 6.

That is 128.63 against 120.00 per part, a saving of 8.63 per part, break-even at 17,391 parts, and a verdict of **Go** because the saving holds even at the low end of the 95% interval. The full working, including what happens if the machine is not the bottleneck, is in [`docs/worked-example.md`](docs/worked-example.md).

### How it decides

| Situation | Verdict |
|---|---|
| Saving holds at the low end of the interval and pays back within a year | Go |
| Saving is positive on average but not at the low end | Conditional: test more edges |
| Saving holds but payback is beyond a year | Conditional |
| No trial data entered | Conditional |
| No saving on the expected numbers | No-go |

Method, assumptions and limits are in [`docs/method.md`](docs/method.md). The design brief is in [`docs/SPEC.md`](docs/SPEC.md).

## Run the tests

Needs Node 18 or later. No dependencies to install.

```
npm test
```

The 25 tests cover the calculation engine (`calc.js`), including the worked example above and the edge cases: no saving, a noisy trial, payback beyond a year, and a machine that is not the bottleneck.

## Please note

These tools are for educational and reference use. They compare costs; they do not say whether a tool can run safely at the stated conditions. Always verify cutting conditions and tool-life data against the manufacturer's recommendations before applying anything on the shop floor. The examples use synthetic numbers.

## Licence

MIT. See [LICENSE](LICENSE).
