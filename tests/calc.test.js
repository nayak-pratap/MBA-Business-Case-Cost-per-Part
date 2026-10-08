'use strict';

// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const CPP = require('../calc.js');

function near(actual, expected, tol, label) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    (label || 'value') + ': expected ' + expected + ' +/- ' + tol + ', got ' + actual
  );
}

// The worked example from SPEC.md section 7.
function example() {
  return {
    machine: { rate: 30, bottleneck: true },
    current: { insertPrice: 450, edgesPerInsert: 4, partsPerEdge: 20, cycleTime: 4.0, changeTime: 2 },
    proposed: { insertPrice: 600, edgesPerInsert: 4, partsPerEdge: 35, cycleTime: 3.8, changeTime: 2 },
    annualVolume: 60000,
    oneTimeCost: 150000,
    trial: { n: 5, sd: 6 },
    confidence: 0.95
  };
}

// ---------------------------------------------------------- Module A

test('cost per part: current tool components and total', () => {
  const r = CPP.costPerPart({ rate: 30, insertPrice: 450, edgesPerInsert: 4, partsPerEdge: 20, cycleTime: 4, changeTime: 2 });
  near(r.machine, 120, 1e-9, 'machine');
  near(r.tool, 5.625, 1e-9, 'tool');
  near(r.change, 3, 1e-9, 'change');
  near(r.total, 128.625, 1e-9, 'total');
});

test('cost per part: proposed tool', () => {
  const r = CPP.costPerPart({ rate: 30, insertPrice: 600, edgesPerInsert: 4, partsPerEdge: 35, cycleTime: 3.8, changeTime: 2 });
  near(r.total, 120, 1e-9, 'total');
});

test('cost per part: time value factor 0 leaves only the insert cost', () => {
  const r = CPP.costPerPart({ rate: 30, timeValueFactor: 0, insertPrice: 450, edgesPerInsert: 4, partsPerEdge: 20, cycleTime: 4, changeTime: 2 });
  near(r.machine, 0, 1e-12);
  near(r.change, 0, 1e-12);
  near(r.total, 5.625, 1e-9);
});

test('cost per part: rejects impossible inputs with a clear message', () => {
  const base = { rate: 30, insertPrice: 450, edgesPerInsert: 4, partsPerEdge: 20, cycleTime: 4, changeTime: 2 };
  assert.throws(() => CPP.costPerPart({ ...base, partsPerEdge: 0 }), /Parts per edge must be greater than 0/);
  assert.throws(() => CPP.costPerPart({ ...base, rate: -1 }), /Machine rate must be at least 0/);
  assert.throws(() => CPP.costPerPart({ ...base, timeValueFactor: 1.5 }), /Time value factor must be at most 1/);
  assert.throws(() => CPP.costPerPart({ ...base, cycleTime: NaN }), /Cycle time must be a number/);
});

// ---------------------------------------------------------- Module B

test('decision metrics: worked example', () => {
  const m = CPP.decisionMetrics({ cppCurrent: 128.625, cppProposed: 120, annualVolume: 60000, oneTimeCost: 150000 });
  near(m.savingPerPart, 8.625, 1e-9);
  near(m.annualSaving, 517500, 1e-6);
  near(m.breakEvenParts, 17391.30, 0.01);
  near(m.paybackMonths, 3.478, 0.001);
  near(m.marginOfSafety, 0.7101, 0.0001);
  assert.equal(m.breakEvenReached, true);
});

test('decision metrics: no saving means break-even is not reached', () => {
  const m = CPP.decisionMetrics({ cppCurrent: 100, cppProposed: 100, annualVolume: 1000, oneTimeCost: 500 });
  assert.equal(m.breakEvenReached, false);
  assert.equal(m.breakEvenParts, null);
  assert.equal(m.paybackMonths, null);
  assert.equal(m.marginOfSafety, null);
});

test('decision metrics: margin of safety goes negative when payback needs more than a year', () => {
  const m = CPP.decisionMetrics({ cppCurrent: 10, cppProposed: 9, annualVolume: 1000, oneTimeCost: 2000 });
  near(m.breakEvenParts, 2000, 1e-9);
  assert.ok(m.marginOfSafety < 0);
});

// ---------------------------------------------------------- Module C

