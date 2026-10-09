/*!
 * Cost-per-Part Business Case Calculator: page logic.
 * Reads the form, calls CPP (calc.js) and draws the results. No data leaves the page.
 */
(function () {
  'use strict';

  var CPP = window.CPP;
  var $ = function (id) { return document.getElementById(id); };

  var FIELD_IDS = [
    'rate', 'volume', 'onetime', 'tvf',
    'cur-insert', 'cur-edges', 'cur-life', 'cur-cycle', 'cur-change',
    'pro-insert', 'pro-edges', 'pro-life', 'pro-cycle', 'pro-change',
    'trial-n', 'trial-sd'
  ];

  var EXAMPLE = {
    'rate': 30, 'volume': 60000, 'onetime': 150000, 'tvf': 1,
    'cur-insert': 450, 'cur-edges': 4, 'cur-life': 20, 'cur-cycle': 4, 'cur-change': 2,
    'pro-insert': 600, 'pro-edges': 4, 'pro-life': 35, 'pro-cycle': 3.8, 'pro-change': 2,
    'trial-n': 5, 'trial-sd': 6
  };

  var LEVEL = {
    'go': { cls: 'go', word: 'Go' },
    'conditional': { cls: 'warn', word: 'Conditional' },
    'no-go': { cls: 'stop', word: 'No-go' }
  };

  var ICONS = {
    'go': '<svg class="vicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5l5.5 5.5L20.5 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"/></svg>',
    'conditional': '<svg class="vicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L1.8 21h20.4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="miter"/><path d="M12 10v5.5M12 17.6v1.8" stroke="currentColor" stroke-width="2.6"/></svg>',
    'no-go': '<svg class="vicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"/></svg>'
  };

  // ---------------------------------------------------------------- input

  function parse(id) {
    var v = $(id).value.trim();
    return v === '' ? NaN : Number(v);
  }

  function readTool(prefix) {
    return {
      insertPrice: parse(prefix + '-insert'),
      edgesPerInsert: parse(prefix + '-edges'),
      partsPerEdge: parse(prefix + '-life'),
      cycleTime: parse(prefix + '-cycle'),
      changeTime: parse(prefix + '-change')
    };
  }

  function buildInputs() {
    var n = $('trial-n').value.trim();
    var sd = $('trial-sd').value.trim();
    var trial = null;
    if (n !== '' || sd !== '') {
      if (n === '' || sd === '') {
        throw new Error('Enter both edges tested and standard deviation, or leave both blank.');
      }
      trial = { n: parse('trial-n'), sd: parse('trial-sd') };
    }
    var oneTime = $('onetime').value.trim() === '' ? 0 : parse('onetime');
    return {
      machine: { rate: parse('rate'), bottleneck: $('bottleneck').checked, timeValueFactor: parse('tvf') },
      current: readTool('cur'),
      proposed: readTool('pro'),
      annualVolume: parse('volume'),
      oneTimeCost: oneTime,
      trial: trial,
      confidence: Number($('confidence').value)
    };
  }

  // ----------------------------------------------------------- formatting

  function makeFormatter() {
    var sym = $('currency').value;
    var locale = sym === '₹' ? 'en-IN' : 'en-US';
    var MINUS = '−';
    var cache = {};
    function nf(d) {
      if (!cache[d]) cache[d] = new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
      return cache[d];
    }
    function body(x, d) { return nf(d).format(Math.abs(x)); }
    function neg(x, d) { return x < 0 && /[1-9]/.test(body(x, d)); }
    return {
      sym: sym,
      dec: function (x, d) { return (neg(x, d) ? MINUS : '') + body(x, d); },
      int: function (x) { return (neg(x, 0) ? MINUS : '') + body(x, 0); },
      money: function (x, d) { d = d === undefined ? 2 : d; return (neg(x, d) ? MINUS : '') + sym + body(x, d); },
      pct: function (x) { return (neg(x * 100, 0) ? MINUS : '') + body(x * 100, 0) + '%'; },
      months: function (x) { return body(x, 1); }
    };
  }

  // -------------------------------------------------------------- verdict

  function verdictCopy(r, inputs, F) {
    var v = r.verdict;
    var exp = r.cases.expected.metrics;
    var conf = Math.round(r.confidence * 100) + '%';
    var vol = inputs.annualVolume;

    switch (v.code) {
      case 'go':
        return {
          text: 'Even at the low end of the ' + conf + ' interval for tool life (' + F.dec(r.ci.low, 1) +
            ' parts per edge), the proposed tool saves ' + F.money(v.pessimisticSaving) +
            ' per part. Break-even needs ' + F.int(exp.breakEvenParts) + ' parts, inside a year of volume (' + F.int(vol) + ').'
        };
      case 'no-saving':
        return {
          text: v.savingPerPart < 0
            ? 'On the expected numbers the proposed tool costs ' + F.money(-v.savingPerPart) + ' more per part, so there is nothing to pay back.'
            : 'On the expected numbers the two tools cost the same per part, so there is nothing to pay back.',
          extra: 'Tool life and cycle time move the result most. The table further down shows by how much.'
        };
      case 'no-trial-data':
        return {
          text: 'The expected saving is ' + F.money(exp.savingPerPart) + ' per part, but no trial data was entered, so the uncertainty has not been checked.' +
            (v.insideHorizon ? '' : ' Break-even (' + F.int(exp.breakEvenParts) + ' parts) also falls beyond a year of volume.'),
          extra: 'Enter the number of edges tested and their standard deviation to see how firm the saving is.'
        };
      case 'payback-beyond-horizon':
        return {
          text: 'The saving holds across the ' + conf + ' interval, but break-even needs ' + F.int(v.breakEvenParts) +
            ' parts, more than a year of volume (' + F.int(v.annualVolume) + '). Whether it is worth it depends on how long you will run this part.'
        };
      case 'uncertain-saving': {
        var text;
        if (v.pessimisticSaving === null) {
          text = 'The expected saving is ' + F.money(exp.savingPerPart) + ' per part, but the ' + conf +
            ' interval reaches zero tool life, so the trial cannot rule out a loss.';
        } else if (v.pessimisticSaving < 0) {
          text = 'The expected saving is ' + F.money(exp.savingPerPart) + ' per part, but at the low end of the ' + conf +
            ' interval (' + F.dec(r.ci.low, 1) + ' parts per edge) the proposed tool costs ' + F.money(-v.pessimisticSaving) + ' more per part.';
        } else {
          text = 'The expected saving is ' + F.money(exp.savingPerPart) + ' per part, but at the low end of the ' + conf +
            ' interval (' + F.dec(r.ci.low, 1) + ' parts per edge) the proposed tool saves nothing.';
        }
        var e = v.edgesToTest;
        var extra = e
          ? 'The saving only disappears if tool life falls below ' + F.dec(e.zeroSavingLife, 1) + ' parts per edge. Testing about ' +
            e.additional + ' more edges (' + e.total + ' in all) should settle it, if the spread stays similar.'
          : 'More trial edges would narrow the interval.';
        return { text: text, extra: extra };
      }
      default:
        return { text: '' };
    }
  }

  function renderVerdict(r, inputs, F) {
    var lv = LEVEL[r.verdict.level];
    var c = verdictCopy(r, inputs, F);
    var el = $('verdict');
    el.className = 'verdict ' + lv.cls;
    el.innerHTML = ICONS[r.verdict.level] +
      '<div><div class="vword">' + lv.word + '</div><p class="vtext">' + c.text + '</p>' +
      (c.extra ? '<p class="vtext">' + c.extra + '</p>' : '') + '</div>';
  }

  // ---------------------------------------------------------------- gauge

  function renderGauge(r, F) {
    var e = r.cases.expected.metrics.savingPerPart;
    var pess = r.cases.pessimistic ? r.cases.pessimistic.metrics.savingPerPart : null;
    var opt = r.cases.optimistic ? r.cases.optimistic.metrics.savingPerPart : null;
    var conf = Math.round(r.confidence * 100) + '%';

    var vals = [0, e];
    if (pess !== null) vals.push(pess);
    if (opt !== null) vals.push(opt);
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    var dmin = min - span * 0.12;
    var dmax = max + span * 0.12;
    function pos(x) { return ((x - dmin) / (dmax - dmin)) * 100; }

    var band = '';
    var bottom = '';
    var aria = 'Saving per part, expected ' + F.money(e) + '.';

    if (r.ci) {
      var left = pess !== null ? pos(pess) : 0;
      var right = pos(opt);
      var cls = (pess !== null && pess > 0) ? 'go' : (opt <= 0 ? 'stop' : 'warn');
      band = '<span class="g-zone ' + cls + '" style="left:' + left + '%;width:' + (right - left) + '%"></span>';
      if (pess !== null && right - left < 18) {
        bottom = '<span class="g-lab" style="left:' + ((left + right) / 2) + '%">' + F.money(pess) + ' to ' + F.money(opt) + '</span>';
      } else {
        if (pess !== null) bottom += '<span class="g-lab" style="left:' + left + '%">' + F.money(pess) + '</span>';
        bottom += '<span class="g-lab" style="left:' + right + '%">' + F.money(opt) + '</span>';
      }
      aria += ' ' + conf + ' interval from ' + (pess !== null ? F.money(pess) : 'a loss of unknown size') + ' to ' + F.money(opt) + '. Zero is break-even.';
    }

    var key = r.ci
      ? 'The coloured bar spans the ' + conf + ' interval for the proposed tool’s parts per edge. The black mark is the expected saving. The dashed line is break-even: to its left the new tool costs more per part, to its right it saves money.'
      : 'No trial data was entered, so only the expected saving is shown. The dashed line is break-even.';

    $('gauge').innerHTML =
      '<div class="gauge" role="img" aria-label="' + aria + '" style="--zero:' + pos(0) + '%">' +
        '<div class="g-top"><span class="g-lab" style="left:' + pos(e) + '%">Expected ' + F.money(e) + '</span></div>' +
        '<div class="g-track">' + band + '<span class="g-zero"></span><span class="g-tick" style="left:' + pos(e) + '%"></span></div>' +
        '<div class="g-bottom">' + bottom + '</div>' +
      '</div><p class="key">' + key + '</p>';
  }

  // --------------------------------------------------------------- numbers

  function renderStats(r, inputs, F) {
    var m = r.cases.expected.metrics;
    var ok = m.breakEvenReached;
    $('stats').innerHTML =
      '<div class="stat wide"><dt>Saving per part</dt><dd>' + F.money(m.savingPerPart) + '</dd></div>' +
      '<div class="stat"><dt>Saved per year</dt><dd>' + F.money(m.annualSaving, 0) + '<small>at ' + F.int(inputs.annualVolume) + ' parts a year</small></dd></div>' +
      '<div class="stat"><dt>Break-even</dt><dd>' + (ok ? F.int(m.breakEvenParts) + ' parts' : 'Not reached') +
        '<small>to recover ' + F.money(inputs.oneTimeCost, 0) + '</small></dd></div>' +
      '<div class="stat"><dt>Payback</dt><dd>' + (ok ? F.months(m.paybackMonths) + ' months' : 'Not reached') + '</dd></div>' +
      '<div class="stat"><dt>Margin of safety</dt><dd>' + (ok ? F.pct(m.marginOfSafety) : 'Not reached') +
        '<small>share of a year’s volume left after break-even</small></dd></div>';
  }

  function renderCosts(r, F) {
    var cur = r.cases.expected.current;
    var pro = r.cases.expected.proposed;
    var max = Math.max(cur.total, pro.total);
    var parts = [['machine', 's1', 'Machine time'], ['tool', 's2', 'Insert'], ['change', 's3', 'Tool change']];

    function bar(name, nameCls, c) {
      var k = max > 0 ? c.total / max : 0;
      var segs = parts.map(function (p) {
        var w = c.total > 0 ? (c[p[0]] / c.total) * 100 : 0;
        return '<span class="seg ' + p[1] + '" style="width:' + w + '%">' + (w >= 16 ? F.dec(c[p[0]], 2) : '') + '</span>';
      }).join('');
      return '<div><div class="bar-name ' + nameCls + '">' + name + '</div><div class="bar-line">' +
        '<div class="bar" style="width:calc((100% - 92px) * ' + k + ')">' + segs + '</div>' +
        '<div class="bar-total">' + F.money(c.total) + '</div></div></div>';
    }

    var legend = '<p class="legend">' + parts.map(function (p) {
      return '<span><span class="sw ' + p[1] + '"></span>' + p[2] + '</span>';
    }).join('') + '</p>';

    var rows = parts.map(function (p) {
      return '<tr><td>' + p[2] + '</td><td>' + F.money(cur[p[0]]) + '</td><td>' + F.money(pro[p[0]]) + '</td><td>' + F.money(cur[p[0]] - pro[p[0]]) + '</td></tr>';
    }).join('');

    $('costs').innerHTML =
      '<div class="bars">' + bar('Current tool', 'cur', cur) + bar('Proposed tool', 'pro', pro) + '</div>' + legend +
      '<div class="tw"><table><thead><tr><th>Per part</th><th>Current</th><th>Proposed</th><th>Saved</th></tr></thead><tbody>' + rows +
      '<tr class="total"><td>Cost per part</td><td>' + F.money(cur.total) + '</td><td>' + F.money(pro.total) + '</td><td>' + F.money(cur.total - pro.total) + '</td></tr></tbody></table></div>';
  }

  function renderCases(r, F) {
    var cols = [];
    if (r.ci) cols.push(['Pessimistic', r.cases.pessimistic]);
    cols.push(['Expected', r.cases.expected]);
    if (r.ci) cols.push(['Optimistic', r.cases.optimistic]);

    var DASH = '—';
    var rows = [
      ['Parts per edge', function (c) { return F.dec(c.life, 1); }],
      ['Cost per part, proposed', function (c) { return F.money(c.proposed.total); }],
      ['Saving per part', function (c) { return F.money(c.metrics.savingPerPart); }],
      ['Break-even, parts', function (c) { return c.metrics.breakEvenReached ? F.int(c.metrics.breakEvenParts) : 'Not reached'; }],
      ['Payback, months', function (c) { return c.metrics.breakEvenReached ? F.months(c.metrics.paybackMonths) : 'Not reached'; }]
    ];

    var head = '<tr><th></th>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (row) {
      return '<tr><td>' + row[0] + '</td>' + cols.map(function (c) {
        return '<td>' + (c[1] ? row[1](c[1]) : DASH) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    var cap = r.ci
      ? 'Pessimistic and optimistic use the ends of the ' + Math.round(r.confidence * 100) + '% interval for the proposed tool’s parts per edge.'
      : 'Add trial data to see the pessimistic and optimistic cases.';
    $('cases').innerHTML = '<div class="tw"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div><p class="tcap">' + cap + '</p>';
  }

  function renderSensitivity(inputs, F) {
    var rows = CPP.sensitivity(inputs);
    function cell(v) { return v.paybackMonths === null ? 'Not reached' : F.months(v.paybackMonths) + ' mo'; }
    var body = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + cell(row.low) + '</td><td>' + cell(row.high) + '</td></tr>';
    }).join('');
    $('sens').innerHTML =
      '<div class="tw"><table><thead><tr><th>Input</th><th>10% lower</th><th>10% higher</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="tcap">Payback when one input moves by 10% and the rest stay put, expected case only. The input at the top moves payback the most. “Not reached” means the saving disappears.</p>';
  }

  function renderNotes(r, inputs, F) {
    var items = r.warnings.map(function (w) {
      switch (w.code) {
        case 'small-trial':
          return 'Only ' + w.n + ' edges were tested. Tool life is often skewed, so treat the interval as approximate.';
        case 'interval-includes-zero':
          return 'The interval reaches zero tool life, so the pessimistic case cannot be calculated. Test more edges.';
        case 'time-partly-valued':
          return w.factor === 0
            ? 'Machine time is not counted as money because this machine is not the bottleneck, so only the insert cost differs between the tools.'
            : 'Machine time is counted at ' + Math.round(w.factor * 100) + '% of the machine rate.';
        default:
          return '';
      }
    }).filter(Boolean);
    if (r.ci) {
      items.push('The interval covers only the proposed tool’s trial results. Prices, cycle times, volume and the current tool’s parts per edge are treated as exact.');
    }
    items.push('Break-even assumes the saving per part stays the same for every part. Sunk cost of existing tooling is left out on purpose.');
    $('notes').innerHTML = items.map(function (t) { return '<li>' + t + '</li>'; }).join('');
  }

  // --------------------------------------------------------------- summary

  function buildSummary(r, inputs, F) {
    var e = r.cases.expected;
    var m = e.metrics;
    var lv = LEVEL[r.verdict.level].word;
    var c = verdictCopy(r, inputs, F);
    var L = [];
    L.push('Cost-per-part business case (educational estimate)');
    L.push('Current tool: ' + F.money(e.current.total) + ' per part. Proposed tool: ' + F.money(e.proposed.total) + ' per part.');
    L.push('Saving: ' + F.money(m.savingPerPart) + ' per part, ' + F.money(m.annualSaving, 0) + ' a year at ' + F.int(inputs.annualVolume) + ' parts.');
    if (m.breakEvenReached) {
      L.push('Break-even: ' + F.int(m.breakEvenParts) + ' parts to recover ' + F.money(inputs.oneTimeCost, 0) + ' (payback ' + F.months(m.paybackMonths) + ' months, margin of safety ' + F.pct(m.marginOfSafety) + ').');
    } else {
      L.push('Break-even: not reached, because the proposed tool does not save money per part.');
    }
    if (r.ci) {
      L.push('Trial: ' + r.ci.n + ' edges, average ' + F.dec(r.ci.mean, 1) + ' parts per edge, standard deviation ' + F.dec(r.ci.sd, 1) + '. ' +
        Math.round(r.confidence * 100) + '% interval: ' + F.dec(r.ci.low, 1) + ' to ' + F.dec(r.ci.high, 1) + ' parts per edge.');
      if (r.cases.pessimistic) {
        var p = r.cases.pessimistic.metrics;
        L.push('Pessimistic case: saving ' + F.money(p.savingPerPart) + ' per part' + (p.breakEvenReached ? ', break-even ' + F.int(p.breakEvenParts) + ' parts.' : ', break-even not reached.'));
      }
    }
    L.push('Verdict: ' + lv + '. ' + c.text);
    L.push('Assumptions: machine rate ' + F.money(inputs.machine.rate) + ' per minute, counted at ' + Math.round(r.timeValueFactor * 100) + '%.');
    L.push('Verify tool-life data and cutting conditions against manufacturer recommendations.');
    return L.join('\n');
  }

  // ------------------------------------------------------------ plan trial

  function updatePlan() {
    var sd = parse('plan-sd');
    var margin = parse('plan-margin');
    var out = $('plan-out');
    if (!(sd > 0) || !(margin > 0)) {
      out.textContent = 'Enter both values. For example, a standard deviation of 6 and an accuracy of 2 parts per edge.';
      return;
    }
    try {
      var confidence = Number($('confidence').value);
      var s = CPP.sampleSize({ sigma: sd, margin: margin, confidence: confidence });
      var conf = Math.round(confidence * 100) + '%';
      out.textContent = s.nT === null
        ? 'More than 1,000 edges would be needed. Loosen the accuracy.'
        : 'Test about ' + s.nT + ' edges to pin the average tool life down to within ±' + margin + ' parts per edge at ' + conf +
          ' confidence. The course formula (normal approximation) gives ' + s.nZ + '.';
    } catch (err) {
      out.textContent = err.message;
    }
  }

  // ------------------------------------------------------------ main render

  var droWanted = false;
  var verdictVisible = false;
  function syncDro() { $('dro').hidden = !(droWanted && !verdictVisible); }

  function render() {
    var F = makeFormatter();
    Array.prototype.forEach.call(document.querySelectorAll('.sym'), function (el) { el.textContent = F.sym; });

    var allBlank = FIELD_IDS.every(function (id) { return $(id).value.trim() === ''; });
    $('error').hidden = true;
    $('empty').hidden = true;
    $('results-body').hidden = true;
    droWanted = false;
    syncDro();
    updatePlan();

    if (allBlank) { $('empty').hidden = false; return; }

    var inputs, r;
    try {
      inputs = buildInputs();
      r = CPP.evaluate(inputs);
    } catch (err) {
      $('error').textContent = err.message;
      $('error').hidden = false;
      return;
    }

    $('results-body').hidden = false;
    renderVerdict(r, inputs, F);
    renderGauge(r, F);
    renderStats(r, inputs, F);
    renderCosts(r, F);
    renderCases(r, F);
    renderSensitivity(inputs, F);
    renderNotes(r, inputs, F);
    $('summary').value = buildSummary(r, inputs, F);

    var s = r.cases.expected.metrics.savingPerPart;
    var lv = LEVEL[r.verdict.level];
    $('dro').className = 'dro ' + lv.cls;
    $('dro-text').textContent = s > 0 ? F.money(s) + ' saved per part' : (s < 0 ? F.money(-s) + ' more per part' : 'No saving per part');
    $('dro-level').textContent = lv.word;
    droWanted = true;
    syncDro();
  }

  // ----------------------------------------------------------------- events

  function loadExample() {
    FIELD_IDS.forEach(function (id) { $(id).value = EXAMPLE[id]; });
    $('bottleneck').checked = true;
    $('confidence').value = '0.95';
    $('example-note').hidden = false;
    render();
  }

  function clearAll() {
    FIELD_IDS.forEach(function (id) { $(id).value = ''; });
    $('bottleneck').checked = true;
    $('example-note').hidden = true;
    render();
  }

  function onFormEvent(e) {
    if (e.target && e.target.id === 'bottleneck') {
      $('tvf').value = e.target.checked ? '1' : '0';
    }
    $('example-note').hidden = true;
    render();
  }

  function copySummary() {
    var ta = $('summary');
    var status = $('copy-status');
    function done(ok) {
      status.textContent = ok ? 'Summary copied' : 'Select the text and copy it';
      setTimeout(function () { status.textContent = ''; }, 2500);
    }
    function fallback() {
      ta.focus();
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }

  function init() {
    if (!CPP) {
      $('error').textContent = 'The calculation file (calc.js) did not load. Reload the page.';
      $('error').hidden = false;
      return;
    }
    $('version').textContent = CPP.VERSION;
    $('form').addEventListener('input', onFormEvent);
    $('form').addEventListener('change', onFormEvent);
    $('currency').addEventListener('change', render);
    $('load-example').addEventListener('click', loadExample);
    $('clear-all').addEventListener('click', clearAll);
    $('copy').addEventListener('click', copySummary);
    $('plan-toggle').addEventListener('click', function () {
      var panel = $('plan-panel');
      var open = panel.hidden;
      panel.hidden = !open;
      this.setAttribute('aria-expanded', String(open));
      if (open) { $('plan-sd').focus(); }
    });
    $('plan-sd').addEventListener('input', updatePlan);
    $('plan-margin').addEventListener('input', updatePlan);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        verdictVisible = entries[0].isIntersecting;
        syncDro();
      }).observe($('verdict-block'));
    }
    loadExample();
  }

  init();
})();
