const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),font=require('./font.cjs'),m=require('../../cybersecurity/assets/fgsm-model.js'),view=require('../../cybersecurity/assets/fgsm-view.js'),entries=require('./transfer-sources.cjs');
function block(){const a=m.attack(m.initial,m.initial.epsilon);return `<!-- BEGIN FGSM EXPLORER -->
<h3>Interactive: FGSM with an explicit model</h3>
<p>This is a two-coordinate mathematical classifier, <strong>not a trained image network</strong>. Inputs are (u, v) in [0,1]². Define b(u) = 0.35 + 0.8(u − 0.5)², z = 8(v − b(u)), and pB = sigmoid(z). Predict B when v ≥ b(u), otherwise A. The class score is not a calibrated measure of real-world confidence.</p>
<pre tabindex="0" role="region" aria-label="Toy FGSM equations"><code>Reference y = predicted class of the clean point (A=0, B=1)
Loss J = log(1 + exp(z)) − y·z
Gradient = 8(pB − y) · (−1.6(u − 0.5), 1)
Q = clip(P + ε·sign(Gradient), 0, 1)</code></pre>
<p>Keep y fixed during the step. This demonstrates a <em>prediction flip relative to the clean label</em>, not a verified semantic error: no external ground-truth function is supplied. The sign step maximizes the first-order loss approximation over an L∞ box; it need not maximize the nonlinear loss or cross the decision boundary. Zero gradient components produce zero displacement. Domain clipping can make the actual change smaller than ε.</p>
<div data-fgsm-widget>
<fieldset disabled style="max-width:100%;box-sizing:border-box"><legend>Explore one sign-gradient step</legend>
<div style="display:flex;flex-wrap:wrap;gap:12px">
<label>u <input id="aeU" type="number" min="0" max="1" step="0.01" value="0.30" style="width:5em"></label>
<label>v <input id="aeV" type="number" min="0" max="1" step="0.01" value="0.43" style="width:5em"></label>
<label>ε <input id="aeEpsilon" type="range" min="0" max="0.25" step="0.01" value="0.08"><output id="aeEpsilonVal" for="aeEpsilon">0.08</output></label>
<button id="aeAttackBtn" type="button">Generate FGSM step</button><button id="aeResetBtn" type="button">Reset point and ε</button>
</div></fieldset>
<p role="status">Static worked example shown; interactive controls require JavaScript.</p>
<p>Clean: <span id="aeOrigClass">Class B</span> · Candidate: <span id="aeAdvClass">Class A</span></p>
<p id="aeMetrics">P = (0.3000, 0.4300); Q = (0.2200, 0.3500). δ = (−0.0800, −0.0800); ||δ||∞ = 0.0800.</p>
<figure data-static-plot="cyber-fgsm" style="max-width:100%;margin:1.5rem 0">
<div tabindex="0" role="region" aria-label="FGSM coordinate plot: scroll horizontally" style="overflow-x:auto;max-width:100%;background:#F3EFE3;border:1px solid #C9C3B6;padding:8px;box-sizing:border-box">
<img id="aeCanvas" src="../cybersecurity/assets/diagrams/cyber-fgsm.svg" width="332" height="426" alt="Worked example: point P in B moves down-left to Q in A within the dashed epsilon box." style="display:block;width:332px;max-width:none;height:auto;margin:auto"></div>
<figcaption>The curve is the exact quadratic decision boundary; v increases upward. The dashed box is the allowed L∞ region intersected with [0,1]². A filled blue circle denotes P and a red square Q; the straight arrow shows the actual step, not a network connection. The static example flips B to A with ε = 0.08. In interactive mode, click or drag inside the plot, or edit u/v with the keyboard; then generate a step. Reset restores all defaults and removes Q.</figcaption>
</figure></div>
<p>For the static example, J(P,y) = ${a.before.toFixed(4)} and J(Q,y) = ${a.after.toFixed(4)}. A larger loss alone does not imply a prediction flip. Epsilon measures these abstract coordinates, not pixel units or perceptual similarity. The model and figure share <a href="../cybersecurity/assets/fgsm-model.js" download>one downloadable implementation</a>; the plot is <a href="../cybersecurity/assets/diagrams/cyber-fgsm.svg" download>standalone SVG</a>. The construction follows the <a href="https://arxiv.org/pdf/1412.6572">FGSM first-order argument of Goodfellow et al., §4</a>, but this toy fixture is an editorial example, not their experiment.</p>
<!-- END FGSM EXPLORER -->`;}
function next(html){let s=html;const re=s.includes('<!-- BEGIN FGSM EXPLORER -->')?/<!-- BEGIN FGSM EXPLORER -->[\s\S]*?<!-- END FGSM EXPLORER -->/:/<h3>Interactive: [Dd]ecision[- ][Bb]oundary [Ee]xplorer<\/h3>[\s\S]*?(?=\n<\/section>)/;assert(s.match(re));s=s.replace(re,block());
 s=s.replace(/\/\/ Bespoke: Adversarial Perturbation Explorer \(canvas widget\)[\s\S]*?\n\}\)\(\);/,'// FGSM is implemented by the shared, independently tested model/view/widget files.');
 if(!s.includes('src="../cybersecurity/assets/fgsm-model.js"'))s=s.replace('</body>',`<script defer src="../cybersecurity/assets/fgsm-model.js"></script>\n<script defer src="../cybersecurity/assets/fgsm-view.js"></script>\n<script defer src="../cybersecurity/assets/fgsm-widget.js"></script>\n</body>`);
 if(!s.includes('href="../cybersecurity/assets/fgsm-widget.css"'))s=s.replace('</head>','<link rel="stylesheet" href="../cybersecurity/assets/fgsm-widget.css">\n</head>');
 s=s.replace('<div id="fgsm-code"></div>','<div id="fgsm-code"><pre tabindex="0" role="region" aria-label="FGSM with a valid input domain"><code>g = ∇x J(θ, x, y)\nδ = ε · sign(g)\nx_candidate = clip(x + δ, 0, 1)\nEvaluate the candidate; success is not guaranteed.</code></pre></div>');
 s=s.replace('Direction that maximises loss','Local loss gradient; sign gives the L∞ step');
 s=s.replace('Gives direction (+1 or -1) per dimension','Gives +1, 0 or -1 per coordinate');
 s=s.replace('New input that fools the classifier','Candidate: evaluate whether it fools the classifier');
 s=s.replace('The gradient ∇_x J points in the direction that <strong>maximises the loss</strong>. By moving the input in that direction, the model becomes increasingly confident in the wrong prediction. The parameter ε controls the magnitude of the perturbation — a budget that bounds the maximum change per pixel.','The gradient describes local loss sensitivity. Its sign maximizes the first-order approximation over an L∞ perturbation box; it is not generally the maximizer of the nonlinear loss. Epsilon bounds coordinate changes, and valid input ranges require clipping. Neither a prediction change nor perceptual invisibility is guaranteed.');
 s=s.replace(/<p><strong>Why it works\.<\/strong> The gradient [\s\S]*?<\/p>/,'<p><strong>Why it works.</strong> The gradient describes local loss sensitivity; its sign maximizes the first-order approximation over an L∞ box. Input clipping preserves the allowed domain, not perceptual invisibility. Evaluate the candidate: neither a global maximum nor a changed prediction is guaranteed.</p>');
 return require('./fgsm-results.cjs').next(s);
}
if(require.main===module){const asset=root+'/cybersecurity/assets/diagrams/cyber-fgsm.svg',svg=view.render(m.initial,m.initial.epsilon,true,font);if(process.argv.includes('--check'))assert.equal(fs.readFileSync(asset,'utf8'),svg);else fs.writeFileSync(asset,svg);
 let patch='*** Begin Patch\n';for(const e of entries){const file=root+'/'+e.file,html=fs.readFileSync(file,'utf8'),s=next(html);if(process.argv.includes('--check'))assert.equal(s,html);else if(s!==html)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(html,s);}
 if(process.argv.includes('--check'))console.log('Shared FGSM model, plot and both chapter widgets in sync');else process.stdout.write(patch+'*** End Patch\n');}
module.exports={block,next};