test('t critical values match published tables', () => {
  near(CPP.tCritical(4, 0.95), 2.7764, 0.0001, 'df 4, 95%');
  near(CPP.tCritical(9, 0.9), 1.8331, 0.0001, 'df 9, 90%');
  near(CPP.tCritical(5, 0.99), 4.0321, 0.0001, 'df 5, 99%');
  near(CPP.tCritical(30, 0.95), 2.0423, 0.0001, 'df 30, 95%');
});

test('t critical values beyond the table stay accurate', () => {
  near(CPP.tCritical(40, 0.95), 2.0211, 0.002, 'df 40, 95%');
  near(CPP.tCritical(60, 0.95), 2.0003, 0.002, 'df 60, 95%');
  near(CPP.tCritical(120, 0.95), 1.9799, 0.002, 'df 120, 95%');
  near(CPP.tCritical(50, 0.99), 2.6778, 0.003, 'df 50, 99%');
});

test('z critical values and unsupported confidence levels', () => {
  near(CPP.zCritical(0.95), 1.96, 0.001);
  near(CPP.zCritical(0.9), 1.645, 0.001);
  near(CPP.zCritical(0.99), 2.576, 0.001);
  assert.throws(() => CPP.zCritical(0.97), /Confidence level/);
});

test('confidence interval: worked example', () => {
  const ci = CPP.confidenceInterval({ n: 5, mean: 35, sd: 6, confidence: 0.95 });
  near(ci.t, 2.7764, 0.0001);
  near(ci.halfWidth, 7.45, 0.01);
  near(ci.low, 27.55, 0.01);
  near(ci.high, 42.45, 0.01);
  assert.equal(ci.df, 4);
});

test('confidence interval: needs at least two edges', () => {
  assert.throws(() => CPP.confidenceInterval({ n: 1, mean: 35, sd: 6 }), /at least 2/);
  assert.throws(() => CPP.confidenceInterval({ n: 4.5, mean: 35, sd: 6 }), /whole number/);
});

test('sample size: course formula and t-based figure', () => {
  const s = CPP.sampleSize({ sigma: 6, margin: 3, confidence: 0.95 });
  assert.equal(s.nZ, 16); // ceil((1.96 x 6 / 3)^2) = ceil(15.37)
  assert.equal(s.nT, 18); // t(17) x 6 / sqrt(18) = 2.98 <= 3, while n = 17 gives 3.08
});

test('break-even life of the worked example', () => {
  const i = example();
  near(CPP.breakEvenLife(i.current, i.proposed, 30, 1), 14.359, 0.001);
});

// ------------------------------------------------- Module D: evaluate

test('evaluate: worked example reproduces every SPEC value', () => {
  const r = CPP.evaluate(example());
  const e = r.cases.expected;
  near(e.current.total, 128.625, 1e-9, 'CPP current');
  near(e.proposed.total, 120, 1e-9, 'CPP proposed');
  near(e.metrics.savingPerPart, 8.625, 1e-9, 'saving');
  near(e.metrics.annualSaving, 517500, 1e-6, 'annual saving');
  near(e.metrics.breakEvenParts, 17391, 1, 'break-even');
  near(e.metrics.paybackMonths, 3.5, 0.05, 'payback');
  near(e.metrics.marginOfSafety, 0.71, 0.005, 'margin of safety');

  near(r.ci.t, 2.776, 0.001, 't');
  near(r.ci.low, 27.55, 0.01, 'CI low');
  near(r.ci.high, 42.45, 0.01, 'CI high');

  const p = r.cases.pessimistic;
  near(p.proposed.total, 121.62, 0.01, 'CPP pessimistic');
  near(p.metrics.savingPerPart, 7.00, 0.01, 'saving pessimistic');
  near(p.metrics.breakEvenParts, 21421, 2, 'break-even pessimistic');

  assert.ok(r.cases.optimistic.metrics.savingPerPart > e.metrics.savingPerPart);
  assert.equal(r.verdict.level, 'go');
  assert.deepEqual(r.warnings.map((w) => w.code), ['small-trial']);
});

