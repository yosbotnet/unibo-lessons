const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),specs=require('./robustness-sources.cjs'),model=require('../../cybersecurity/assets/smoothing-model.cjs');
const entries=require('./transfer-sources.cjs'),{createRenderer,palette:p}=require('./render.cjs');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function figure(spec,r){return `<figure data-static-diagram="${spec.id}" data-robustness-diagram="${spec.id}" style="max-width:100%;margin:1.6rem 0">
<div role="region" tabindex="0" aria-label="${esc(spec.title)}: scroll horizontally" style="max-width:100%;overflow-x:auto;background:${p.paper};border:1px solid ${p.rule};padding:12px;box-sizing:border-box">
<img src="../cybersecurity/assets/diagrams/${spec.id}.svg" width="${r.width}" height="${r.height}" alt="${esc(spec.title)}" style="display:block;width:${r.width}px;max-width:none;height:auto;margin:auto"></div>
<figcaption>${esc(spec.caption)}</figcaption></figure>`;}
function training(r){return `<h3>Adversarial training: optimize a declared objective</h3>
<p><a href="https://arxiv.org/pdf/1706.06083v4">Madry et al., §2</a> formulate training as an outer minimization over parameters and an inner maximization over allowed input changes. Finite PGD approximates that inner problem; failing to find an attack does not prove that none exists.</p>
<pre tabindex="0" role="region" aria-label="Robust training objective"><code>minimize over θ: E_(x,y) [ max_(δ in Δ(x)) J(θ, x + δ, y) ]
Δ(x): declared norm budget and valid input domain
y: unchanged under the intended threat model</code></pre>
${figure(specs[0],r)}
<pre tabindex="0" role="region" aria-label="One adversarial training iteration"><code>for batch (x, y):
    # Input search: hold parameters and labels fixed
    x_candidate = constrained_attack(θ, x, y, Δ)
    x_candidate = detach(x_candidate)
    # Choose λ beforehand: 1 = adversarial-only, 0 = clean-only
    L = mean(λ * J(θ, x_candidate, y)
             + (1 - λ) * J(θ, x, y))
    θ = θ - learning_rate * gradient_θ(L)</code></pre>
<p>The optional mixture above is an explicit editorial recipe with 0 ≤ λ ≤ 1. Both losses use the same θ; two successive updates at different θ are not this single weighted-loss step. Clean-data training is not a mandatory second update and does not guarantee preserved clean accuracy.</p>
<p>Report the dataset, model, threat set, optimizer and attack configuration together with clean accuracy and attacked accuracy. “FGSM-trained: yes/no” and “PGD-trained: yes/yes” are not universal outcomes. Neither training-attack strength nor clean-accuracy loss has a universal monotonic relationship.</p>
<p><a href="https://arxiv.org/pdf/1802.00420">Athalye et al., §§5–6</a> distinguish misleading gradients from genuine resistance. Obfuscated gradients can make an attack fail; they are not a defining property of adversarial training. Evaluate the actual defense, including stochasticity or preprocessing, with suitable adaptive attacks. Empirical testing is not a certificate, but a trained model may separately admit certification—including through smoothing.</p>`;}
function smoothing(r){const rows=model.examples.map(e=>({...e,...model.certify(e.selection,e.estimation)}));return `<h3>Randomized smoothing: specify what is certified</h3>
<p>For a fixed classifier f defined on the noisy input space and σ &gt; 0, Gaussian smoothing defines:</p>
<pre tabindex="0" role="region" aria-label="Gaussian smoothing and L2 certificate"><code>η ~ N(0, σ²I)
g(x) = argmax_c Pr[f(x + η) = c]
pLow ≤ Pr[f(x + η) = cA]
pHigh ≥ max_(c ≠ cA) Pr[f(x + η) = c], with pLow ≥ pHigh
R = (σ / 2) * (Φ⁻¹(pLow) - Φ⁻¹(pHigh))
g(x + δ) = cA for ||δ||₂ &lt; R</code></pre>
<p>This is <a href="https://proceedings.mlr.press/v97/cohen19c/cohen19c.pdf">Cohen et al., Theorem 1</a>. Φ is the standard-normal CDF. The claim is local L₂ prediction stability of g, not correctness against ground truth, stability of f, or an L∞ guarantee at the same radius. It does not depend on an attack’s ability to compute gradients.</p>
${figure(specs[1],r)}
<h4>Finite samples: a vote is not a probability bound</h4>
<pre tabindex="0" role="region" aria-label="Finite-sample smoothing certification"><code>Fix f, x, σ, n0, n and failure budget α before sampling
Select cA from n0 independent noisy evaluations
Freeze cA; draw a fresh independent batch of n evaluations
k = number of new evaluations predicting cA
pLower = one_sided_binomial_lower_bound(k, n, α)
if pLower ≤ 0.5: ABSTAIN
else: return cA, R = σ * Φ⁻¹(pLower)</code></pre>
<p>The bound used here is one-sided Clopper–Pearson, as in the <a href="https://github.com/locuslab/smoothing/blob/master/code/core.py">authors’ implementation</a>. For k &gt; 0 it solves Pr[Binomial(n, pLower) ≥ k] = α; for k = 0 it is zero. Taking pHigh = 1 − pLower gives the simpler radius above. Independent estimation prevents selecting a winner from the same counts used to certify it.</p>
<p>With probability at least 1 − α over the certification draws, a returned certificate is valid for the fixed input. This is not a probability that the label is correct, nor a simultaneous guarantee for an unlimited number of inputs. An abstention is inconclusive, not proof that an adversarial example exists. The boundary ||δ||₂ = R is outside the strict guarantee.</p>
<h4>Worked counts: the same selected class, different evidence</h4>
<p>Invented two-class counts, not sampled network outputs: selection is [8,2], so cA = class 0 throughout. Use σ = 0.25, α = 0.001 and n = 100 fresh estimation draws. The same equations generate every cell below.</p>
<div role="region" tabindex="0" aria-label="Smoothing worked counts: scroll horizontally" style="max-width:100%;overflow-x:auto"><table data-smoothing-examples style="min-width:620px"><caption>Illustrative floating-point calculations, rounded to four decimals</caption><thead><tr><th scope="col">Case</th><th scope="col">New counts [0,1]</th><th scope="col">k/n</th><th scope="col">pLower</th><th scope="col">Output</th></tr></thead><tbody>
${rows.map(r=>`<tr><th scope="row">${r.id}</th><td>[${r.estimation.join(', ')}]</td><td>${r.k}/${r.n}</td><td>${r.pLower.toFixed(4)}</td><td>${r.abstain?'ABSTAIN':'class 0; R ≈ '+r.radius.toFixed(4)}</td></tr>`).join('\n')}
</tbody></table></div>
<p>A 60% vote share still abstains at this confidence level. Even unanimity in 100 samples gives a finite bound, not p = 1 or infinite radius. When estimation favors class 1, the procedure still counts class 0; it does not silently reselect. <a href="../cybersecurity/assets/smoothing-model.cjs" download>Download the calculation and records</a>. This educational double-precision code is independently tested, not a formally verified numerical certifier or a rerun of ImageNet experiments.</p>
<h4>Training, inference and cost are separate</h4>
<p>The theorem imposes no training procedure. Gaussian augmentation with the chosen σ can help accuracy under noise; retraining and a matching training σ are not logical prerequisites for validity. Adversarial training and smoothing can be combined. For bounded image inputs, any clipping/normalization must be part of the fixed base classifier f; do not replace the Gaussian by truncated noise and assume the same theorem.</p>
<p>Prediction and certification have different sampling budgets. The paper’s default certification experiment used n0 = 100, n = 100,000 and α = 0.001; “100–1000 forward passes” is not a universal certification cost. Larger σ alone does not guarantee a larger useful radius: the class probabilities change too. Report σ, sample counts, failure budget, abstentions and accuracy together.</p>`;}
const quiz='<p>Adversarial training searches for high-loss allowed inputs and updates model parameters; finite attack evaluation alone is not a certificate. Gaussian smoothing certifies local L₂ stability of g, not f or semantic correctness. Finite-sample certification uses independent selection/estimation, a one-sided probability bound and possible abstention. Training with noise may improve utility but is not required by the theorem. See <a href="#s9">the defense section</a>.</p>';
function next(entry,html,rendered){const combined=entry.file.startsWith('cybersecurity-reworked/');let s=html;
 const re=combined?/<section id="s9">[\s\S]*?<\/section>/:/<section id="s9">[\s\S]*?<\/section>\s*<section id="s10">[\s\S]*?<\/section>/;assert(re.test(s));
 const body=combined?`<section id="s9"><h2>9. Defenses: adversarial training and randomized smoothing</h2>\n${training(rendered[0])}\n${smoothing(rendered[1])}\n</section>`:`<section id="s9"><h2>9. Defenses: Adversarial Training</h2>\n${training(rendered[0])}\n</section>\n\n<section id="s10"><h2>10. Defenses: Randomized Smoothing</h2>\n${smoothing(rendered[1])}\n</section>`;
 s=s.replace(re,body);const q=/(<summary>What is the difference between adversarial training and randomized smoothing as defense mechanisms\?<\/summary>\s*)<p>[\s\S]*?<\/p>/;assert(q.test(s));return s.replace(q,(_,head)=>head+quiz);
}
function asset(spec){return root+'/cybersecurity/assets/diagrams/'+spec.id+'.svg';}
function dimensions(){return specs.map(spec=>{const svg=fs.readFileSync(asset(spec),'utf8');return {width:Number(svg.match(/\bwidth="([\d.]+)"/)[1]),height:Number(svg.match(/\bheight="([\d.]+)"/)[1])};});}
if(require.main===module)(async()=>{const renderer=await createRenderer(),rendered=[];try{for(const spec of specs){const r=await renderer.render(spec);rendered.push(r);if(process.argv.includes('--check'))assert.equal(fs.readFileSync(asset(spec),'utf8'),r.svg+'\n');else fs.writeFileSync(asset(spec),r.svg+'\n');}}finally{await renderer.close();}
 let patch='*** Begin Patch\n';for(const e of entries){const file=root+'/'+e.file,old=fs.readFileSync(file,'utf8'),s=next(e,old,rendered);if(process.argv.includes('--check'))assert.equal(s,old,e.file+' robustness drift');else if(s!==old)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(old,s);}if(process.argv.includes('--check'))console.log('Two shared robustness SVGs, both defense sections, computed examples and quizzes in sync');else process.stdout.write(patch+'*** End Patch\n');})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={training,smoothing,figure,next,dimensions,specs,model};
