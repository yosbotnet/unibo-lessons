const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const model=require('../../cybersecurity/assets/transfer-evidence.cjs'),entries=require('./transfer-sources.cjs'),root=path.resolve(__dirname,'../..');
const region=(label,table)=>`<div tabindex="0" role="region" aria-label="${label}: scroll horizontally" style="max-width:100%;overflow-x:auto">${table}</div>`;
const rate=(k,n)=>n?`${k}/${n} (${(100*k/n).toFixed(1)}%)`:'not defined (empty denominator)';
function section(e,diagram){const r=model.evaluate(model.examples),lit=model.literature;return `<section id="s6">
<h2>6. Transferability: generation and evaluation are different</h2>
<p>Transfer occurs when an input crafted using model A also meets the attack objective on a different model B. It is <strong>an empirical outcome, not part of the definition of every adversarial example</strong>. Keep the candidate fixed when moving from A to B: adapting it with B's feedback changes the evaluation protocol.</p>
${diagram}
<h3>State the goal and the denominator</h3>
<p>For this example, clean inputs must be classified correctly by both models, retain ground-truth label y under the allowed modification, and share the same label set. Choose target t ≠ y before generating the candidate. <strong>Untargeted success</strong> means B(x + δ) ≠ y; <strong>targeted success</strong> means B(x + δ) = t. A different wrong label does not count as targeted success.</p>
${region('Illustrative predictions',`<table data-transfer-examples style="min-width:570px"><caption>Invented label records, not image/model measurements; y = 0 and t = 1 throughout</caption><thead><tr><th scope="col">Record</th><th scope="col">Clean A, B</th><th scope="col">Candidate A, B</th><th scope="col">Included?</th><th scope="col">Outcome on B</th></tr></thead><tbody>${model.examples.map(x=>{const c=model.classify(x);return `<tr><th scope="row">${x.id}</th><td>${x.cleanA}, ${x.cleanB}</td><td>${x.advA}, ${x.advB}</td><td>${c.eligible?'yes':'no: clean error'}</td><td>${c.outcome}</td></tr>`;}).join('\n')}</tbody></table>`)}
<p>Over the ${r.eligible.n} eligible records, targeted success is <strong>${rate(r.eligible.targeted,r.eligible.n)}</strong> and untargeted success is <strong>${rate(r.eligible.untargeted,r.eligible.n)}</strong>. Conditioning instead on targeted success on A leaves ${r.sourceSuccessful.n} records: targeted transfer becomes <strong>${rate(r.sourceSuccessful.targeted,r.sourceSuccessful.n)}</strong>. Record d succeeds on B despite failing on A; record e is excluded for its clean prediction. These are different denominators, not conflicting measurements. <a href="../cybersecurity/assets/transfer-evidence.cjs" download>Download the records and counting functions</a>.</p>
<h3>What the cited experiments actually show</h3>
<p>Transfer was studied by <a href="https://arxiv.org/abs/1312.6199">Szegedy et al. (2013 preprint, ICLR 2014)</a> and <a href="https://arxiv.org/abs/1412.6572">Goodfellow et al. (ICLR 2015)</a>. Goodfellow's panda illustration uses GoogLeNet: 57.7% is its clean-image class score, not a VGG-to-ResNet transfer rate.</p>
<p>The following is a transcription of the <strong>held-out diagonal of Table 3</strong> in <a href="${lit.url}">Liu et al., ICLR 2017, pp. 4 and 8</a>, not a local reproduction. The authors select 100 ILSVRC-2012 validation images correctly classified by all five models and assign target labels. Each attack uses the other four models; the listed model is held out. The metric is top-1 target-label matching over those 100 candidates.</p>
${region('Published held-out matching rates',`<table data-transfer-literature style="min-width:440px"><caption>Liu Table 3: four-model source ensemble → one held-out model</caption><thead><tr><th scope="col">Held-out B</th><th scope="col">Matching</th><th scope="col">Mean RMSD</th></tr></thead><tbody>${lit.rows.map(x=>`<tr><th scope="row">${x.heldOut}</th><td>${x.matchingPercent}%</td><td>${x.rmsd.toFixed(2)}</td></tr>`).join('\n')}</tbody></table>`)}
<p>RMSD uses pixel units [0,255], not an L∞ epsilon. These are optimization-based, targeted ensemble attacks, not single-model FGSM results. Untargeted accuracy is a different metric in a different table. The earlier 57%, 35%, 25%, 30%, 2% and 18% claims are not supported by these cited tables.</p>
<h3>Mechanisms and limits</h3>
<p>Liu's geometric analysis observes nearly orthogonal input gradients alongside aligned decision boundaries. Gradient alignment is therefore not a universal explanation. Nor does model family alone rank vulnerability: data, training, objective, perturbation constraints and evaluation method matter. An ensemble can improve transfer empirically without forcing all gradients to align.</p>
<p>In a numeric image model the perturbation is δ = x′ − x. A bitwise XOR visualization is not this arithmetic difference and does not prove shared features or transferable errors.</p>
<div class="callout warn"><span class="callout-label">Security implication</span><p>Crafting may require no access to B's internals or no B queries during generation. The attacker still needs a way to present the candidate to the target system, and an evaluator needs observable outcomes to measure success. Report query access, preprocessing, input constraints, objective, clean filtering and denominator. Do not infer a guarantee from the existence of transfer.</p></div>
</section>`;}
function comparison(){return `<h3>PGD vs FGSM: specify the configuration</h3>
${region('FGSM and PGD comparison',`<table data-attack-comparison><thead><tr><th scope="col">Aspect</th><th scope="col">FGSM</th><th scope="col">Projected sign-gradient ascent</th></tr></thead><tbody>
<tr><th scope="row">Steps</th><td>One input-gradient step</td><td>T steps per restart; T is a parameter</td></tr>
<tr><th scope="row">Optimization</th><td>Maximizes the local linearized loss over an L∞ box before input clipping</td><td>Recomputes gradients and projects; no general global-optimum guarantee</td></tr>
<tr><th scope="row">Transfer</th><td>Must be measured on held-out B</td><td>More iterations on A do not guarantee better transfer to B</td></tr>
<tr><th scope="row">Cost</th><td>One input-gradient evaluation</td><td>T input-gradient evaluations per restart, plus scoring</td></tr>
</tbody></table>`)}
<p>A gradient evaluation normally involves both a forward and a backward computation, not merely a forward pass. With no random start, one step and α = ε, this projected sign-gradient procedure reduces to input-clipped FGSM. A particular finite PGD run need not beat FGSM; retaining the best candidate across runs, including FGSM, avoids discarding that baseline under the chosen selection metric.</p>
<p><a href="https://arxiv.org/abs/1706.06083">Madry et al. (ICLR 2018)</a> use PGD in robust optimization. This is not a proof that every implementation finds the worst perturbation. <a href="https://arxiv.org/abs/1611.01236">Kurakin et al. (ICLR 2017)</a> report multi-step attacks transferring less well than single-step attacks in their experiments. White-box strength and transferability are different measurements.</p>
</section>`;}
const definition='<p>An adversarial example is an intentionally constructed inference-time input that causes an unwanted model outcome under a declared threat model. A small, label-preserving perturbation is one common setting. Imperceptibility, transfer to another model and cheap construction are not universal requirements; visible adversarial patches are another setting. See <a href="https://arxiv.org/abs/1712.09665">Brown et al., Adversarial Patch</a>.</p>';
const transferQuiz='<p>Transfer means a candidate generated using A also meets the chosen objective on B. Targeted success requires the chosen label, not merely any wrong label. Shared decision geometry and ensembles may help, but aligned gradients, model complexity and additional iterations do not provide universal guarantees. State the data, perturbation budget, query access and denominator; a surrogate may allow generation without B’s internals, not guaranteed success. See the example and sourced results in <a href="#s6">section 6</a>.</p>';
const pgdQuiz='<p>FGSM uses one input-gradient evaluation; projected sign-gradient ascent recomputes it for T steps per restart. Both obey the declared input and perturbation constraints. More optimization on A does not guarantee more transfer to B, and a finite run is not a global-optimum certificate. One step with α = ε, no random start and the same clipping recovers FGSM. See <a href="#s5">section 5</a>.</p>';
function next(e,html){
 const old=html.match(/<section id="s6">[\s\S]*?<\/section>/)[0],re=new RegExp('<!-- BEGIN STATIC DIAGRAM '+e.id+' -->[\\s\\S]*?<!-- END STATIC DIAGRAM '+e.id+' -->'),diagram=old.match(re)?.[0]||old.match(/<pre class="mermaid">[\s\S]*?<\/pre>/)?.[0];assert(diagram);
 let s=html.replace(old,section(e,diagram));
 s=s.replace(/<h3>PGD vs FGSM[^<]*<\/h3>[\s\S]*?<\/section>/,comparison());
 // Keep quiz questions, replace exactly the relevant answer paragraphs.
 s=s.replace(/(<summary>What is an adversarial example[^<]*<\/summary>\s*)<p>[\s\S]*?<\/p>/i,'$1'+definition);
 s=s.replace(/(<summary>[^<]*(?:FGSM.*PGD|PGD.*FGSM)[^<]*<\/summary>\s*)<p>[\s\S]*?<\/p>/i,'$1'+pgdQuiz);
 s=s.replace(/(<summary>Why does transferability occur\?[^<]*<\/summary>\s*)<p>[\s\S]*?<\/p>/,'$1'+transferQuiz);
 // Both introductions explicitly labeled the four traits as necessary.
 s=s.replace(/<p>Adversarial examples are defined as[\s\S]*?<\/p>/,definition);
 s=s.replace(/<p><strong>Adversarial examples<\/strong> are[\s\S]*?<\/ol>/,definition);
 s=s.replace('producing much stronger adversarial examples. It was proposed as a universal first-order attack by Madry et al. (2018).','used to search for high-loss inputs within a constraint set. Madry et al. (ICLR 2018) study it in robust optimization; success depends on the model and configuration.');
 // Random starts must already respect the input domain before the first gradient.
 s=s.replace(/x_0 = x \+ U\([^\n]+\/\/ Start with random perturbation within budget/g,'x_0 = Clip(x + U(-ε, ε), 0, 1)  // Feasible random start');
 s=s.replace('What is an adversarial example? List its four key characteristics.','What is an adversarial example? Which properties depend on the threat model?');
 s=s.replace('Why does transferability occur? List three factors and explain the security implication.','Why does transferability occur? Explain its limits and the security implication.');
 s=s.replace('FGSM takes one step. If one step crosses the boundary sometimes, many small steps cross it almost always — and find a more damaging point inside the same budget. <strong>PGD (Projected Gradient Descent)</strong> is the iterative counterpart, treated as a universal first-order attack.','FGSM takes one step. <strong>PGD (Projected Gradient Descent)</strong> recomputes the input gradient over multiple projected steps to search for a high-loss candidate. A finite run is not guaranteed to cross the boundary or find a global optimum.');
 s=s.replace('with the strongest first-order attack inside the same &epsilon; budget.','by searching inside the declared &epsilon; budget.');
 s=s.replace('set x_0 = x + a random perturbation drawn from U(-&epsilon;, &epsilon;) (the random start that escapes FGSM\'s single direction).','sample a random perturbation, add it to x and clip to [0,1] before evaluating the first gradient.');
 s=s.replace('Intuition: you can move anywhere inside the box, never outside it. This preserves visual fidelity.','This is a numeric constraint; visual similarity and preservation of the true label require separate justification.');
 const start='<div tabindex="0" role="region" aria-label="Reference table: scroll horizontally" style="max-width:100%;overflow-x:auto">';
 const beforeTables=s;s=s.replace(/<table>[\s\S]*?<\/table>/g,(table,offset)=>beforeTables.slice(0,offset).endsWith(start)?table:start+table+'</div>');
 const note='<p data-explorer-limit><strong>Current explorer limitation:</strong> this canvas uses a schematic displacement toward a drawn boundary, not the loss gradient in the FGSM formula. Its slider is not a verified L∞ perturbation bound. Use it only as a boundary-crossing illustration, not as measured attack evidence.</p>';
 if(!s.includes('data-explorer-limit'))s=s.replace(/(<h3>Interactive: [Dd]ecision[- ][Bb]oundary [Ee]xplorer<\/h3>\s*)<p>[\s\S]*?<\/p>/,'$1'+note);
 return s;
}
function hunks(old,next){
 const a=old.split('\n'),b=next.split('\n'),dp=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const ops=[];let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){ops.push(' '+a[i]);i++;j++;}else if(j<b.length&&(i===a.length||dp[i][j+1]>=dp[i+1][j]))ops.push('+'+b[j++]);else ops.push('-'+a[i++]);}
 const groups=[];for(let k=0;k<ops.length;k++)if(ops[k][0]!==' '){const lo=Math.max(0,k-2),hi=Math.min(ops.length,k+3),last=groups.at(-1);if(last&&lo<=last[1])last[1]=hi;else groups.push([lo,hi]);}
 return groups.map(([lo,hi])=>'@@\n'+ops.slice(lo,hi).join('\n')+'\n').join('');
}
if(require.main===module){let patch='*** Begin Patch\n';for(const e of entries){const file=root+'/'+e.file,html=fs.readFileSync(file,'utf8'),s=next(e,html);if(process.argv.includes('--check'))assert.equal(html,s,e.file+' content drift');else if(s!==html)patch+='*** Update File: '+file+'\n'+hunks(html,s);}
 if(process.argv.includes('--check'))console.log('Both transfer chapters, literature values, computed example and comparison are in sync');else process.stdout.write(patch+'*** End Patch\n');}
module.exports={section,comparison,next,definition,model,rate,hunks};
