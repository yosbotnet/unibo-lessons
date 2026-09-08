'use strict';

// Finite, invented judge labels. No language model, clinical record or real attack.
// A label of 0 means "not flagged", not independently verified confidentiality.
function check(ok, message) {
  if (!ok) throw new TypeError(message);
}

// Number of k-element subsets; used only within the validated n <= 20 domain.
function choose(n, k) {
  if (k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
  return Math.round(result);
}

// Any-success estimator: 1 - C(n-c, k) / C(n, k).
// n = observed samples, c = flagged samples, k = evaluated attempt budget.
// This is NOT the probability of at least k successes.
function anyOfK(n, c, k) {
  check(Number.isInteger(n) && n >= 1 && n <= 20, 'n must be 1–20');
  check(Number.isInteger(c) && c >= 0 && c <= n, 'c must be 0–n');
  check(Number.isInteger(k) && k >= 1 && k <= n, 'k must be 1–n');
  return 1 - choose(n - c, k) / choose(n, k);
}

function analyze(rows) {
  check(Array.isArray(rows) && rows.length > 0 && rows.length <= 20,
    'Use 1–20 scenarios');
  const ids = new Set();
  let total = 0, leaks = 0, any = 0;

  // Array.from deliberately exposes sparse-array holes to validation.
  const results = Array.from(rows).map(row => {
    check(row && typeof row === 'object' && Object.keys(row).length === 2 &&
      Object.hasOwn(row, 'id') && Object.hasOwn(row, 'runs'), 'Use exactly id and runs');
    check(typeof row.id === 'string' && /^[A-Z][A-Z0-9-]{0,7}$/.test(row.id) &&
      !ids.has(row.id), 'Unique short scenario IDs required');
    ids.add(row.id);
    check(Array.isArray(row.runs) && row.runs.length >= 1 && row.runs.length <= 20 &&
      Array.from(row.runs).every(x => x === 0 || x === 1), 'Runs must be 1–20 binary labels');

    const n = row.runs.length;
    const c = row.runs.reduce((a, b) => a + b, 0);
    const hit = Number(c > 0);
    total += n;
    leaks += c;
    any += hit;
    return {id: row.id, runs: [...row.runs], n, c, rate: c / n, any: hit};
  });

  return {
    rows: results,
    total,
    leaks,
    any,
    scenarios: results.length,
    perRun: leaks / total, // Each run has equal weight.
    scenarioMean: results.reduce((sum, row) => sum + row.rate, 0) / results.length,
    anyScenario: any / results.length, // Each scenario contributes its OR, not its mean.
    equalRuns: results.every(row => row.n === results[0].n)
  };
}

function example() {
  return [
    {id: 'A', runs: [1, 0, 0, 0, 0]},
    {id: 'B', runs: [0, 0, 0, 0, 0]},
    {id: 'C', runs: [1, 1, 1, 0, 0]}
  ];
}

// Planned balanced design, not evidence that all runs actually completed.
function design({personas = 10, prompts = 5, repeats = 5, models = 2, conditions = 2} = {}) {
  for (const n of [personas, prompts, repeats, models, conditions]) {
    check(Number.isInteger(n) && n >= 1 && n <= 1000,
      'Design factors must be integers 1–1000');
  }
  const scenarios = personas * prompts;
  const perCell = scenarios * repeats;
  const total = perCell * models * conditions;
  check(Number.isSafeInteger(total), 'Design product exceeds safe integers');
  return {personas, prompts, repeats, models, conditions, scenarios, perCell, total};
}

// Idealized uniform weights only: excludes runtime and quantization overhead.
function weightBytes(parameters, bits) {
  check(Number.isSafeInteger(parameters) && parameters >= 1,
    'Positive integer parameter count required');
  check([4, 8, 16, 32].includes(bits), 'Supported weight precision: 4,8,16,32');
  const bytes = parameters * bits / 8;
  check(Number.isSafeInteger(bytes), 'Weight byte count must be an exact safe integer');
  return bytes;
}

module.exports = Object.freeze({analyze, anyOfK, example, design, weightBytes});
