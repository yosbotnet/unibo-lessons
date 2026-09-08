"""Same seeded sample, three explicitly different null hypotheses."""
import numpy as np
from scipy.stats import shapiro, kstest

# Preserve the lecture's legacy random stream, not default_rng's different stream.
data = 20 * np.random.RandomState(20).randn(100) + 100
alpha = 0.05
tests = [
    ("Some normal distribution", shapiro(data)),
    ("Specified N(0, 1)", kstest(data, "norm")),
    ("Specified N(100, 20²)", kstest(data, "norm", args=(100, 20))),
]
for null, result in tests:
    decision = "Reject H0" if result.pvalue <= alpha else "Do not reject H0"
    print(f"{null}: statistic={result.statistic:.6g}, p={result.pvalue:.6g}; {decision}")
# The last null uses the known generating parameters, not estimates from data.
# Non-rejection is not proof of normality; p printed as 0 can reflect numerical limits.
