'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file='oa/cap-08-statistics.html';
const sources={norm:'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.norm.html',fitter:'https://fitter.readthedocs.io/en/latest/references.html',distfit:'https://erdogant.github.io/distfit/pages/html/Functions.html'};
const data=JSON.parse(execFileSync('python3',['-B',__dirname+'/oa-density-model.py'],{encoding:'utf8'}));
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const normalCode=`import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import norm

x = np.linspace(-5, 5, 1001)  # display window, not the full support
fig, axes = plt.subplots(1, 2)
for sigma in [0.5, 1, 2]:
    axes[0].plot(x, norm.pdf(x, loc=0, scale=sigma), label=f"SD={sigma}")
    axes[1].plot(x, norm.cdf(x, loc=0, scale=sigma), label=f"SD={sigma}")
for ax, name in zip(axes, ["Density f(x)", "Cumulative probability F(x)"]):
    ax.set(xlabel="x", ylabel=name)
    ax.legend()
fig.tight_layout()
plt.show()

# The paired teaching figure uses a narrower normal: SD=0.25.
rv = norm(loc=0, scale=0.25)
print("Density at zero:", rv.pdf(0))  # 1.595769..., not a probability
print("P(-0.25 < X <= 0.25):", rv.cdf(0.25) - rv.cdf(-0.25))
# For this continuous model, P(X=0)=0.`;
const fitterCode=`import numpy as np
import matplotlib.pyplot as plt
from scipy import stats
from fitter import Fitter

rng = np.random.default_rng(20260908)
data = stats.gamma.rvs(2, loc=1.5, scale=2, size=10000, random_state=rng)
candidates = ["norm", "gamma", "expon"]  # SciPy uses norm, not normal
f = Fitter(data, distributions=candidates, bins=100, density=True, verbose=False)
f.fit(max_workers=1, progress=False)
scores = f.df_errors["sumsquare_error"].reindex(candidates)
assert np.isfinite(scores.to_numpy()).all(), "At least one fit failed"
print(scores.sort_values())
print(f.get_best(method="sumsquare_error"))
name = scores.idxmin()
params = f.fitted_param[name]  # shape parameters (if any), loc, scale
grid = np.linspace(data.min(), data.max(), 501)
fig, ax = plt.subplots()
ax.hist(data, bins=100, density=True, alpha=0.25)
ax.plot(grid, getattr(stats, name).pdf(grid, *params), label=name)
ax.set(xlabel="Synthetic value", ylabel="Density")
ax.legend()
plt.show()`;
const distfitCode=`import numpy as np
import matplotlib.pyplot as plt
from distfit import distfit

rng = np.random.default_rng(20260908)
data = rng.normal(loc=0, scale=2, size=10000)  # a separate synthetic sample
candidates = ["norm", "gamma", "expon"]
dfit = distfit(method="parametric", distr=candidates, stats="RSS", bins=100,
              mhist="numpy", n_boots=None, n_jobs=1, verbose="warning")
dfit.fit_transform(data)
scores = dfit.summary.set_index("name")["score"].reindex(candidates).astype(float)
assert np.isfinite(scores.to_numpy()).all(), "At least one fit failed"
print(scores.sort_values())
print(dfit.model["name"], dfit.model["params"])
grid = np.linspace(data.min(), data.max(), 501)
fig, ax = plt.subplots()
ax.hist(data, bins=100, density=True, alpha=0.25)
ax.plot(grid, dfit.model["model"].pdf(grid), label=dfit.model["name"])
ax.set(xlabel="Synthetic value", ylabel="Density")
ax.legend()
plt.show()`;
const plot={left:55,right:405,width:240,top:76,bottom:294,pdfMax:1.7};
const x=(v,k=0)=>plot.left+350*k+(v+1)/2*plot.width;
const y=(v,k=0)=>plot.bottom-v/(k?1:plot.pdfMax)*(plot.bottom-plot.top);
function svg(){const d=data,line=k=>d.rows.map((row,i)=>`${i?'L':'M'}${x(row[0],k)} ${y(row[k+1],k)}`).join(' '),area=`M${x(d.a)} ${plot.bottom} `+d.rows.filter(row=>row[0]>=d.a&&row[0]<=d.b).map(row=>`L${x(row[0])} ${y(row[1])}`).join(' ')+` L${x(d.b)} ${plot.bottom}Z`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 412" style="width:700px" role="img" aria-labelledby="oa-density-title" font-family="var(--lk-mono)" font-size="14" fill="var(--lk-ink)" data-generated-plot="oa-density"><title id="oa-density-title">One normal distribution, mean zero and standard deviation 0.25. PDF height at zero is 1.595769, not a probability. The shaded PDF area between −0.25 and 0.25 equals the CDF difference, 0.682689. Vertical scales differ.</title><rect width="700" height="412" fill="var(--lk-paper)"/>
${[0,1].map(k=>`<g data-density-panel="${k}"><text x="${plot.left+350*k}" y="26" fill="var(--lk-cobalt)">${k?'CDF · probability':'PDF · density'}</text><text x="${plot.left+350*k}" y="50">${k?'F(x) = P(X ≤ x)':'f(x) is not P(X = x)'}</text>${(k?[0,.5,1]:[0,.5,1,1.5]).map(v=>`<path d="M${x(-1,k)} ${y(v,k)}H${x(1,k)}" stroke="var(--lk-rule-soft)"/><text x="${x(-1,k)-10}" y="${y(v,k)+5}" text-anchor="end">${v}</text>`).join('')}<path d="M${x(-1,k)} ${plot.top}V${plot.bottom}H${x(1,k)}" stroke="var(--lk-ink)" fill="none"/>${[-1,-.5,0,.5,1].map(v=>`<path d="M${x(v,k)} ${plot.bottom}v6" stroke="var(--lk-ink)"/><text x="${x(v,k)}" y="322" text-anchor="middle">${v}</text>`).join('')}<text x="${x(1,k)+20}" y="299">x</text>${k?'':`<path data-density-area="" d="${area}" fill="var(--lk-vermilion)" fill-opacity=".22"/>`}<path data-density-curve="${k}" d="${line(k)}" stroke="var(--lk-cobalt)" stroke-width="2.5" fill="none"/>${[d.a,d.b].map(v=>`<path data-density-guide="${v}" d="M${x(v,k)} ${plot.bottom}V${y(d.rows.find(row=>row[0]===v)[k+1],k)}" stroke="var(--lk-vermilion)" stroke-dasharray="4 3" fill="none"/>`).join('')}</g>`).join('')}
<circle data-density-peak="" cx="${x(0)}" cy="${y(d.peak)}" r="4" fill="var(--lk-vermilion)"/>
${[[d.a,d.fa],[d.b,d.fb]].map(([v,f])=>`<path data-density-cdf-guide="${v}" d="M${x(v,1)} ${y(f,1)}H670" stroke="var(--lk-vermilion)" stroke-dasharray="4 3"/><circle data-density-cdf-point="${v}" cx="${x(v,1)}" cy="${y(f,1)}" r="4" fill="var(--lk-vermilion)"/>`).join('')}
<path data-density-difference="" d="M664 ${y(d.fb,1)}H676M670 ${y(d.fb,1)}V${y(d.fa,1)}M664 ${y(d.fa,1)}H676" fill="none" stroke="var(--lk-vermilion)" stroke-width="2"/>
<text x="55" y="356" fill="var(--lk-vermilion)">Shaded area = ${d.area.toFixed(6)}</text><text x="405" y="356" fill="var(--lk-vermilion)">ΔF = ${d.area.toFixed(6)}</text>
<text x="350" y="391" text-anchor="middle">Same X ~ N(0, 0.25²) · same x scale · different y scales</text></svg>`;}
const rows=[['Density at zero: f(0)',data.peak.toFixed(6),'Height, not a probability; it can exceed 1.'],['Point probability: P(X = 0)','0','Zero for this absolutely continuous model.'],['CDF at a = −0.25',data.fa.toFixed(6),'P(X ≤ −0.25)'],['CDF at b = 0.25',data.fb.toFixed(6),'P(X ≤ 0.25)'],['Interval: P(a < X ≤ b)',data.area.toFixed(6),'Area under f = F(b) − F(a).']];
const quiz=['Distinguish PDF, PMF and CDF.','For an absolutely continuous variable, a PDF f is nonnegative and integrates to one: interval probabilities are areas, not individual heights; P(X=x)=0 even when f(x)>1. For a discrete variable, a PMF p(x)=P(X=x) assigns masses summing to one. The cumulative distribution function F(x)=P(X≤x) applies to both. For a<b, F(b)−F(a)=P(a<X≤b); a discrete CDF has jumps. CDF means cumulative distribution, not cumulative density.'];
function section(){return `<section id="s7" data-src="6 - Statistics_ descriptive.pdf">
<h2>7. Distributions, PDF, PMF, CDF and the Gaussian</h2>
<p>A probability distribution assigns probabilities to events. An empirical distribution describes observed frequencies; a theoretical model proposes probabilities for a random variable X. A histogram summarizes a sample using chosen bins, but a distribution is not necessarily a smooth curve fitted to a histogram. Distinguish counts, probability masses, densities and cumulative probabilities.</p>
<div class="lk-tabs" data-kit="tabs"><div class="lk-tablist"><button class="lk-tab">PDF and PMF</button><button class="lk-tab">CDF</button><button class="lk-tab">The Gaussian</button></div>
<div class="lk-tabpanel"><h3>Density is not point probability</h3><p>For an absolutely continuous variable, a probability density function f is nonnegative and ∫ f(x) dx over the whole real line equals 1. P(a &lt; X ≤ b) = ∫ₐᵇ f(x) dx. An individual height f(x) is not P(X = x): point probabilities are zero, and density heights can exceed 1. If x carries units, density carries inverse units, so its area is dimensionless. Nonnegative density does not mean that x must be positive.</p><p>For a discrete variable, the probability mass function p(x) = P(X = x) assigns mass to each possible value; these masses sum to 1. For a fair die, p(3) = 1/6. A discrete probability is a mass, not an area under a continuous density. The binomial example in <a href="#s11">section 11</a> uses a PMF.</p></div>
<div class="lk-tabpanel"><h3>Cumulative distribution function</h3><p>F(x) = P(X ≤ x) applies to discrete and continuous variables. It is nondecreasing, takes values in [0, 1], and approaches 0 and 1 at the two infinite limits. For a &lt; b, F(b) − F(a) = P(a &lt; X ≤ b). For an absolutely continuous distribution, F(x) = ∫₋∞ˣ f(t) dt; endpoints of an interval have zero probability. A discrete CDF has jumps: for a fair die, F(3) = 3/6 and its jump at 3 is 1/6. It is a cumulative <em>distribution</em> function, not another density.</p></div>
<div class="lk-tabpanel"><h3>The normal model</h3><p>X ~ N(μ, σ²), with σ &gt; 0, has mean μ and standard deviation σ. Its density is symmetric about μ and has support on the whole real line. Larger σ spreads the probability over a wider range and lowers the peak. This is a model to justify, not a default conclusion about any measured sample.</p><pre><code>f(x) = exp(−(x−μ)² / (2σ²)) / (σ√(2π)),  −∞ &lt; x &lt; ∞</code></pre><p>In <a href="${sources.norm}">SciPy norm</a>, <code>loc</code> is μ and <code>scale</code> is σ, not σ². <code>pdf</code> evaluates density, <code>cdf</code> evaluates cumulative probability, and <code>rvs</code> generates random observations. These operations are different. Standardizing arbitrary data does not make their distribution normal.</p></div></div>
<h3>One interval, two equivalent probability calculations</h3>
<figure class="lk-fig"><div class="figure-diagram" data-density-plot tabindex="0" role="region" aria-label="PDF and CDF comparison: scroll horizontally">${svg()}</div><figcaption>Calculated example, not fitted data: X ~ N(0, 0.25²), a = −0.25 and b = 0.25. Vermilion marks the PDF area and the matching vertical CDF difference. The dotted vertical lines share the same x positions in both panels. The peak dot marks a density height, not a point mass. The finite window [−1, 1] does not show the normal distribution’s entire support; vertical scales intentionally differ. Curves use 401 calculated points; probabilities below come from the CDF, not the polygon’s pixel area.</figcaption></figure>
<div class="figure-table" data-density-table tabindex="0" role="region" aria-label="Density and probability values: scroll horizontally"><table><caption>Same normal model; values rounded only for display</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Value</th><th scope="col">Interpretation</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${escape(row[0])}</th><td>${row[1]}</td><td>${escape(row[2])}</td></tr>`).join('')}</tbody></table></div>
<details data-density-code="normal"><summary>Reproduce PDF/CDF values and compare three standard deviations (Python)</summary><pre><code class="language-python">${escape(normalCode)}</code></pre></details>
<h3>Fitting compares candidates; it does not certify a model</h3>
<p>The slides introduce <a href="${sources.fitter}">Fitter</a> and <a href="${sources.distfit}">distfit</a>. These examples retain their two separate synthetic samples: gamma with shape 2, location 1.5 and scale 2; then normal with mean 0 and SD 2. Both are seeded for reproduction, use 100 density-histogram bins and compare only <code>norm</code>, <code>gamma</code> and <code>expon</code>. The SciPy candidate name is <code>norm</code>, not <code>normal</code>. Parameters are fitted freely; the generating parameters are not supplied to the fitting tools.</p>
<p>For the settings below, SSE/RSS is Σⱼ(hⱼ − f̂(cⱼ))², comparing histogram density hⱼ with the fitted PDF at bin center cⱼ. Lower is better for that sample, binning and candidate set. This is not a p-value or an integrated probability; changing the bins can change the ranking. Candidate failure is checked explicitly. Neither sample represents the traffic observations elsewhere in the chapter.</p>
<details data-density-code="fitter"><summary>Fitter: seeded gamma sample, three candidates (Python)</summary><pre><code class="language-python">${escape(fitterCode)}</code></pre></details>
<details data-density-code="distfit"><summary>distfit: seeded normal sample, three candidates (Python)</summary><pre><code class="language-python">${escape(distfitCode)}</code></pre></details>
<p>These snippets were executed with Fitter 1.8.0, distfit 2.0.2, NumPy 2.3.3, SciPy 1.16.2 and Matplotlib 3.10.7. The overlays deliberately show only the density fit, not automatically generated probability thresholds labelled as confidence intervals. In distfit, <code>n_boots=None</code> requests no bootstrap validation.</p>
<p>A winning candidate is not proof of the true family. In-sample fitting and model selection must be accounted for when calibrating goodness-of-fit tests; a standard known-parameter KS p-value is not automatically valid after estimating those parameters from the same sample. Parametric does not mean “always normal”, and nonparametric does not mean “assumption-free”. Choose a test for the question and sampling design, including pairing and dependence: see <a href="#s12">section 12</a> and the <a href="#s13">normality caveats in section 13</a>. A density-fitting leaderboard alone does not authorize a test.</p>
</section>`;}
function next(html){const re=/<section id="s7"[^>]*>[\s\S]*?<\/section>/;assert(re.test(html));let s=html.replace(re,section());const marker='<summary>'+quiz[0]+'</summary>',start=s.indexOf(marker);assert(start>=0);const end=s.indexOf('</details>',start);assert(end>start);s=s.slice(0,start)+marker+'\n<p>'+escape(quiz[1])+'</p>\n      '+s.slice(end);if(!s.includes('href="assets/density.css"'))s=s.replace('</head>','<link rel="stylesheet" href="assets/density.css">\n</head>');return s;}
if(require.main===module){const old=fs.readFileSync(root+'/'+file,'utf8'),updated=next(old);if(process.argv.includes('--check')){assert.equal(updated,old);console.log('OA density content synchronized');}else process.stdout.write('*** Begin Patch\n'+(old===updated?'':'*** Update File: '+root+'/'+file+'\n'+require('./transfer-content.cjs').hunks(old,updated))+'*** End Patch\n');}
module.exports={file,sources,data,plot,x,y,svg,rows,normalCode,fitterCode,distfitCode,quiz,section,next};
