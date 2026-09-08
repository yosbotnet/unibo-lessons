"""Build-time Q–Q coordinates; no statistical acceptance verdict is inferred."""
import json
import math
import statistics
import sys

DATA = [-4, -3, 0.8, 1.8, 3.9, 6.2, 6.5]


def analyze(values):
    if (not isinstance(values, list) or not 2 <= len(values) <= 1000
            or any(type(x) not in (int, float) or not math.isfinite(x)
                   or abs(x) > 1e6 for x in values)):
        raise ValueError("Expected 2–1000 finite numeric observations of magnitude <= 1e6")
    x = sorted(values)
    n = len(x)
    mu, scale, sample_sd = statistics.mean(x), statistics.pstdev(x), statistics.stdev(x)
    if scale == 0:
        raise ValueError("A constant sample has no positive fitted normal scale")
    rows = []
    for i, observed in enumerate(x, 1):
        p = (i - 0.5) / n
        z = statistics.NormalDist().inv_cdf(p)
        rows.append(dict(i=i, observed=observed, p=p, z=z, fitted=mu + scale * z))
    return dict(n=n, mean=mu, scale=scale, sampleSD=sample_sd,
                scaleDenominator=n, plottingPosition="(i - 0.5) / n", rows=rows)


if __name__ == "__main__":
    values = json.load(sys.stdin) if "--stdin" in sys.argv else DATA
    print(json.dumps(analyze(values), allow_nan=False))
