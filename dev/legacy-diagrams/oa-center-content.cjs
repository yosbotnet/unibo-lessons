'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),m=require('../../oa/assets/center.js'),box=require('../../oa/assets/boxplot.js');
const root=path.resolve(__dirname,'../..'),file='oa/cap-08-statistics.html';
const sources={location:'https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm',variance:'https://numpy.org/doc/stable/reference/generated/numpy.var.html',quantile:'https://numpy.org/doc/stable/reference/generated/numpy.quantile.html',variation:'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.variation.html',mode:'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mode.html',pandas:'https://pandas.pydata.org/docs/reference/api/pandas.Series.std.html',cv:'https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/coefvari.htm',excel:'https://support.microsoft.com/it-IT/Excel/statistical-functions-reference'};
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function table(id,caption,heads,rows,foot=''){return `<div class="figure-table" data-center-table="${id}" tabindex="0" role="region" aria-label="${caption}: scroll horizontally"><table><caption>${caption}</caption><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row[0]}</th>${row.slice(1).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>${foot}</table></div>`;}
const syntheticCode=`import numpy as np

def transformed(a):
    u = (np.arange(121) - 60) / 60
    return 100 + 60*u if a == 0 else 100 + 60*np.expm1(a*u)/a

x = transformed(1.5)  # deterministic grid, not a random sample
edges = np.linspace(x.min(), x.max(), 15)
counts, _ = np.histogram(x, bins=edges)
print(x.mean(), np.median(x))
print(counts)
print(np.flatnonzero(counts == counts.max()) + 1)  # ALL highest-count bins
assert len(np.unique(x)) == 121  # no unique sample mode
# The central grid point u=0 maps to x=100 for every a.`;
const numericCode=`import numpy as np
import pandas as pd
from scipy import stats

x = np.array([151, 124, 132, 170, 146, 124, 113], dtype=float)
mean = x.mean()
ss = np.sum((x - mean)**2)
print("Mean, median:", mean, np.median(x))
values, counts = np.unique(x, return_counts=True)
print("All sample modes:", values[counts == counts.max()])
print("Linear quartiles:", np.quantile(x, [.25, .5, .75], method="linear"))
s = np.sort(x)
print("Median-of-halves quartiles:", np.median(s[:3]), np.median(s[4:]))
print("Sum of squared deviations:", ss)
for ddof in [0, 1]:
    print("ddof, variance, SD, CV percent:", ddof,
          np.var(x, ddof=ddof), np.std(x, ddof=ddof),
          100 * stats.variation(x, ddof=ddof))
assert np.isclose(stats.variation(x), np.std(x, ddof=0)/mean)
assert np.isclose(pd.Series(x).std(), np.std(x, ddof=1))
assert np.isclose(stats.iqr(x), 24.5)
# Same numeric array, no missing values; defaults are function-specific.`;
function widget(){const r=m.synthetic();return `<div class="oa-w" id="w-skew"><h4>Mean, median and the shape of a constructed sample</h4>
<p class="oa-sub">Transform an evenly spaced grid of 121 values using a. This is a deterministic illustration, not measured data or a fitted distribution. The parameter a is not a standardized skewness coefficient. The median stays at 100 by construction.</p>
<div class="oa-row"><label for="sk-skew">Transformation a: left tail / right tail</label><input type="range" id="sk-skew" min="-250" max="250" step="5" value="0" disabled><output class="oa-val" id="sk-skew-v" for="sk-skew">0.00</output></div>
<p id="sk-out" role="status" aria-live="polite">${m.summary(r)}</p>
<figure class="lk-fig"><div class="figure-diagram" data-center-plot tabindex="0" role="region" aria-label="Mean and median histogram: scroll horizontally">${m.svg(r)}</div><figcaption>The cobalt solid line marks the mean; the dashed vermilion line marks the median. They coincide at a = 0. Both the numeric horizontal range and bin width change with a, so compare numeric values rather than pixel shifts. Fourteen equal-width bins include their left endpoints; only the last includes its right endpoint. Bar heights are counts, not a density.</figcaption></figure>
<div class="figure-table" data-center-rows tabindex="0" role="region" aria-label="Synthetic histogram counts: scroll horizontally">${m.table(r)}</div>
<p>All original observations have frequency one. A highest-count histogram interval is a binning-dependent description, not a unique observed mode; all ties are shown. At a = 0, the grid is evenly spaced and small bin-count differences are discretization effects. Interval endpoints are rounded only for display.</p>
<details data-center-reproduce><summary>Reproduce the transformation and histogram (Python)</summary><pre><code class="language-python">${escape(syntheticCode)}</code></pre></details>
<noscript><p>JavaScript is disabled: the full a = 0 plot and table remain available, with the slider disabled.</p></noscript></div>`;}
function section3(){const a=m.summarize(m.speeds),b=m.summarize(m.hotels);return `<section id="s3" data-src="6 - Statistics_ descriptive.pdf">
<h2>3. Measures of central tendency: mean, median, mode</h2>
<p>Mean, median and mode summarize different aspects of location. For the numerical samples here, the arithmetic mean is x̄ = Σxᵢ/n; the median is the middle sorted value for odd n and the average of the two middle values for even n. Modes are values attaining the greatest observed frequency; there can be ties. A density’s peak and a histogram’s tallest bin are not the same object as a sample mode. See <a href="${sources.location}">NIST’s location guide</a>.</p>
${table('centers','Worked source examples',['Sample','Mean','Median','Mode'],[['Motorway speeds (km/h)',a.mean.toFixed(2),a.median,a.modes.join(', ')],['Hotel quotes',b.mean.toFixed(2),b.median,b.modes.join(', ')]])}
<p>The seven speeds are ${m.speeds.join(', ')} km/h: their sum is ${a.sum}, so x̄ = 960/7 = 137.142857…; the sorted values are 113, 124, 124, 132, 146, 151, 170. The six hotel quotes are ${m.hotels.join(', ')}: the two central sorted values are 274 and 292, giving median 283.</p>
<p>Python: <code>np.mean(x)</code>, <code>np.median(x)</code>, and <code>stats.mode(x)</code>. <a href="${sources.mode}">SciPy mode returns only one value when modes tie</a>; use counts to retain all modes, as in the reproduction below. Italian Excel names include <code>MEDIA</code>, <code>MEDIANA</code>, and <code>MODA.SNGL</code>/<code>MODA.MULT</code> for single/multiple modes (the slides use legacy <code>MODA</code>); see the <a href="${sources.excel}">Microsoft function reference</a>.</p>
<h3>Robustness is not a claim that one summary is always better</h3>
<p>Replacing one value x by x + Δ changes the sample mean by exactly Δ/n. The median depends on ranks and is less sensitive to moving an already extreme observation farther out, but it can change when observations cross the middle or enough values are replaced. Section 6 demonstrates this explicitly. Choose a summary for the question: expected total workload and typical daily workload need not have the same answer. Extreme but valid observations are not automatically errors.</p>
<p>For finite data, symmetry about c means that reflection x → 2c−x preserves values and multiplicities. For a distribution, the reflected random variable must have the same distribution; its mean need not exist. Equality of mean, median and mode is neither a definition nor a sufficient test of symmetry. A symmetric distribution or sample may also have modes away from its center.</p>
<figure class="lk-fig"><div class="figure-diagram" data-symmetry-plot tabindex="0" role="region" aria-label="Symmetry counterexamples: scroll horizontally">${m.symmetrySvg()}</div><figcaption>Two synthetic counterexamples, with one dot per observation and the same numeric axis. Left: −4, −1, 0, 0, 0, 2, 3 have mean = median = mode = 0, but the reflected values do not match. Right: −2, −2, −1, 1, 2, 2 are symmetric about zero, yet their modes are −2 and 2. The dashed vermilion line marks zero. These are exact finite-sample examples, not normality tests.</figcaption></figure>
${widget()}
</section>`;}
function section4(){const a=box.summarize(m.speeds,'halves'),b=box.summarize(m.speeds);return `<section id="s4" data-src="6 - Statistics_ descriptive.pdf">
<h2>4. Quartiles, percentiles and the IQR</h2>
<p>Quantiles describe positions in an ordered distribution; percentiles use p/100, and Q1, Q2, Q3 correspond to p = 0.25, 0.5, 0.75. With the usual numerical median convention, Q2 is the median. Ties and finite samples prevent a guarantee that exactly 25% or 75% of observations are strictly below a reported quartile. Sample quantiles also depend on the selected estimator.</p>
<p>One population convention is Q(p) = inf{x: F(x) ≥ p} for 0 &lt; p &lt; 1. Interpolated sample estimators need not equal that inverse applied to the empirical CDF. <a href="${sources.quantile}">NumPy’s linear method</a> uses h = (n−1)p on the zero-based sorted array and interpolates between floor(h) and ceil(h). The slides instead use medians of halves in the worked examples; for seven values the middle observation is excluded from both halves.</p>
${table('quartiles','Seven motorway speeds: declare the convention',['Convention','Q1','Median','Q3','IQR'],[[ 'Slide: median of halves',a.q1,a.median,a.q3,a.iqr],['Linear interpolation',b.q1,b.median,b.q3,b.iqr]])}
<p>IQR = Q3 − Q1. The slide’s 151 − 124 = 27 is correct for its convention; the linear result is 148.5 − 124 = 24.5. Only the value 113 is strictly below Q1 = 124; the two observations equal to 124 are not “below” it. Likewise 151 is not strictly above Q3 = 151. This is why strict percentage claims are misleading with ties and seven observations.</p>
<pre><code class="language-python">np.quantile(x, [.25, .5, .75], method='linear')
pd.Series(x).quantile([.25, .5, .75], interpolation='linear')
stats.iqr(x, interpolation='linear')  # 24.5 for these seven speeds</code></pre>
<p>The IQR is a spread measure based on the central ranks, not squared distance from the mean. It is less sensitive to moving tail observations farther out, but it is not invariant under arbitrary data changes. Use the same quartile convention when calculating the fences in section 6.</p>
</section>`;}
function section5(){const r=m.summarize(m.speeds);return `<section id="s5" data-src="6 - Statistics_ descriptive.pdf">
<h2>5. Measures of dispersion: range, variance, CV</h2>
<p>Spread has several definitions. Range = max − min uses the extremes; IQR uses quartiles; variance averages squared deviations from a specified center. Their sensitivity and units differ. The slide’s separate range example has min 25 and max 203 km/h, hence range 178; the seven motorway speeds instead have range 170 − 113 = 57 km/h. Python <code>np.ptp(x)</code> or <code>max(x)-min(x)</code> calculates a range; <code>range()</code> does not.</p>
<h3>Separate descriptive spread from a variance estimator</h3>
<pre><code>Observed mean: x̄ = Σxᵢ / n
SS = Σ(xᵢ − x̄)²
Descriptive variance: vₙ = SS / n
Sample variance:      s² = SS / (n−1), n &gt; 1
If the true mean μ is known: Σ(xᵢ − μ)² / n</code></pre>
<p>vₙ describes the observed values; it does not require knowing a population mean. For an i.i.d. sample with finite population variance, s² is an unbiased estimator of that variance. If the true μ is known, the final formula is unbiased under that model, but it centers on μ, not on x̄. Do not label SS/n around the sample mean as the known-mean formula. These statements do not automatically apply to dependent traffic days or supply a valid confidence interval.</p>
<p>Standard deviation is the square root of the chosen variance. It has the original measurement units; variance has squared units. Taking the square root of an unbiased variance estimator does not generally produce an unbiased standard-deviation estimator.</p>
${table('deviations','Motorway speeds: deviations calculated before rounding',['Speed (km/h)','xᵢ − x̄ (km/h)','(xᵢ − x̄)² (km/h)²'],m.speeds.map((v,i)=>[v,r.deviations[i].toFixed(2),r.squares[i].toFixed(2)]),`<tfoot><tr><th scope="row">Sum ${r.sum}</th><td>0 exactly</td><td>${r.ss.toFixed(2)}</td></tr></tfoot>`)}
<p>SS = 16134/7 = ${r.ss.toFixed(6)}…; calculations use the unrounded mean 960/7. Cells and totals are rounded independently for display. In particular, √(SS/7) = ${r.sd0.toFixed(6)}…, which rounds to <strong>18.15</strong> km/h at two decimals; the slide prints 18.14.</p>
${table('denominators','One sample, two declared denominators',['Divisor','Variance (km/h)²','SD (km/h)','CV percent'],[['n = 7',r.variance0.toFixed(6),r.sd0.toFixed(6),r.cv0.toFixed(6)],['n−1 = 6',r.variance1.toFixed(6),r.sd1.toFixed(6),r.cv1.toFixed(6)]])}
<p><a href="${sources.variance}">NumPy var</a> and std default to <code>ddof=0</code> (divisor n); use <code>ddof=1</code> for n−1. <a href="${sources.pandas}">pandas Series.std</a> defaults to <code>ddof=1</code>. Defaults belong to individual functions, not to a library as a whole. Italian Excel uses <code>VAR.P</code>/<code>DEV.ST.P</code> for the n convention and <code>VAR.C</code>/<code>DEV.ST.C</code> for n−1.</p>
<h3>CV requires a meaningful scale and a declared denominator</h3>
<p>For positive ratio-scale quantities with a meaningful zero and positive mean, CV percent = 100 × SD/x̄. Its relative-spread interpretation needs that scale: multiplying all observations by the same positive constant leaves it unchanged, but adding an offset generally changes it. A Celsius/Fahrenheit conversion is not a pure rescaling. CV is undefined at zero mean and unstable near zero; it is not a universally meaningful comparison of arbitrary variables. See the <a href="${sources.cv}">NIST CV guide</a>.</p>
<p><a href="${sources.variation}">SciPy stats.variation</a> returns SD/mean, not a percentage, and defaults to <code>ddof=0</code>. It does not take the absolute value of the mean, so it can return a negative number without establishing a meaningful relative-spread interpretation. For the speeds, multiply by 100 to obtain ${r.cv0.toFixed(2)}% with ddof=0 or ${r.cv1.toFixed(2)}% with ddof=1. The slide’s 14.3% agrees with the latter after rounding; its plain <code>stats.variation(npa)</code> call would not reproduce that convention.</p>
<details data-center-numeric><summary>Reproduce the source statistics and function defaults (Python)</summary><pre><code class="language-python">${escape(numericCode)}</code></pre></details>
<p>For the 31 August counts, <code>pd.Series(data).describe()</code> reports mean 4258, sample SD 720.147901, min 2794, linear quartiles 3943.5 / 4438 / 4791, and max 5167. These summarize the recorded days; the output does not prove an i.i.d. sampling design. The frequency and box widgets use this same data source.</p>
</section>`;}
const quizzes=[
 ['Give the definitions and the Excel/Python functions for mean, median and mode.','For numerical data, the mean is Σxᵢ/n; the median is the central sorted value or the average of the two central values; modes attain the highest observed frequency and can tie. Python: np.mean, np.median; stats.mode returns one mode, not all ties. Italian Excel: MEDIA, MEDIANA, MODA.SNGL/MODA.MULT. The speeds have mean 137.142857…, median 132 and mode 124.'],
 ['Why is the median a better measure of centrality than the mean on distorted distributions, and when are data called symmetric?','The median is less sensitive to moving already extreme observations farther out, but it can change when ranks around the center change. It is not automatically better for every target. Symmetry means invariance under reflection about a center, not merely equality of three summaries. −4, −1, 0, 0, 0, 2, 3 have mean = median = mode = 0 but are not symmetric. The widget fixes its median by construction and does not have a unique sample mode.'],
 ['Define quartiles, percentiles and the IQR, and state the relation between median, Q2 and the 50th percentile.','Quartiles correspond to probabilities .25, .5 and .75; Q2 is the usual numerical median. Declare the sample quantile convention. Ties and finite samples prevent exact strict-below percentage claims. IQR = Q3 − Q1: the slide’s median-of-halves motorway example gives 27, whereas linear interpolation gives 24.5. Neither convention can be substituted silently in the fences.'],
 ['Define range, variance, standard deviation and coefficient of variation, and state when n &#8722; 1 is used instead of n.','Range is max − min. Descriptive variance is SS/n around x̄; SS/(n−1) is unbiased for population variance under i.i.d. sampling with finite variance. A known-mean formula instead centers on the true μ. SD is the square root, not generally an unbiased estimator itself. CV percent is 100 × SD/mean, meaningful on suitable positive ratio scales and unchanged only by positive rescaling, not arbitrary offsets. NumPy var/std and SciPy variation default to ddof=0; pandas Series.std defaults to 1. The speeds give SD 18.15 and CV 13.23% with n, or 19.60 and 14.29% with n−1.']
];
function stripOldWidget(s){return s.replace(/\/\* ---- Bespoke widget: mean vs median under skewness ---- \*\/[\s\S]*?(?=\/\* ---- Bespoke widget: confidence intervals on the z-scale ---- \*\/)/,'');}
function next(html){let s=html;for(const [i,section] of [[3,section3],[4,section4],[5,section5]]){const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert(re.test(s));s=s.replace(re,section());}for(const [q,a] of quizzes){const marker='<summary>'+q+'</summary>',start=s.indexOf(marker);assert(start>=0,q);const end=s.indexOf('</details>',start);s=s.slice(0,start)+marker+'\n<p>'+a+'</p>\n      '+s.slice(end);}s=stripOldWidget(s);if(!s.includes('href="assets/center.css"'))s=s.replace('</head>','<link rel="stylesheet" href="assets/center.css">\n</head>');if(!s.includes('src="assets/center.js"'))s=s.replace('<script src="assets/boxplot-widget.js"></script>','<script src="assets/boxplot-widget.js"></script>\n<script src="assets/center.js"></script>\n<script src="assets/center-widget.js"></script>');return s;}
if(require.main===module){const old=fs.readFileSync(root+'/'+file,'utf8'),updated=next(old);if(process.argv.includes('--check')){assert.equal(updated,old);console.log('OA center/spread content synchronized');}else process.stdout.write('*** Begin Patch\n'+(updated!==old?'*** Update File: '+root+'/'+file+'\n'+require('./transfer-content.cjs').hunks(old,updated):'')+'*** End Patch\n');}
module.exports={file,sources,syntheticCode,numericCode,quizzes,section3,section4,section5,stripOldWidget,next};
