'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),m=require('../../oa/assets/boxplot.js');
const root=path.resolve(__dirname,'../..'),file='oa/cap-08-statistics.html';
const sources={box:'https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.boxplot.html',quantile:'https://numpy.org/doc/stable/reference/generated/numpy.quantile.html',outlier:'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm',scatter:'https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm',positions:'https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.scatter.html'};
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const roadCode=`import numpy as np
import matplotlib.pyplot as plt

speeds = np.array([62, 64, 68, 70, 70, 74, 74, 76, 76, 78, 78, 80])
s = np.sort(speeds)
# Reproduce this slide's median-of-halves convention explicitly.
q1, med, q3 = np.median(s[:6]), np.median(s), np.median(s[6:])
iqr = q3 - q1
inside = s[(s >= q1 - 1.5 * iqr) & (s <= q3 + 1.5 * iqr)]
fliers = s[(s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)]
fig, ax = plt.subplots()
ax.bxp([dict(q1=q1, med=med, q3=q3,
             whislo=inside.min(), whishi=inside.max(), fliers=fliers)],
       orientation="horizontal")
ax.set_xlabel("Speed (km/h)")
print(q1, med, q3, iqr)  # 69.0 74.0 77.0 8.0
print(np.quantile(s, [.25, .5, .75], method="linear"))
# [69.5 74.  76.5] — a different, explicitly chosen convention
plt.show()`;
const scatterCode=`import numpy as np
import matplotlib.pyplot as plt

# Synthetic observations A–E; not the course's traffic data.
xy = np.array([[1, 4], [2, 1], [3, 3], [4, 5], [5, 2]])
fig, axes = plt.subplots(1, 2, sharex=True, sharey=True)
axes[0].scatter(xy[:, 0], xy[:, 1])
wrong = np.column_stack((np.sort(xy[:, 0]), np.sort(xy[:, 1])))
axes[1].scatter(wrong[:, 0], wrong[:, 1])  # Deliberately WRONG pairing
axes[0].set_title("Original pairs")
axes[1].set_title("Sorted separately: artificial association")
for ax in axes:
    ax.set(xlim=(.5, 5.5), ylim=(.5, 5.5), xlabel="x", ylabel="y")
    ax.set_aspect("equal")
print(np.corrcoef(xy.T)[0, 1])     # 0.0
print(np.corrcoef(wrong.T)[0, 1])  # 1.0 (up to floating-point rounding)
plt.show()`;
const pairingCode=`# Use this only if each existing row represents a meaningful matched unit.
# Otherwise first join on a verified observational key, not row position.
paired = df[['ago1', 'set1']].dropna()  # Remove incomplete PAIRS together.
plt.scatter(paired['ago1'].to_numpy(), paired['set1'].to_numpy())
# No independent sort_values(); sorting whole rows is harmless.`;
function region(content,label,attribute=''){return `<div class="figure-table" ${attribute} tabindex="0" role="region" aria-label="${label}: scroll horizontally">${content}</div>`;}
function roadTable(){const a=m.summarize(m.roads,'halves'),b=m.summarize(m.roads);return region(`<table><caption>Same twelve speeds, two quartile conventions</caption><thead><tr><th scope="col">Convention</th><th scope="col">Q1</th><th scope="col">Median</th><th scope="col">Q3</th><th scope="col">IQR</th><th scope="col">Fences</th></tr></thead><tbody>${[[a,'Slide: median of halves'],[b,'Linear interpolation']].map(([r,name])=>`<tr><th scope="row">${name}</th><td>${r.q1}</td><td>${r.median}</td><td>${r.q3}</td><td>${r.iqr}</td><td>${r.lower} / ${r.upper}</td></tr>`).join('')}</tbody></table>`,'Rural-road quartile conventions','data-box-conventions');}
function widget(){const r=m.traffic();return `<div class="oa-w" id="w-box"><h4>Remeasure one day; recompute the whole box-plot</h4>
<p class="oa-sub">Use the same 31 August counts as section 2, replacing only day 31 (originally 5167, the largest count). The slider is a hypothetical remeasurement, not extra observed data. Quartiles use linear interpolation at zero-based index (n−1)p; the fences use Q1 − 1.5·IQR and Q3 + 1.5·IQR.</p>
<div class="oa-row"><label for="bx-val">Remeasured count on day 31</label><input type="range" id="bx-val" min="3000" max="9500" step="1" value="5167" disabled><output class="oa-val" id="bx-val-v" for="bx-val">5167</output></div>
<p id="bx-out" role="status" aria-live="polite">${m.summary(r)}</p>
<figure class="lk-fig"><div class="figure-diagram" data-box-plot tabindex="0" role="region" aria-label="Recomputed traffic box-plot: scroll horizontally">${m.svg(r)}</div><figcaption>The axis remains fixed across slider settings. All 31 observations stay in the data; vermilion dots flag values strictly outside the dashed fences. The solid vermilion line is the median; the cobalt diamond is the mean. Exact summary values are below.</figcaption></figure>
${region(m.table(r),'Traffic box-plot summary','data-box-rows')}
<p>Try 3000: Q1, median and Q3 change as the replaced observation moves through the ordered sample. Try 9000: those three values stay at their original levels while the mean rises. This is a property of these data and replacements, not a rule that sample quantiles never move.</p>
<noscript><p>JavaScript is disabled: the original 5167 setting, complete plot and summary remain available. The slider is disabled.</p></noscript></div>`;}
function section(){return `<section id="s6" data-src="6 - Statistics_ descriptive.pdf">
<h2>6. Box-plots, outliers and paired scatter-plots</h2>
<p>A box-plot summarizes ordered quantitative data using a box from Q1 to Q3 and a median line. Specify its convention: a min–max plot extends its whiskers to the extremes; the <a href="${sources.box}">1.5·IQR variant</a> used here ends them at the most extreme observations still inside the fences. Whiskers are observed values; fences are calculated thresholds. Neither is a confidence interval.</p>
<pre><code>IQR = Q3 − Q1
Lower fence = Q1 − 1.5 × IQR
Upper fence = Q3 + 1.5 × IQR
Flag x only if x &lt; lower fence or x &gt; upper fence.</code></pre>
<figure class="lk-fig"><div class="figure-diagram" data-box-road tabindex="0" role="region" aria-label="Rural-road box-plot: scroll horizontally">${m.svg(m.summarize(m.roads,'halves'),'roads')}</div><figcaption><b>Plate 8.2</b> — The twelve rural-road speeds on one linear axis. The box spans 69–77 km/h, its median is 74, and the whiskers end at the actual minimum 62 and maximum 80. Dashed vermilion fences are 57 and 89; no supplied observation is outside them. Stacked dots retain repeated speeds; their vertical offset has no statistical meaning. The cobalt diamond marks the mean, 72.5.</figcaption></figure>
<p>The slide 30 data are 62, 64, 68, 70, 70, 74, 74, 76, 76, 78, 78, 80 km/h. Taking the median of each six-value half gives Q1 = (68 + 70)/2 = 69 and Q3 = (76 + 78)/2 = 77. Do not assume every library reproduces those quartiles: <a href="${sources.quantile}">NumPy’s linear method</a> interpolates at index (n−1)p and gives 69.5 and 76.5 for the same sample. Both conventions below have median 74, whiskers 62 and 80, and no flagged values.</p>
${roadTable()}
<details data-box-reproduce><summary>Reproduce the slide convention explicitly (Python)</summary><pre><code class="language-python">${escape(roadCode)}</code></pre></details>
<h3>A flag is a prompt to investigate, not to delete</h3>
<p>An extreme observation can be a recording error, a legitimate rare event, or evidence that the model or grouping needs attention. Check its provenance and context; correct established errors and document justified exclusions. Otherwise retain the observation and consider robust summaries or sensitivity analyses. <a href="${sources.outlier}">NIST distinguishes flagging from accommodation and formal identification</a>.</p>
<p>The slides’ “always within 3 SD” wording is not a guarantee: a normal distribution has unbounded tails. For a single observation under known normal parameters, P(|X−μ| &gt; 3σ) ≈ 0.0027, not zero. Estimated sample z-scores are a different calculation. Neither 1.5·IQR nor a 1.5–2 SD cutoff licenses automatic removal; trimming valid tails changes the data distribution and can bias the analysis.</p>
${widget()}
<h3>Scatter-plots must preserve the observational pairs</h3>
<p>A <a href="${sources.scatter}">scatter-plot</a> places each matched pair (xᵢ, yᵢ) at its two numeric coordinates; discrete counts are allowed too. It can reveal nonlinear structure, clusters and unusual observations, not just linear correlation. Association does not establish causation, and zero Pearson correlation does not establish independence.</p>
<div class="callout warn" data-pairing-warning><span class="callout-label">Correction to slide 36</span><p>The printed code independently sorts <code>ago1</code> and <code>set1</code>. Matplotlib plots the supplied <a href="${sources.positions}">x/y positions</a>; it does not repair the original pairing using pandas row labels. Sorting the columns separately can manufacture a positive trend. Sorting complete paired rows is safe because it changes only drawing order.</p></div>
<pre><code class="language-python">${escape(pairingCode)}</code></pre>
<p>For counts from different months, matching equal day numbers is itself a design choice, not simultaneous observation. The available slide extraction does not establish a verified observational key for the two series. The illustration below therefore uses explicitly synthetic pairs, not an invented August–September correlation.</p>
<figure class="lk-fig"><div class="figure-diagram" data-pairing-plot tabindex="0" role="region" aria-label="Pairing counterexample: scroll horizontally">${m.scatterSvg()}</div><figcaption>Pairing counterexample — identical axis scales and unchanged marginal values, but different pairs. Left: five synthetic observations A–E have Pearson r = 0. Right: sorting both columns independently gives artificial r = 1. Labels such as A/B mean x from A paired with y from B; only C/C retains its original match in this example. These coefficients describe the constructed data, not significance tests or real traffic measurements.</figcaption></figure>
${region(`<table data-pairing-table><caption>Synthetic source pairs (not traffic measurements)</caption><thead><tr><th scope="col">Observation</th><th scope="col">x</th><th scope="col">y</th></tr></thead><tbody>${m.pairs.map(p=>`<tr><th scope="row">${p.id}</th><td>${p.x}</td><td>${p.y}</td></tr>`).join('')}</tbody></table>`,'Synthetic paired observations')}
<details data-scatter-reproduce><summary>Reproduce the pairing counterexample (Python)</summary><pre><code class="language-python">${escape(scatterCode)}</code></pre></details>
</section>`;}
const quizTitle='What does a box-plot show, and how are outliers defined in one?';
const quiz='<p>Specify the quartile and whisker conventions. In the 1.5·IQR version, the box is Q1–Q3 with the median inside; whiskers reach the extreme observations within Q1 − 1.5·IQR and Q3 + 1.5·IQR. Values strictly outside are flagged, not automatically deleted. The rural-road example has no flagged observations. The slide uses median-of-halves quartiles, while the traffic widget recomputes linear-interpolated quartiles. Quantiles can change when observations change; a normal model does not guarantee every value lies within 3 SD. In a scatter-plot, keep each x paired with its own y; sorting the columns separately can create artificial association.</p>';
function stripOldWidget(s){return s.replace(/\/\* ---- Bespoke widget: box-plot, fences and outliers ---- \*\/[\s\S]*?(?=\/\* ---- Bespoke widget: confidence intervals on the z-scale ---- \*\/)/,'');}
function next(html){const re=/<section id="s6"[^>]*>[\s\S]*?<\/section>/;assert(re.test(html));let s=html.replace(re,section());const marker='<summary>'+quizTitle+'</summary>',start=s.indexOf(marker);assert(start>=0);const end=s.indexOf('</details>',start);s=s.slice(0,start)+marker+'\n'+quiz+'\n      '+s.slice(end);s=s.replace(/(<a href="#s6">)[^<]+(<\/a>)/,'$1Box-plots, outliers and paired scatter-plots$2');s=stripOldWidget(s);if(!s.includes('href="assets/boxplot.css"'))s=s.replace('</head>','<link rel="stylesheet" href="assets/boxplot.css">\n</head>');if(!s.includes('src="assets/boxplot.js"'))s=s.replace('<script src="assets/frequency-widget.js"></script>','<script src="assets/frequency-widget.js"></script>\n<script src="assets/boxplot.js"></script>\n<script src="assets/boxplot-widget.js"></script>');return s;}
if(require.main===module){const old=fs.readFileSync(root+'/'+file,'utf8'),updated=next(old);if(process.argv.includes('--check')){assert.equal(updated,old);console.log('OA box/scatter models and section synchronized');}else process.stdout.write('*** Begin Patch\n'+(updated!==old?'*** Update File: '+root+'/'+file+'\n'+require('./transfer-content.cjs').hunks(old,updated):'')+'*** End Patch\n');}
module.exports={file,sources,roadCode,scatterCode,pairingCode,section,quizTitle,next,stripOldWidget};