test('evaluate: no-go when the proposed tool is not cheaper per part', () => {
  const i = example();
  i.proposed.partsPerEdge = 15;
  i.proposed.cycleTime = 4.0;
  const r = CPP.evaluate(i);
  assert.equal(r.verdict.level, 'no-go');
  assert.equal(r.verdict.code, 'no-saving');
  assert.equal(r.cases.expected.metrics.breakEvenParts, null);
});

test('evaluate: conditional when the trial is too noisy, with an edges-to-test answer', () => {
  const i = example();
  i.trial = { n: 5, sd: 25 };
  const r = CPP.evaluate(i);
  assert.equal(r.verdict.level, 'conditional');
  assert.equal(r.verdict.code, 'uncertain-saving');
  assert.ok(r.cases.pessimistic.metrics.savingPerPart < 0);
  // margin = 35 - 14.359 = 20.64; smallest n with t(n-1) x 25 / sqrt(n) <= 20.64 is 9
  assert.equal(r.verdict.edgesToTest.total, 9);
  assert.equal(r.verdict.edgesToTest.additional, 4);
  near(r.verdict.edgesToTest.zeroSavingLife, 14.359, 0.001);
});

test('evaluate: interval that reaches zero life is flagged and cannot be a Go', () => {
  const i = example();
  i.trial = { n: 3, sd: 40 };
  const r = CPP.evaluate(i);
  assert.equal(r.cases.pessimistic, null);
  assert.ok(r.warnings.some((w) => w.code === 'interval-includes-zero'));
  assert.equal(r.verdict.level, 'conditional');
});

test('evaluate: positive saving without trial data is conditional, not go', () => {
  const i = example();
  delete i.trial;
  const r = CPP.evaluate(i);
  assert.equal(r.verdict.level, 'conditional');
  assert.equal(r.verdict.code, 'no-trial-data');
  assert.equal(r.ci, null);
});

test('evaluate: robust saving but payback beyond one year is conditional', () => {
  const i = example();
  i.oneTimeCost = 1000000;
  const r = CPP.evaluate(i);
  assert.equal(r.verdict.level, 'conditional');
  assert.equal(r.verdict.code, 'payback-beyond-horizon');
  assert.equal(r.verdict.edgesToTest, undefined);
});

test('evaluate: machine that is not the bottleneck gets no credit for time', () => {
  const i = example();
  i.machine.bottleneck = false;
  const r = CPP.evaluate(i);
  assert.equal(r.timeValueFactor, 0);
  near(r.cases.expected.current.total, 5.625, 1e-9);
  near(r.cases.expected.proposed.total, 600 / (4 * 35), 1e-9);
  assert.ok(r.warnings.some((w) => w.code === 'time-partly-valued'));
});

test('evaluate: explicit time value factor overrides the bottleneck switch', () => {
  const i = example();
  i.machine.bottleneck = false;
  i.machine.timeValueFactor = 0.5;
  const r = CPP.evaluate(i);
  near(r.effectiveRate, 15, 1e-9);
});

test('evaluate: bad inputs throw readable errors', () => {
  const i = example();
  i.confidence = 0.97;
  assert.throws(() => CPP.evaluate(i), /Confidence level/);
  const j = example();
  j.trial = { n: 1, sd: 6 };
  assert.throws(() => CPP.evaluate(j), /at least 2/);
  const k = example();
  k.annualVolume = 0;
  assert.throws(() => CPP.evaluate(k), /Annual volume/);
});

// ------------------------------------------------------- sensitivity

test('sensitivity: ranks inputs by how far payback moves', () => {
  const rows = CPP.sensitivity(example());
  assert.ok(rows.length >= 8);
  for (let k = 1; k < rows.length; k++) {
    assert.ok(rows[k - 1].swing >= rows[k].swing, 'rows sorted by swing');
  }
  const life = rows.find((r) => r.key === 'proposedLife');
  assert.ok(life.high.savingPerPart > life.low.savingPerPart, 'longer proposed life saves more');
  const rate = rows.find((r) => r.key === 'rate');
  near(rate.low.value, 27, 1e-9);
  near(rate.high.value, 33, 1e-9);
});

test('sensitivity: does not modify the caller inputs', () => {
  const i = example();
  const before = JSON.stringify(i);
  CPP.sensitivity(i);
  assert.equal(JSON.stringify(i), before);
});
