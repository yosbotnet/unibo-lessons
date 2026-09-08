'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),m=require('../../oa/assets/coin-test.js');
const root=path.resolve(__dirname,'../..'),file='oa/cap-08-statistics.html',asset=root+'/oa/assets/diagrams/oa-testing-workflow.svg';
const sources={scipy:'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html',nist:'https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm',asa:'https://www.amstat.org/asa/files/pdfs/P-ValueStatement.pdf'};
const diagram={id:'oa-testing-workflow',title:'A prespecified hypothesis test produces a decision, not a proof',source:`flowchart TD
A["Specify model and test"] --> B["Collect planned sample"]
B --> C["Compute statistic and p"]
C --> D{"p ≤ α?"}
D -->|Yes| E["Reject H₀"]
D -->|No| F["Do not reject H₀"]
classDef reject stroke:#B83D2D,stroke-width:1.5px
class E reject
linkStyle 3 stroke:#B83D2D`,overrides:{nodeSpacing:30,rankSpacing:38,wrappingWidth:200},requiredText:['Specify model and test','Collect planned sample','Compute statistic and p','p ≤ α?','Reject H₀','Do not reject H₀']};
function dimensions(){const svg=fs.readFileSync(asset,'utf8');return {width:Number(svg.match(/\bwidth="([\d.]+)"/)[1]),height:Number(svg.match(/\bheight="([\d.]+)"/)[1])};}
function widget(){const r=m.evaluate(8);return `<div class="oa-w" id="w-coin">
<h4>Ten flips: outcome probability is not the p-value</h4>
<p class="oa-sub">Under H₀, ten independent flips have a constant head probability θ = 0.5. The controls compare prespecified alternatives; choosing a favorable tail after seeing the data is not a valid testing procedure.</p>
<div class="coin-controls"><label for="cn-alternative">Alternative hypothesis</label><select id="cn-alternative" disabled>${m.alternatives.map(a=>`<option value="${a}">${m.escape(m.labels[a])}</option>`).join('')}</select></div>
<div class="oa-row"><label for="cn-k">Heads observed in 10 flips</label><input type="range" id="cn-k" min="0" max="10" step="1" value="8" disabled><output class="oa-val" id="cn-k-v" for="cn-k">8</output></div>
<p id="cn-out" role="status" aria-live="polite">${m.summary(r)}</p>
<figure class="lk-fig"><div class="figure-diagram" data-coin-plot tabindex="0" role="region" aria-label="Exact binomial plot: scroll horizontally">${m.svg(r)}</div><figcaption><b>Plate 8.7</b> — Exact binomial null distribution for ten independent fair-coin flips. Vermilion bars are the outcomes included in the selected p-value; their probabilities are summed. The observed count has an ink outline. The red set is not the fixed rejection region: compare its total probability, not individual bar heights, with α = 0.05. All bars have the same width.</figcaption></figure>
<div class="figure-table" data-coin-rows tabindex="0" role="region" aria-label="Exact coin probabilities and decisions: scroll horizontally">${m.table(r.alternative)}</div>
<p>Values are rounded for display only. The p-values in a column do not form a probability distribution and should not be added together. All decisions use the exact integer numerator over 1024.</p>
<noscript><p>JavaScript is disabled: the full two-sided example for eight heads and its decision table remain visible; interactive controls are disabled.</p></noscript>
</div>`;}
function section10(d=dimensions()){return `<section id="s10" data-src="7 - Statistics_ inferential.pdf">
<h2>10. Hypothesis testing: H₀ and the p-value</h2>
<p>A null hypothesis H₀ specifies a population/model claim, such as a head probability of 0.5. It is not universally the statement “everything is due to chance.” A test also needs assumptions, a statistic, an alternative, a rule for what counts as at least as extreme, and a significance level chosen before examining the outcome.</p>
<figure class="lk-fig"><div class="figure-diagram" tabindex="0" role="region" aria-label="Hypothesis-testing workflow: scroll horizontally"><img src="assets/diagrams/oa-testing-workflow.svg" width="${d.width}" height="${d.height}" style="width:${d.width}px;max-width:none" alt="Specify a model and test, collect the planned sample, compute the statistic and p-value, then reject if p is at most alpha; otherwise do not reject." data-static-diagram="oa-testing-workflow"></div><figcaption><b>Plate 8.6</b> — A prespecified decision procedure. Both branches still require interpretation in context. Neither proves a hypothesis true. Sampling, measurement and model assumptions must be assessed; the p-value calculation does not automatically repair systematic bias.</figcaption></figure>
<p>A <strong>p-value</strong> is a probability under the specified null model of outcomes at least as extreme as the observation, using the chosen test’s ordering. It is not the probability that H₀ is true, nor the probability that the result arose “by chance alone.” The <a href="${sources.nist}">NIST testing guide</a> explains the tail-probability interpretation; the <a href="${sources.asa}">ASA’s statement summary</a> emphasizes model assumptions, context and complete reporting.</p>
<h3>Exact fair-coin calculation</h3>
<p>Let K be the number of heads in ten independent flips with common head probability θ. Under H₀: θ = 0.5, P(K = j) = C(10, j) / 2¹⁰ = C(10, j) / 1024. For eight heads:</p>
<ul><li><strong>One outcome:</strong> P(K = 8) = 45/1024 = 0.0439453125. This is not the test’s p-value.</li>
<li><strong>Prespecified upper-tail alternative θ &gt; 0.5:</strong> P(K ≥ 8) = (45 + 10 + 1)/1024 = 0.0546875.</li>
<li><strong>Two-sided alternative θ ≠ 0.5:</strong> sum outcomes no more probable under H₀ than the observed one. For this symmetric distribution, these are K ≤ 2 or K ≥ 8, giving 112/1024 = 0.109375.</li></ul>
<p>Neither of these p-values rejects at α = 0.05. Comparing just P(K = 8) with α does not implement either test. For a general asymmetric null, do not assume that every two-sided definition is twice the smaller tail. <a href="${sources.scipy}">SciPy’s binomtest</a> exposes the alternative explicitly.</p>
${widget()}
<h3>A decision is not a proof or an effect size</h3>
<p>This chapter uses the rule <strong>reject if p ≤ α</strong>, otherwise <strong>do not reject</strong>. Boundary conventions must be consistent; none of the ten-flip p-values equals 0.05. A rejection can be a Type I error. Non-rejection does not prove fairness, equality or equivalence; a small sample may have low power. Statistical significance also does not establish practical importance or a causal explanation.</p>
<details data-coin-check><summary>Why is comparing each bar with 5% invalid here?</summary><p>That rule rejects at K = 0, 1, 2, 8, 9 or 10. Under a genuinely fair coin those outcomes have combined probability 112/1024 = 10.9375%, exceeding the claimed 5% level. The valid two-sided rule rejects only at K = 0, 1, 9 or 10, totaling 22/1024 = 2.1484375%. Discreteness makes this nonrandomized test conservative.</p></details>
<p>Confidence sets can be built by inverting a specified family of tests. Then inclusion/exclusion of a null value matches non-rejection/rejection under that same construction, level and boundary convention. An arbitrary interval and a differently defined test need not agree, especially for discrete distributions. A single estimate lying in a central band of raw data is not this test–interval duality.</p>
<pre><code class="language-python">from scipy.stats import binomtest
for alternative in ['two-sided', 'greater', 'less']:
    result = binomtest(8, n=10, p=0.5, alternative=alternative)
    print(alternative, result.pvalue)
# two-sided 0.109375
# greater   0.0546875
# less      0.9892578125</code></pre>
<p>When comparing forecasting methods, specify the loss, paired observations, time dependence and relevant effect size before selecting a test. A single significance threshold does not establish that two models are equivalent or identify a universally best model.</p>
</section>`;}
function section11(){const r=m.rates();return `<section id="s11" data-src="7 - Statistics_ inferential.pdf">
<h2>11. Degrees of freedom, tails, and Type I and II errors</h2>
<p>Degrees of freedom depend on the statistic and model, not a universal “sample size minus one” rule. For example, estimating one sample mean leaves n − 1 freely varying residuals; the usual one-sample t statistic has that reference distribution under independent normal observations. The exact binomial test above instead uses n and the null head probability, without a t-style degrees-of-freedom parameter.</p>
<p>Choose a one-sided alternative when a direction is part of the question in advance; use a two-sided alternative for departures in either direction. Selecting the smaller one-sided p-value after observing the result changes the procedure and its error rate.</p>
<div class="figure-table" data-oa-native-table="s11" tabindex="0" role="region" aria-label="Testing errors and power: scroll horizontally"><table><caption>Probabilities refer to repeated samples under the stated model</caption><thead><tr><th scope="col">Reality</th><th scope="col">Decision</th><th scope="col">Interpretation</th></tr></thead><tbody>
<tr><th scope="row">H₀ is true</th><td>Reject H₀</td><td>Type I error. A valid level-α procedure controls this probability at most α under its assumptions; equality is not automatic.</td></tr>
<tr><th scope="row">H₀ is true</th><td>Do not reject H₀</td><td>Probability 1 minus the actual Type I error rate.</td></tr>
<tr><th scope="row">A specified alternative <span class="coin-math">θ₁</span> is true</th><td>Do not reject H₀</td><td>Type II error, β(θ₁).</td></tr>
<tr><th scope="row">A specified alternative <span class="coin-math">θ₁</span> is true</th><td>Reject H₀</td><td>Power, 1 − β(θ₁).</td></tr>
</tbody></table></div>
<p>Power depends on the alternative, sample size, variability and decision rule. It is not determined by α alone, and a composite alternative generally has a power function, not one universal β. Which error is more costly depends on the application; Type I is not inherently the more serious error.</p>
<details data-coin-power><summary>What are the size and power of the ten-flip two-sided test?</summary><p>The rejection set is {${r.rejected.join(', ')}}. Under θ = 0.5 its exact size is ${r.sizeNumerator}/${r.sizeDenominator} = ${(100*r.sizeNumerator/r.sizeDenominator).toFixed(6)}%, below 5%. Under the specific alternative θ₁ = 0.75, summing C(10, j) · 0.75ʲ · 0.25¹⁰⁻ʲ over the same rejection set gives power ${r.powerNumerator}/${r.powerDenominator} = ${(100*r.powerNumerator/r.powerDenominator).toFixed(6)}%. Therefore β(0.75) = ${(100*(1-r.powerNumerator/r.powerDenominator)).toFixed(6)}%: even this biased coin often fails to trigger rejection in ten flips.</p></details>
<p>These are exact calculations for independent Bernoulli trials, not a diagnosis of a physical coin or a general forecast-comparison result. Rejection does not logically prove the alternative; non-rejection does not prove equality. Report uncertainty and the experimental design along with the decision.</p>
</section>`;}
const quizzes={
 'Define the null hypothesis and the decision rule of a test, and re-derive it on the coin example.':'<p>H₀ states a model/parameter claim. Specify the alternative, statistic, assumptions and α before seeing the result. Reject when the chosen p-value is at most α. For eight heads in ten independent fair-coin trials, P(K = 8) = 45/1024, but the upper-tail p-value is 56/1024 and the two-sided p-value is 112/1024. Neither rejects at 5%. Non-rejection is not proof of fairness.</p>',
 'Define the p-value and the significance/interval equivalence.':'<p>The p-value sums null-model probability for outcomes at least as extreme as observed under the chosen test. It is not P(H₀ is true) or an effect size. Inverting the same tests constructs a confidence set whose null values correspond to non-rejection, with matching level and boundary convention. Do not assume an unrelated interval or a central raw-data band has this property.</p>',
 'Define degrees of freedom, one- and two-tailed tests, and the two types of error with their probabilities.':'<p>Degrees of freedom depend on the model/statistic; n − 1 is one common case, not a universal rule. Choose the alternative before observing data. Type I means rejecting a true null; a valid level-α test controls its rate at most α. Type II means not rejecting under a specified alternative, with probability β; power is 1 − β. Neither decision proves a hypothesis, and neither error type is universally more serious. The ten-flip example has size 22/1024, not exactly 5%.</p>'
};
function next(html,d=dimensions()){
 let s=html;for(const id of ['s10','s11']){const re=new RegExp('<section id="'+id+'"[^>]*>[\\s\\S]*?</section>');assert(re.test(s));s=s.replace(re,id==='s10'?section10(d):section11());}
 for(const [title,body] of Object.entries(quizzes)){const marker='<summary>'+title+'</summary>',start=s.indexOf(marker);assert(start>=0);const end=s.indexOf('</details>',start);s=s.slice(0,start)+marker+'\n'+body+'\n      '+s.slice(end);}
 const ci=/<p>95%: x&#772;[\s\S]*?<\/p>/;s=s.replace(ci,'<p>For an independent normal sample with known population standard deviation σ, the usual mean intervals are x̄ ± 1.96σ/√n (approximately 95%) and x̄ ± 2.576σ/√n (approximately 99%). With unknown σ estimated from a normal sample, use the corresponding t critical value and s/√n. Coverage concerns repeated samples, not a probability assigned to the fixed parameter after observing an interval. Test–interval equivalence requires matched constructions; see section 10.</p>');
 s=s.replace(/(<a href="#s10">)[\s\S]*?(<\/a>)/,'$1Hypothesis testing: H₀ and the p-value$2');
 const old=/\/\* ---- Bespoke widget: is the coin rigged\? ---- \*\/[\s\S]*?(?=<\/script>)/;s=s.replace(old,'');
 if(!s.includes('href="assets/coin.css"'))s=s.replace('</head>','<link rel="stylesheet" href="assets/coin.css">\n</head>');
 if(!s.includes('src="assets/coin-widget.js"'))s=s.replace('<script>\nif (globalThis.hljs)','<script src="assets/coin-test.js"></script>\n<script src="assets/coin-widget.js"></script>\n<script>\nif (globalThis.hljs)');
 assert(s.includes('src="assets/coin-widget.js"'));return s;
}
if(require.main===module)(async()=>{const renderer=await require('./render.cjs').createRenderer();let r;try{r=await renderer.render(diagram);}finally{await renderer.close();}
 const old=fs.readFileSync(root+'/'+file,'utf8'),updated=next(old,r);if(process.argv.includes('--check')){assert.equal(fs.readFileSync(asset,'utf8'),r.svg+'\n');assert.equal(updated,old);console.log('OA testing workflow and exact coin example synchronized');}
 else{fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,r.svg+'\n');process.stdout.write('*** Begin Patch\n'+(updated!==old?'*** Update File: '+root+'/'+file+'\n'+require('./transfer-content.cjs').hunks(old,updated):'')+'*** End Patch\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={file,asset,sources,diagram,dimensions,next,section10,section11,quizzes};
