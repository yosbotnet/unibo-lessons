'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),m=require('../../oa/assets/frequency.js');
const root=path.resolve(__dirname,'../..'),file='oa/cap-08-statistics.html';
const sources={scipy:'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.relfreq.html',numpy:'https://numpy.org/doc/stable/reference/generated/numpy.histogram.html',nist:'https://www.itl.nist.gov/div898/handbook/eda/section3/histogra.htm',sampling:'https://www150.statcan.gc.ca/n1/edu/power-pouvoir/ch13/prob/5214899-eng.htm'};
const population='<p>A <strong>population</strong> is the set of units or outcomes the analysis concerns; a <strong>sample</strong> is the observed subset. In simple random sampling without replacement, all subsets of the chosen size are equally likely. Probability sampling more generally can use unequal, known inclusion probabilities. Non-probability selection does not provide that design-based foundation. Random selection alone does not ensure that a realized sample is representative or remove coverage, nonresponse and measurement problems. See <a href="'+sources.sampling+'">Statistics Canada’s sampling guide</a>.</p>';
const types=[['Quantitative, continuous','Modeled on a continuous numeric scale; recording precision may round the observations.','Height'],['Quantitative, discrete','A finite or countable set of numeric values; counts are a common example.','Number of people in a room'],['Categorical, nominal','Categories without an intrinsic ordering; numeric codes do not make their differences meaningful.','Nationality'],['Categorical, ordinal','Ordered categories without an assumed equal numeric spacing.','Employment grades']];
const typeQuiz='<p>Continuous quantitative variables are modeled on a numeric continuum (height); discrete quantitative variables have a finite or countable set of possible numeric values (counts of people). Nominal categories have no intrinsic order (nationality); ordinal categories have an order but no assumed equal spacing (employment grades). A numeric category code is not a measurement scale. Discrete counts can still be grouped into numeric histogram intervals.</p>';
const frequencyQuiz='<p>A frequency distribution records counts for values, categories or numeric intervals; relative frequencies divide by the declared total. A histogram groups quantitative observations, including discrete counts, into ordered numeric bins. A categorical bar chart compares categories. For a histogram, specify the bin edges and endpoint convention: the bin count alone is insufficient. For unequal widths, use count/width or relative frequency/width if bar area is to represent frequency or probability. Changing bins does not change the underlying observations.</p>';
const caption='<figcaption><b>Plate 8.1</b> — Variable types guide meaningful summaries. Nominal categories have no intrinsic order; ordinal categories can be ranked without assuming equal spacing. Quantitative variables may be continuous or discrete. Histograms can group either kind into numeric intervals: the vehicle counts in section 2 are discrete. The taxonomy alone does not determine a statistical test; the question, sampling design and assumptions also matter.</figcaption>';
function section1(old){const svg=old.match(/<svg\b[\s\S]*?<\/svg>/);assert(svg);return `<section id="s1" data-src="6 - Statistics_ descriptive.pdf">
<h2>1. Population, sample and variables</h2>
<p>Descriptive statistics summarize observed data; inferential statistics use a sampling design or model to make statements beyond those observations. The distinction matters even before choosing a plot.</p>
${population}
<p>A variable records a characteristic of an observational unit. Its type concerns the meaning of the values, not simply how they are stored:</p>
<div class="figure-table" tabindex="0" role="region" aria-label="Variable types: scroll horizontally"><table><caption>Variables and their measurement meaning</caption><thead><tr><th scope="col">Kind</th><th scope="col">Property</th><th scope="col">Example</th></tr></thead><tbody>${types.map(r=>`<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
<figure class="lk-fig"><div class="figure-diagram" tabindex="0" role="region" aria-label="Scrollable variable taxonomy">${svg[0]}</div>${caption}</figure>
<p>A <strong>statistic</strong> is calculated from a sample; a <strong>parameter</strong> describes the population or model of interest. For a particular sample, sampling error is the difference between an estimator and the corresponding population quantity. It is not a synonym for all measurement errors, selection bias or forecast errors.</p>
<div class="callout idea"><span class="callout-label">Connect the data to the question</span><p>The traffic example below describes 31 consecutive days. Those days are not automatically an independent random sample of all future days. Generalizing forecast performance requires attention to time dependence, the validation design and possible changes in the generating process. A significance test alone does not establish representativeness.</p></div>
</section>`;}
function widget(){const r=m.example();return `<div class="oa-w" id="w-hist">
<h4>The histogram, rebuilt from one data source</h4>
<p class="oa-sub">The same 31 daily counts drive the bars, table and summary. Change the number of bins or range convention; the observations and their mean stay fixed.</p>
<div class="frequency-controls"><label for="hs-mode">Range convention</label><select id="hs-mode" disabled><option value="scipy">SciPy-style expanded range</option><option value="numpy">NumPy-style min–max range</option></select></div>
<div class="oa-row"><label for="hs-bins">Number of bins</label><input type="range" id="hs-bins" min="5" max="16" step="1" value="10" disabled><output class="oa-val" id="hs-bins-v" for="hs-bins">10</output></div>
<p id="hs-out" role="status" aria-live="polite">${m.summary(r)}</p>
<figure class="lk-fig"><div class="figure-diagram" data-frequency-plot tabindex="0" role="region" aria-label="Traffic histogram: scroll horizontally">${m.svg(r)}</div><figcaption>Histogram of observed August counts, not a fitted probability model. Bar height is the number of days in each interval; the vermilion line marks the mean. Bins have equal widths within each setting. Counts are also available in the table below.</figcaption></figure>
<div class="figure-table frequency-table" data-frequency-rows tabindex="0" role="region" aria-label="Histogram counts and proportions: scroll horizontally">${m.table(r)}</div>
<p>Intervals include the left endpoint and exclude the right, except the final interval, which includes both. Displayed edges are rounded to two decimals; assignment uses full-precision edges. Proportions are rounded only for display and may not sum to exactly 1 after rounding.</p>
<noscript><p>JavaScript is disabled: the complete ten-bin expanded-range chart and table remain available; interactive controls are disabled.</p></noscript>
</div>`;}
function section2(){return `<section id="s2" data-src="6 - Statistics_ descriptive.pdf">
<h2>2. Frequency distributions and the traffic counts</h2>
${frequencyQuiz}
<p>The deck’s <code>ago1</code> column contains 31 observations, one daily vehicle count for August. These are discrete quantitative data, even though a histogram groups them into intervals:</p>
<pre><code>${m.data.join(' ')}</code></pre>
<p>A reproducible histogram requires both a bin count and edges. <a href="${sources.numpy}">NumPy’s histogram documentation</a> uses the observed minimum and maximum by default. <a href="${sources.scipy}">SciPy’s relfreq documentation</a> instead expands each end by (max − min) / [2(k − 1)] for k bins. These defaults need not produce the same counts.</p>
<div class="callout note"><span class="callout-label">Recomputed from the observations</span><p>With ten expanded-range bins, the counts are <strong>4, 1, 0, 2, 1, 2, 8, 5, 6, 2</strong>. With ten min–max bins they are <strong>4, 1, 0, 2, 1, 2, 7, 6, 1, 7</strong>. Both total 31. Comparing the slide’s columns with these calculations shows that its counts match the min–max bins, while its proportions match expanded-range bins; its displayed interval labels are approximate. The old chapter’s purported correction instead summed to 32. The table below uses one explicit convention for every column.</p></div>
${widget()}
<h3>Use the same edges in Python</h3>
<pre><code class="language-python">import numpy as np
from scipy import stats
import matplotlib.pyplot as plt

data = np.array([${m.data.join(', ')}])
k = 10
pad = (data.max() - data.min()) / (2 * (k - 1))
edges = np.linspace(data.min() - pad, data.max() + pad, k + 1)
counts, _ = np.histogram(data, bins=edges)
relative = counts / data.size
cumulative = np.cumsum(counts) / data.size
print(counts)  # [4 1 0 2 1 2 8 5 6 2]
print(counts.sum())  # 31
res = stats.relfreq(data, numbins=k,
                    defaultreallimits=(edges[0], edges[-1]))
assert np.allclose(relative, res.frequency)
plt.hist(data, bins=edges, color='#1546B8', edgecolor='#F3EFE3')
plt.xlabel('Vehicles per day'); plt.ylabel('Days')
plt.show()
# For the min–max convention, use edges = np.linspace(data.min(), data.max(), k + 1).
# Recompute counts, proportions and the plot together after changing the edges.</code></pre>
<p>Relative frequency is count / n; frequency density additionally divides by bin width. With unequal bin widths, plotting raw counts as heights makes the bar areas misleading. See the <a href="${sources.nist}">NIST histogram guide</a> for normalization choices. Neither a histogram nor its binning establishes independence or a distributional model.</p>
</section>`;}
function wrapLegacyTables(section,id){
 if(section.includes('data-oa-native-table'))return section;
 return section.replace(/<table>[\s\S]*?<\/table>/g,table=>`<div class="figure-table" data-oa-native-table="${id}" tabindex="0" role="region" aria-label="Reference table in section ${id.slice(1)}: scroll horizontally">${table}</div>`);
}
function next(html){let s=html;
 s=s.replace('<span>6 interactive widgets</span>','<span>5 interactive widgets</span>');
 const one=/<section id="s1"[^>]*>[\s\S]*?<\/section>/,two=/<section id="s2"[^>]*>[\s\S]*?<\/section>/;assert(one.test(s)&&two.test(s));
 s=s.replace(one,section1(s.match(one)[0])).replace(two,section2());
 for(const id of ['s10','s11','s12']){const re=new RegExp('<section id="'+id+'"[^>]*>[\\s\\S]*?</section>');assert(re.test(s));s=s.replace(re,section=>wrapLegacyTables(section,id));}
 const quiz=[['Define population, sample, and the two ways a sample can be chosen.',population],['Classify variables, and give the defining property of each class.',typeQuiz],['What is a frequency distribution, and how does a relative frequency distribution differ from it?',frequencyQuiz]];
 for(const [title,body] of quiz){const marker='<summary>'+title+'</summary>',start=s.indexOf(marker);assert(start>=0);const end=s.indexOf('</details>',start);s=s.slice(0,start)+marker+'\n'+body+'\n      '+s.slice(end);}
 s=s.replace(/(<a href="#s2">)[^<]+(<\/a>)/,'$1Frequency distributions and the traffic counts$2');
 const old=/\/\* ---- Bespoke widget: histogram of the ago1 traffic counts ---- \*\/[\s\S]*?(?=\/\* ---- Bespoke widget: mean vs median under skewness ---- \*\/)/;
 s=s.replace(old,'');
 const css='<link rel="stylesheet" href="assets/frequency.css">';if(!s.includes(css))s=s.replace('</head>',css+'\n</head>');
 const scripts='<script src="assets/frequency.js"></script>\n<script src="assets/frequency-widget.js"></script>';
 if(!s.includes('src="assets/frequency-widget.js"'))s=s.replace('<script>\nhljs.highlightAll();',scripts+'\n<script>\nif (globalThis.hljs) hljs.highlightAll();');
 assert(s.includes(scripts));return s;
}
if(require.main===module){const old=fs.readFileSync(root+'/'+file,'utf8'),updated=next(old);
 if(process.argv.includes('--check')){assert.equal(updated,old);console.log('OA frequency chapter synchronized');}
 else process.stdout.write('*** Begin Patch\n'+(updated!==old?'*** Update File: '+root+'/'+file+'\n'+require('./transfer-content.cjs').hunks(old,updated):'')+'*** End Patch\n');
}
module.exports={file,sources,types,next,widget,section2,wrapLegacyTables};
