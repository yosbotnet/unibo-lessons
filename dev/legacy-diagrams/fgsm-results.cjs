const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),evidence=require('../../cybersecurity/assets/fgsm-evidence.cjs'),entries=require('./transfer-sources.cjs');
const intro=`<h2>4. FGSM: one input-gradient step</h2>
<p>The Fast Gradient Sign Method (FGSM) constructs a candidate using one gradient evaluation. Its linearization argument motivates a fast white-box attack; it does not require a globally linear network or guarantee success.</p>
<div class="callout exam"><span class="callout-label">Untargeted FGSM</span>
<p>For a clean input x, fixed reference label y, model parameters θ and loss J, take δ = ε · sign(∇x J(θ, x, y)). Epsilon bounds each coordinate in the declared input representation. The sign function returns −1, 0 or +1; a zero gradient component produces no step.</p></div>
<ol>
<li>Choose the input representation, its valid bounds, ε and the reference label y.</li>
<li>Compute the gradient of J with respect to x, keeping θ and y fixed.</li>
<li>Form δ from the component-wise signs.</li>
<li>Clip x + δ to the valid input bounds, if the domain is a coordinate box containing x.</li>
<li>Evaluate the candidate against the declared attack objective. Increasing loss is not itself success.</li>
</ol>
<p>For a labeled benchmark, use the ground-truth label and state whether clean errors are excluded from the denominator. The explorer below instead fixes y to its clean prediction, which is explicitly a different, illustrative protocol. Clipping bounds must match the coordinates: [0,1] is appropriate for normalized pixels, not automatically for standardized inputs.</p>
`;
function results(){const e=evidence,i=e.illustration;return `<!-- BEGIN FGSM RESULTS -->
<h3>Published FGSM results: keep the model and units</h3>
<p>Transcribed from <a href="${e.url}">Goodfellow et al., ICLR 2015, §4, p. 3 and footnotes 1–2</a>; these experiments were not rerun here.</p>
<div tabindex="0" role="region" aria-label="Published FGSM results: scroll horizontally" style="max-width:100%;overflow-x:auto"><table data-fgsm-literature style="min-width:680px"><caption>Reported perturbed-test error, not clean-correct-conditioned attack success</caption><thead><tr><th scope="col">Dataset / model</th><th scope="col">Error</th><th scope="col">Mean class score</th><th scope="col">ε</th><th scope="col">Input representation</th></tr></thead><tbody>
${e.rows.map(r=>`<tr><th scope="row">${r.dataset} / ${r.model}</th><td>${r.errorPercent}%</td><td>${r.meanScorePercent}%</td><td>${r.epsilon}</td><td>${r.units}</td></tr>`).join('\n')}
</tbody></table></div>
<p>The scores are the paper’s reported averages, not measured calibration or success rates. Epsilon values in different representations are not directly comparable.</p>
<p>Figure 1 is one ${i.model}/${i.dataset} illustration: ${i.cleanClass} (${i.cleanScorePercent}% class score) → ${i.candidateClass} (${i.candidateScorePercent}%), ε = ${i.epsilon} in ${i.unitContext}. It supplies no aggregate ImageNet attack-success rate.</p>
<p><a href="../cybersecurity/assets/fgsm-evidence.cjs" download>Download the transcribed records and source version</a>. The coordinate plot below is a separate editorial example.</p>
<!-- END FGSM RESULTS -->`;}
function next(html){let s=html;
 const start=/<h2>4\. FGSM:[\s\S]*?(?=<h3>The FGSM [Aa]lgorithm<\/h3>)/;assert(start.test(s),'FGSM introduction not found');s=s.replace(start,intro);
 const re=s.includes('<!-- BEGIN FGSM RESULTS -->')?/<!-- BEGIN FGSM RESULTS -->[\s\S]*?<!-- END FGSM RESULTS -->/:/<h3>Results(?: \(load-bearing numbers, verbatim\))?<\/h3>[\s\S]*?<\/table><\/div>/;
 assert(re.test(s),'FGSM results not found');s=s.replace(re,results());
 s=s.replace('x_candidate = clip(x + δ, 0, 1)','x_candidate = clip(x + δ, lower, upper)');
 s=s.replace("['x_adv = x + ε · sign(∇_x J(θ, x, y))', 'Full FGSM formula in one line']","['x_candidate = clip(x + ε · sign(∇_x J), lower, upper)', 'Bounds must match the input representation']");
 s=s.replace("'Controls max perturbation per pixel'","'Maximum coordinate change in the stated units'");
 s=s.replace("['x_adv: adversarial example', 'Candidate: evaluate whether it fools the classifier']","['x_candidate: proposed input', 'Evaluate success; do not infer it from the formula']");
 return s;
}
if(require.main===module){let patch='*** Begin Patch\n';for(const e of entries){const file=root+'/'+e.file,html=fs.readFileSync(file,'utf8'),s=next(html);if(process.argv.includes('--check'))assert.equal(s,html,e.file+' FGSM evidence drift');else if(s!==html)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(html,s);}if(process.argv.includes('--check'))console.log('Both FGSM result tables, input-domain explanations and annotations in sync');else process.stdout.write(patch+'*** End Patch\n');}
module.exports={next,results,intro,evidence};
