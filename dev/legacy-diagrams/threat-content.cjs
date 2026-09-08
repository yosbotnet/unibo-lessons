'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const sources={nist:'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-2e2025.pdf',papernot:'https://arxiv.org/pdf/1602.02697v4',boundary:'https://arxiv.org/pdf/1712.04248v2'};
const knowledge=[
 ['White-box evasion','Architecture and parameters are known; the specified model can be inspected.','Input-gradient methods additionally need a computable loss and suitable derivatives. They do not inherently need the original training set.'],
 ['Black-box access','Target internals are unavailable; state whether queries return labels, scores, or nothing during candidate generation.','An API is an interface, not a complete threat specification. Query budgets and returned information matter.'],
 ['Grey-box knowledge','Partial information, such as architecture without weights or knowledge of preprocessing.','Specify the actual information. There is no universal “data OR architecture, but never both” rule.']
];
const methods=[
 ['Transfer-based','Generate on a surrogate; evaluate the unchanged candidate on the target.','The surrogate may be trained with auxiliary data, target queries, or both. Transfer is measured, not guaranteed.'],
 ['Score-based queries','Use returned scores or logits to guide candidate search.','Optimization can use the outputs directly; training a substitute is not required.'],
 ['Decision-based queries','Use returned decisions, such as the predicted class, to guide candidate search.','Boundary Attack is a label-only example that does not train a substitute.']
];
function table(id,caption,headers,rows){return `<div data-threat-table="${id}" tabindex="0" role="region" aria-label="${caption}: scroll horizontally" style="max-width:100%;overflow-x:auto"><table style="min-width:700px;table-layout:fixed;width:100%"><caption>${caption}</caption><colgroup><col style="width:23%"><col style="width:35%"><col style="width:42%"></colgroup><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('\n')}</tbody></table></div>`;}
function section(){return `<section id="s3">
<h2>3. Threat models: knowledge, objectives and constraints</h2>
<p>A useful threat model states the asset and learning stage, what an adversary knows, what they can change or observe, and how success is measured. The classification examples below concern inference-time evasion against a fixed model; poisoning the training process is a different capability.</p>
<h3>Knowledge is not an identity or permission</h3>
${table('knowledge','Knowledge and access in an evasion experiment',['Setting','Declared access','Qualification'],knowledge)}
<p>Terminology depends on scope: <a href="${sources.nist}">NIST AI 100-2e2025, §§2.1.4 and 2.2.1</a>, describes broad full-system knowledge including training data, while its white-box evasion discussion specifies architecture and parameters. State which convention applies. “Insider” describes a trust relationship, not a knowledge level: public weights can expose a model to an outsider, and an insider need not know every parameter. Knowledge does not grant permission to test a service.</p>
<h3>How candidates are generated</h3>
${table('methods','Candidate-generation strategies and feedback',['Strategy','Information used','What it does not imply'],methods)}
<p>These are not three mutually exclusive attacker identities. A workflow can query the target to label data, fit a surrogate, then attempt transfer: <a href="${sources.papernot}">Papernot et al., §4</a>, uses target labels in this way. Conversely, <a href="${sources.boundary}">Brendel et al., §§2–3</a>, describes decision-based search without a substitute. See also <a href="${sources.nist}">NIST, §§2.2.2–2.2.3</a>. “Direct API query” alone does not distinguish score-based from label-only feedback.</p>
<h3>Objective is not a severity rating</h3>
<p>For this example, fix a classifier f, a clean input x with f(x) = y, and a valid, label-preserving candidate x′. Choose the target t ≠ y before evaluating the candidate.</p>
<ul data-threat-objectives>
<li><strong>Untargeted success:</strong> f(x′) ≠ y — any incorrect class meets the objective.</li>
<li><strong>Targeted success:</strong> f(x′) = t — only the selected incorrect class meets the objective.</li>
</ul>
<p>Under the same assumptions and candidate constraints, every targeted success is also an untargeted success; the converse need not hold. A stricter success condition does not prove that every algorithm takes longer, or that every targeted error causes more damage. In binary classification there is only one incorrect class, so the two conditions coincide.</p>
<details data-threat-check><summary>If y = stop sign and t = speed-limit sign, how do three possible predictions score?</summary>
<ul><li><strong>Speed-limit sign:</strong> targeted and untargeted success.</li><li><strong>Yield sign:</strong> untargeted success only.</li><li><strong>Stop sign:</strong> neither objective succeeds.</li></ul>
<p>This is a synthetic label example, not a road experiment. It assumes the altered input still represents a stop sign. A wrong label alone establishes neither an accident nor service denial. The complete application determines integrity, availability, confidentiality and safety consequences. See <a href="#s6">the existing transfer diagram and worked denominator example</a> and <a href="#s8">system-level evidence</a>.</p></details>
<h3>Make the experiment reproducible</h3>
<ol data-threat-constraints>
<li><strong>Allowed changes:</strong> state input representation, valid bounds, perturbation norm and budget where applicable; explain why the reference label is preserved.</li>
<li><strong>Available resources:</strong> state model/preprocessing knowledge, auxiliary data, query feedback, query limit, restarts and computation budget.</li>
<li><strong>Success measure:</strong> declare the objective and eligible examples, including treatment of clean errors; report the denominator. For stochastic models, specify repeated evaluation and the success-probability criterion.</li>
</ol>
<p>Additional capabilities can enable more methods; they do not guarantee that a finite attack run succeeds. Failure to find a candidate is not a robustness proof. The <a href="#s4">FGSM example</a> and <a href="#s5">PGD discussion</a> keep optimization steps separate from measured success.</p>
</section>`;}
function overview(reworked){return reworked?`<div class="lk-overview">
<h2>The thread of this lesson</h2>
<p>Module 1 connects assets, vulnerabilities, threats, attacks, consequences and countermeasures. Here the asset is a machine-learning application, including its model, data and surrounding tools. The lesson follows two teaching threads, not an exhaustive taxonomy of AI attacks:</p>
<ul><li><strong>Decisions at inference time:</strong> adversarial examples, their threat models, evaluated transfer and the scope of robustness defenses.</li>
<li><strong>Data and instructions:</strong> training-data privacy, live context, prompt injection and agent tool boundaries.</li></ul>
<p>A model error is not automatically a confidentiality breach or an availability failure. Identify the application’s trust boundary and observed consequence; assess physical safety separately. Training-time poisoning is another attack surface. Distinguish exact teaching examples, source-reported experiments and unverified deployment claims throughout.</p>
</div>`:`<div class="lk-overview">
<h2>In this lesson</h2>
<ul>
<li>Adversarial examples and the difference between model errors and system harm</li>
<li>Threat models: knowledge, objectives, capabilities and constraints</li>
<li>FGSM and PGD: mechanics, assumptions and evaluated results</li>
<li>Transferability: candidate generation, target evaluation and denominators</li>
<li>Five perspectives on adversarial examples and their limits</li>
<li>Real-world domains: evidence and application-specific consequences</li>
<li>Adversarial training and randomized smoothing: what each defense establishes</li>
<li>LLM privacy: memorization, membership inference and data extraction</li>
<li>Alignment and prompt injection: channels, objectives and confidentiality</li>
<li>Agentic AI: tool proposals, trust boundaries and external enforcement</li>
<li>Healthcare models: evaluation units, leakage metrics and study limitations</li>
<li>GDPR/HIPAA scope, responsibilities and evidence</li>
</ul>
</div>`;}
function next(entry,html){
 assert(/<section id="s3">[\s\S]*?<\/section>/.test(html));
 let s=html.replace(/<section id="s3">[\s\S]*?<\/section>/,section());
 assert(/<div class="lk-overview">[\s\S]*?<\/div>/.test(s));
 s=s.replace(/<div class="lk-overview">[\s\S]*?<\/div>/,overview(entry.file.startsWith('cybersecurity-reworked/')));
 // Only these previously stale early-section labels are owned here.
 for(const id of ['s3','s4','s5','s6','s7']){
  const h=s.match(new RegExp('<section id="'+id+'">\\s*<h2>\\d+\\. ([^<]+)</h2>'));assert(h);
  const link=new RegExp('(<a href="#'+id+'">)[^<]+(</a>)');assert(link.test(s));s=s.replace(link,(_,a,b)=>a+h[1]+b);
 }
 return s;
}
if(require.main===module){let patch='*** Begin Patch\n';for(const entry of require('./transfer-sources.cjs')){
 const old=fs.readFileSync(root+'/'+entry.file,'utf8'),updated=next(entry,old);
 if(process.argv.includes('--check'))assert.equal(updated,old);else if(updated!==old)patch+='*** Update File: '+root+'/'+entry.file+'\n'+require('./transfer-content.cjs').hunks(old,updated);
}if(process.argv.includes('--check'))console.log('Threat models and early navigation synchronized in both chapters');else process.stdout.write(patch+'*** End Patch\n');}
module.exports={sources,knowledge,methods,section,overview,next};
