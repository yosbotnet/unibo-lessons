"""Fixed teaching example; standard-library arithmetic, no fitting dependencies."""
import json
import math


def normal(x, mu=0.0, sigma=0.25):
    if any(isinstance(v, bool) or not isinstance(v, (float, int)) or not math.isfinite(v)
           for v in (x, mu, sigma)) or sigma <= 0:
        raise ValueError("Expected finite numbers and a positive standard deviation")
    z = (x - mu) / sigma
    return math.exp(-z*z/2) / (sigma*math.sqrt(2*math.pi)), math.erfc(-z/math.sqrt(2))/2


def model():
    rows = [[i/200, *normal(i/200)] for i in range(-200, 201)]
    a, b = -0.25, 0.25
    fa, fb = normal(a)[1], normal(b)[1]
    return dict(mu=0, sigma=0.25, a=a, b=b, rows=rows, fa=fa, fb=fb,
                area=fb-fa, peak=normal(0)[0], pointProbability=0)


if __name__ == "__main__":
    print(json.dumps(model(), allow_nan=False))
