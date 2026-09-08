"""Analytic CLT examples and one seeded repeated-sampling illustration."""
import json
import math
import random
import statistics


def standardized_exponential_mean(z, n):
    x = 1 + z/math.sqrt(n)
    if x <= 0:
        return 0.0
    # Xbar ~ Gamma(shape=n, scale=1/n); density change dx/dz = 1/sqrt(n).
    return math.exp(n*math.log(n)+(n-1)*math.log(x)-n*x-math.lgamma(n))/math.sqrt(n)


def model():
    normal = statistics.NormalDist()
    z = [i/100 for i in range(-400, 401)]
    clt = [dict(n=n, se=1/math.sqrt(n), skew=2/math.sqrt(n),
                rows=[[v, standardized_exponential_mean(v, n)] for v in z])
           for n in [4, 16, 64]]
    rng = random.Random(20260908)
    samples = [[rng.gauss(100, 20) for _ in range(10)] for _ in range(20)]
    q = normal.inv_cdf(.975)
    half = q*20/math.sqrt(10)
    coverage = []
    for i, sample in enumerate(samples, 1):
        mean = statistics.mean(sample)
        coverage.append(dict(i=i, sample=sample, mean=mean, lo=mean-half,
                             hi=mean+half, covers=mean-half <= 100 <= mean+half))
    return dict(normal=[[v, normal.pdf(v)] for v in z],
                bands=[dict(k=k, mass=normal.cdf(k)-normal.cdf(-k)) for k in [1, 2, 3]],
                clt=clt, coverage=coverage, critical=q, half=half,
                covered=sum(row['covers'] for row in coverage))


if __name__ == '__main__':
    print(json.dumps(model(), allow_nan=False))
