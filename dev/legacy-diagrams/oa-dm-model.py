"""Reproduce the two printed orderings; this does not validate forecast provenance."""
import json
import math
from scipy.stats import t, norm

ACTUAL = [417, 391, 419, 461, 472, 535, 622, 606, 508, 461, 390, 432]
MLP_LIST = [414.231, 417.662, 381.815, 423.952, 469.055, 471.502,
            547.532, 639.609, 596.040, 477.471, 445.010, 368.674]
MLP_CODE = [417.662, 381.815, 423.952, 469.055, 471.502, 547.532,
            639.609, 596.040, 477.471, 445.010, 368.674, 414.231]
LSTM = [416.999, 390.999, 418.999, 461.000, 471.999, 535.000,
        622.000, 606.000, 507.999, 461.000, 390.000, 431.999]


def calculate(actual, first, second):
    # Deliberately limited to this 12-position, squared-loss, h=1 worked example.
    if any(not isinstance(x, list) or len(x) != 12 for x in (actual, first, second)):
        raise ValueError("This example requires three aligned lists of length 12")
    if any(type(v) not in (int, float) or not math.isfinite(v) or abs(v) > 1e6
           for x in (actual, first, second) for v in x):
        raise ValueError("Expected finite numeric values of magnitude at most 1e6")
    n = len(actual)
    loss1 = [(a - p)**2 for a, p in zip(actual, first)]
    loss2 = [(a - p)**2 for a, p in zip(actual, second)]
    differences = [a - b for a, b in zip(loss1, loss2)]
    mean = math.fsum(differences) / n
    gamma0 = math.fsum((d - mean)**2 for d in differences) / n
    if gamma0 <= 0:
        raise ValueError("A positive loss-difference variance is required")
    raw = mean / math.sqrt(gamma0 / n)
    factor = math.sqrt((n - 1) / n)  # Harvey–Leybourne–Newbold factor at h=1
    modified = factor * raw
    return dict(mean=mean, mse1=math.fsum(loss1)/n, mse2=math.fsum(loss2)/n,
                differences=differences, gamma0=gamma0, raw=raw, factor=factor,
                statistic=modified, pvalue=float(2*t.sf(abs(modified), n-1)),
                critical=float(t.ppf(0.975, n-1)), normalP=float(2*norm.sf(abs(raw))))


def example():
    return dict(n=12, h=1, loss="squared error", df=11, alpha=0.05,
                actual=ACTUAL, lstm=LSTM, mlpList=MLP_LIST, mlpCode=MLP_CODE,
                listResult=calculate(ACTUAL, MLP_LIST, LSTM),
                codeResult=calculate(ACTUAL, MLP_CODE, LSTM))


if __name__ == "__main__":
    print(json.dumps(example(), indent=2, allow_nan=False))
