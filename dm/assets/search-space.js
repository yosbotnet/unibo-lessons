/* The same finite domain drives the lesson SVG and its interactive table.
   The highlighted region is illustrative, not a measured optimum. */
(function (root, factory) {
  var model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.HyperparameterSpace = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var depths = Array.from({length: 10}, function (_, i) { return i + 1; });
  var estimators = Array.from({length: 19}, function (_, i) { return i + 2; });
  function isGood(depth, trees) { return depth === 8 && trees >= 11 && trees <= 20; }
  var points = depths.flatMap(function (depth) {
    return estimators.map(function (trees) { return {depth: depth, trees: trees, good: isGood(depth, trees)}; });
  });
  return {depths: depths, estimators: estimators, points: points, isGood: isGood,
    total: points.length, goodCount: points.filter(function (p) { return p.good; }).length};
});
