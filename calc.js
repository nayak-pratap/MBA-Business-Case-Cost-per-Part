/*!
 * Cost-per-Part Business Case Calculator: calculation engine
 *
 * Pure functions with no DOM access. Works in the browser (window.CPP) and in
 * Node (require). Educational use only: verify against manufacturer
 * recommendations before applying anything on the shop floor.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CPP = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.1.0';

  // Two-tailed t critical values for df = 1..30 (generated with scipy.stats.t.ppf).
  var T_TABLE = {
    '0.9': [6.3138, 2.92, 2.3534, 2.1318, 2.015, 1.9432, 1.8946, 1.8595, 1.8331, 1.8125, 1.7959, 1.7823, 1.7709, 1.7613, 1.7531, 1.7459, 1.7396, 1.7341, 1.7291, 1.7247, 1.7207, 1.7171, 1.7139, 1.7109, 1.7081, 1.7056, 1.7033, 1.7011, 1.6991, 1.6973],
    '0.95': [12.7062, 4.3027, 3.1824, 2.7764, 2.5706, 2.4469, 2.3646, 2.306, 2.2622, 2.2281, 2.201, 2.1788, 2.1604, 2.1448, 2.1314, 2.1199, 2.1098, 2.1009, 2.093, 2.086, 2.0796, 2.0739, 2.0687, 2.0639, 2.0595, 2.0555, 2.0518, 2.0484, 2.0452, 2.0423],
    '0.99': [63.6567, 9.9248, 5.8409, 4.6041, 4.0321, 3.7074, 3.4995, 3.3554, 3.2498, 3.1693, 3.1058, 3.0545, 3.0123, 2.9768, 2.9467, 2.9208, 2.8982, 2.8784, 2.8609, 2.8453, 2.8314, 2.8188, 2.8073, 2.7969, 2.7874, 2.7787, 2.7707, 2.7633, 2.7564, 2.75]
  };

  // Two-tailed normal critical values.
  var Z_VALUES = {
    '0.9': 1.6448536269514722,
    '0.95': 1.959963984540054,
    '0.99': 2.5758293035489004
  };

  var MAX_TRIAL_SIZE = 1000;

  // ---------------------------------------------------------------- helpers

  function confKey(confidence) {
    var k = String(Math.round(confidence * 100) / 100);
    if (!Object.prototype.hasOwnProperty.call(Z_VALUES, k)) {
      throw new Error('Confidence level must be 0.90, 0.95 or 0.99.');
    }
    return k;
  }

  function num(value, name, opts) {
    opts = opts || {};
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error(name + ' must be a number.');
    }
    if (opts.min !== undefined) {
      if (opts.exclusive ? value <= opts.min : value < opts.min) {
        throw new Error(name + ' must be ' + (opts.exclusive ? 'greater than ' : 'at least ') + opts.min + '.');
      }
    }
    if (opts.max !== undefined && value > opts.max) {
      throw new Error(name + ' must be at most ' + opts.max + '.');
    }
    return value;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ------------------------------------------------------ critical values

  function zCritical(confidence) {
    return Z_VALUES[confKey(confidence)];
  }

  /**
   * Two-tailed t critical value. Exact table for df 1..30; beyond that a
   * Cornish-Fisher expansion around the normal value (error below 0.001).
   */
  function tCritical(df, confidence) {
    var k = confKey(confidence);
    num(df, 'Degrees of freedom', { min: 1 });
    df = Math.floor(df);
    if (df <= 30) return T_TABLE[k][df - 1];
    var z = Z_VALUES[k];
    var z2 = z * z, z3 = z2 * z, z5 = z3 * z2, z7 = z5 * z2;
    return z +
      (z3 + z) / (4 * df) +
      (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) +
      (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df * df * df);
  }

  // ------------------------------------------------- Module A: cost per part

  /**
   * Cost per part = machine time + insert + tool-change time.
   * The effective machine rate is rate x timeValueFactor, so time that is not
   * worth money (machine is not the bottleneck) can be left out.
   */
  function costPerPart(o) {
    var rate = num(o.rate, 'Machine rate', { min: 0 });
    var tvf = o.timeValueFactor === undefined ? 1 : num(o.timeValueFactor, 'Time value factor', { min: 0, max: 1 });
    var insertPrice = num(o.insertPrice, 'Insert price', { min: 0 });
    var edges = num(o.edgesPerInsert, 'Edges per insert', { min: 0, exclusive: true });
    var life = num(o.partsPerEdge, 'Parts per edge', { min: 0, exclusive: true });
    var cycle = num(o.cycleTime, 'Cycle time', { min: 0 });
    var change = num(o.changeTime, 'Tool change time', { min: 0 });

    var eff = rate * tvf;
    var machine = eff * cycle;
    var tool = insertPrice / (edges * life);
    var changeCost = eff * change / life;
    return { machine: machine, tool: tool, change: changeCost, total: machine + tool + changeCost };
  }

  // ---------------------------------------------- Module B: decision metrics

  function decisionMetrics(o) {
    var cppCurrent = num(o.cppCurrent, 'Current cost per part');
    var cppProposed = num(o.cppProposed, 'Proposed cost per part');
    var volume = num(o.annualVolume, 'Annual volume', { min: 0, exclusive: true });
    var oneTime = num(o.oneTimeCost, 'One-time cost', { min: 0 });

    var saving = cppCurrent - cppProposed;
    var reached = saving > 0;
    var be = reached ? oneTime / saving : null;
    return {
      savingPerPart: saving,
      annualSaving: saving * volume,
      breakEvenReached: reached,
      breakEvenParts: be,
      paybackMonths: reached ? be / (volume / 12) : null,
      // Negative means break-even needs more parts than one year of volume.
      marginOfSafety: reached ? (volume - be) / volume : null
    };
  }

  // ------------------------------------------- Module C: confidence on trial

  /** t-based confidence interval for mean parts per edge (sigma unknown). */
  function confidenceInterval(o) {
    var n = num(o.n, 'Number of edges tested', { min: 2 });
    if (Math.floor(n) !== n) throw new Error('Number of edges tested must be a whole number.');
    var mean = num(o.mean, 'Trial mean parts per edge', { min: 0, exclusive: true });
    var sd = num(o.sd, 'Trial standard deviation', { min: 0 });
    var confidence = o.confidence === undefined ? 0.95 : o.confidence;
    var df = n - 1;
    var t = tCritical(df, confidence);
    var half = t * sd / Math.sqrt(n);
    return {
      n: n, mean: mean, sd: sd, df: df, t: t, confidence: confidence,
      halfWidth: half, low: mean - half, high: mean + half
    };
  }

  /**
   * Edges needed to estimate mean life within +/- margin.
   * nZ is the course formula n = (Z x sigma / E)^2 (large-sample).
   * nT keeps the t-based interval consistent (sigma is estimated, so the
   * critical value depends on n); it is the smallest n with t x sigma / sqrt(n) <= E.
   */
  function sampleSize(o) {
    var sigma = num(o.sigma, 'Standard deviation', { min: 0, exclusive: true });
    var margin = num(o.margin, 'Margin', { min: 0, exclusive: true });
    var confidence = o.confidence === undefined ? 0.95 : o.confidence;
    var z = zCritical(confidence);
    var nZ = Math.max(2, Math.ceil(Math.pow(z * sigma / margin, 2)));
    var nT = null;
    for (var n = 2; n <= MAX_TRIAL_SIZE; n++) {
      if (tCritical(n - 1, confidence) * sigma / Math.sqrt(n) <= margin) { nT = n; break; }
    }
    return { nZ: nZ, nT: nT };
  }

  /**
   * The proposed tool's parts per edge at which the saving per part is exactly
   * zero. Returns null if no tool life could ever beat the current tool.
   */
  function breakEvenLife(current, proposed, rate, timeValueFactor) {
    var eff = rate * timeValueFactor;
    var cppCurrent = costPerPart(Object.assign({ rate: rate, timeValueFactor: timeValueFactor }, current)).total;
    var denom = cppCurrent - eff * proposed.cycleTime;
    if (denom <= 0) return null;
    return (proposed.insertPrice / proposed.edgesPerInsert + eff * proposed.changeTime) / denom;
  }

  // ------------------------------------------------------- evaluation flow

  function resolveTimeValue(machine) {
    var f = machine.timeValueFactor;
    if (f !== undefined && f !== null && !(typeof f === 'number' && isNaN(f))) {
      return num(f, 'Time value factor', { min: 0, max: 1 });
    }
    return machine.bottleneck === false ? 0 : 1;
  }

  function toolInputs(t) {
    return {
      insertPrice: t.insertPrice,
      edgesPerInsert: t.edgesPerInsert,
      partsPerEdge: t.partsPerEdge,
      cycleTime: t.cycleTime,
      changeTime: t.changeTime
    };
  }

  function runCase(current, proposed, rate, tvf, life, volume, oneTime) {
    var cur = costPerPart(Object.assign({ rate: rate, timeValueFactor: tvf }, toolInputs(current)));
    var prop = costPerPart(Object.assign({ rate: rate, timeValueFactor: tvf }, toolInputs(proposed), { partsPerEdge: life }));
    return {
      life: life,
      current: cur,
      proposed: prop,
      metrics: decisionMetrics({ cppCurrent: cur.total, cppProposed: prop.total, annualVolume: volume, oneTimeCost: oneTime })
    };
  }

  /**
   * Full evaluation.
   *
   * inputs = {
   *   machine:  { rate, bottleneck (default true), timeValueFactor (optional) },
   *   current:  { insertPrice, edgesPerInsert, partsPerEdge, cycleTime, changeTime },
   *   proposed: { same fields; partsPerEdge is also the trial mean },
   *   annualVolume, oneTimeCost,
   *   trial:    { n, sd } or omitted,
   *   confidence: 0.90 | 0.95 | 0.99 (default 0.95)
   * }
   */
  function evaluate(inputs) {
    var machine = inputs.machine || {};
    var rate = num(machine.rate, 'Machine rate', { min: 0 });
    var tvf = resolveTimeValue(machine);
    var volume = num(inputs.annualVolume, 'Annual volume', { min: 0, exclusive: true });
    var oneTime = num(inputs.oneTimeCost, 'One-time cost', { min: 0 });
    var confidence = inputs.confidence === undefined ? 0.95 : inputs.confidence;
    confKey(confidence);

    var warnings = [];
    if (tvf < 1) warnings.push({ code: 'time-partly-valued', factor: tvf });

    var expected = runCase(inputs.current, inputs.proposed, rate, tvf, inputs.proposed.partsPerEdge, volume, oneTime);
    var cases = { expected: expected, pessimistic: null, optimistic: null };

    var ci = null;
    if (inputs.trial) {
      ci = confidenceInterval({
        n: inputs.trial.n,
        mean: inputs.proposed.partsPerEdge,
        sd: inputs.trial.sd,
        confidence: confidence
      });
      if (ci.n < 10) warnings.push({ code: 'small-trial', n: ci.n });
      if (ci.low > 0) {
        cases.pessimistic = runCase(inputs.current, inputs.proposed, rate, tvf, ci.low, volume, oneTime);
      } else {
        warnings.push({ code: 'interval-includes-zero', low: ci.low });
      }
      cases.optimistic = runCase(inputs.current, inputs.proposed, rate, tvf, ci.high, volume, oneTime);
    }

    var verdict = decide(inputs, cases, ci, rate, tvf, volume, confidence);
    return { timeValueFactor: tvf, effectiveRate: rate * tvf, confidence: confidence, cases: cases, ci: ci, verdict: verdict, warnings: warnings };
  }

  function decide(inputs, cases, ci, rate, tvf, volume, confidence) {
    var exp = cases.expected.metrics;

    if (!(exp.savingPerPart > 0)) {
      return { level: 'no-go', code: 'no-saving', savingPerPart: exp.savingPerPart };
    }

    var insideHorizon = exp.breakEvenParts <= volume;

    if (!ci) {
      return { level: 'conditional', code: 'no-trial-data', insideHorizon: insideHorizon };
    }

    var pess = cases.pessimistic;
    var pessPositive = !!pess && pess.metrics.savingPerPart > 0;

    if (pessPositive && insideHorizon) {
      return { level: 'go', code: 'go', pessimisticSaving: pess.metrics.savingPerPart };
    }

    if (pessPositive && !insideHorizon) {
      return { level: 'conditional', code: 'payback-beyond-horizon', breakEvenParts: exp.breakEvenParts, annualVolume: volume };
    }

    // Saving positive on the mean but not at the pessimistic end: more testing may settle it.
    var verdict = { level: 'conditional', code: 'uncertain-saving', pessimisticSaving: pess ? pess.metrics.savingPerPart : null, edgesToTest: null };
    var l0 = breakEvenLife(inputs.current, inputs.proposed, rate, tvf);
    if (l0 !== null) {
      var margin = ci.mean - l0;
      if (margin > 0 && ci.sd > 0) {
        var s = sampleSize({ sigma: ci.sd, margin: margin, confidence: confidence });
        if (s.nT !== null) {
          verdict.edgesToTest = {
            total: Math.max(s.nT, ci.n),
            additional: Math.max(0, s.nT - ci.n),
            zeroSavingLife: l0,
            courseFormulaTotal: s.nZ
          };
        }
      }
    }
    return verdict;
  }

  // ------------------------------------------------------------ sensitivity

  var SENSITIVITY_PARAMS = [
    { key: 'rate', label: 'Machine rate', get: function (i) { return i.machine.rate; }, set: function (i, v) { i.machine.rate = v; } },
    { key: 'proposedLife', label: 'Proposed parts per edge', get: function (i) { return i.proposed.partsPerEdge; }, set: function (i, v) { i.proposed.partsPerEdge = v; } },
    { key: 'currentLife', label: 'Current parts per edge', get: function (i) { return i.current.partsPerEdge; }, set: function (i, v) { i.current.partsPerEdge = v; } },
    { key: 'proposedCycle', label: 'Proposed cycle time', get: function (i) { return i.proposed.cycleTime; }, set: function (i, v) { i.proposed.cycleTime = v; } },
    { key: 'currentCycle', label: 'Current cycle time', get: function (i) { return i.current.cycleTime; }, set: function (i, v) { i.current.cycleTime = v; } },
    { key: 'proposedInsert', label: 'Proposed insert price', get: function (i) { return i.proposed.insertPrice; }, set: function (i, v) { i.proposed.insertPrice = v; } },
    { key: 'currentInsert', label: 'Current insert price', get: function (i) { return i.current.insertPrice; }, set: function (i, v) { i.current.insertPrice = v; } },
    { key: 'volume', label: 'Annual volume', get: function (i) { return i.annualVolume; }, set: function (i, v) { i.annualVolume = v; } },
    { key: 'oneTime', label: 'One-time cost', get: function (i) { return i.oneTimeCost; }, set: function (i, v) { i.oneTimeCost = v; } }
  ];

  /**
   * Flex each input by -pct and +pct (expected case only) and report the effect
   * on saving per part and payback. Sorted by how far payback moves.
   */
  function sensitivity(inputs, pct) {
    pct = pct === undefined ? 0.1 : pct;
    var BIG = 1e9;
    var rows = [];

    function run(param, factor) {
      var c = clone(inputs);
      delete c.trial;
      var v = param.get(c) * factor;
      param.set(c, v);
      try {
        var m = evaluate(c).cases.expected.metrics;
        return { value: v, savingPerPart: m.savingPerPart, paybackMonths: m.paybackMonths };
      } catch (e) {
        return null;
      }
    }

    SENSITIVITY_PARAMS.forEach(function (p) {
      var base = p.get(inputs);
      if (typeof base !== 'number' || base === 0) return;
      var lo = run(p, 1 - pct);
      var hi = run(p, 1 + pct);
      if (!lo || !hi) return;
      var a = lo.paybackMonths === null ? BIG : lo.paybackMonths;
      var b = hi.paybackMonths === null ? BIG : hi.paybackMonths;
      rows.push({ key: p.key, label: p.label, base: base, low: lo, high: hi, swing: Math.abs(a - b) });
    });

    rows.sort(function (x, y) { return y.swing - x.swing; });
    return rows;
  }

  return {
    VERSION: VERSION,
    zCritical: zCritical,
    tCritical: tCritical,
    costPerPart: costPerPart,
    decisionMetrics: decisionMetrics,
    confidenceInterval: confidenceInterval,
    sampleSize: sampleSize,
    breakEvenLife: breakEvenLife,
    evaluate: evaluate,
    sensitivity: sensitivity
  };
});
