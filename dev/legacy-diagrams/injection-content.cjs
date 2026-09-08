'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRenderer} = require('./render.cjs');
const root = path.resolve(__dirname, '../..');
const sources = {
  fewshot: 'https://arxiv.org/abs/2005.14165v4',
  alignment: 'https://arxiv.org/abs/2203.02155v1',
  direct: 'https://arxiv.org/abs/2211.09527v1',
  indirect: 'https://arxiv.org/abs/2302.12173v2',
  visual: 'https://papers.neurips.cc/paper_files/paper/2023/file/c1f0b856a35986348ab3414177266f75-Paper-Conference.pdf',
  architecture: 'https://arxiv.org/abs/2304.10592v2'
};
const diagram = {
  id: 'cyber-injection-channels',
  title: 'Input provenance and proposed output: data does not grant authority',
  source: `flowchart LR
  A["Application policy"] --> M["Model processing"]
  U["User message"] --> M
  D["Retrieved content"] --> M
  V["Image input"] --> M
  M --> P["Proposed reply / call"]
  classDef exposed stroke:#B83D2D,stroke-width:1.5px
  class U,D,V exposed
  linkStyle 1,2,3 stroke:#B83D2D`,
  overrides: {nodeSpacing: 25, rankSpacing: 45, wrappingWidth: 185},
  requiredText: ['Application policy', 'User message', 'Retrieved content', 'Image input', 'Model processing', 'Proposed reply / call']
};
const asset = root + '/cybersecurity/assets/diagrams/' + diagram.id + '.svg';
const channels = [
  ['Direct prompt injection', 'Attacker-controlled text supplied through the user-facing input.', 'An attempt to redirect the application’s task or violate its instruction policy; not necessarily a safety jailbreak.'],
  ['Indirect prompt injection', 'Instructions embedded in retrieved documents, tool results or other third-party material.', 'Content meant to be processed as data attempts to acquire instructional authority. The legitimate user need not have authored it.'],
  ['Jailbreak', 'An attempt to circumvent the model or application’s safety restrictions.', 'Describes the objective; it can overlap with prompt injection. Role-play alone does not prove a successful bypass.'],
  ['Text carried by an image', 'Visible or recognized text in an image supplied directly or retrieved indirectly.', 'Describe both the input modality and provenance. This is not automatically an optimized pixel perturbation.'],
  ['Optimized visual adversarial example', 'Pixels chosen to steer a vision-language model’s output under a stated attack setup.', 'A gradient-based image attack can work without carrying a readable instruction. Its constraints and outcome need separate evaluation.']
];
const outcomes = [
  ['Instruction is quoted', 'The assistant identifies an instruction inside the document but follows the requested summary task.', 'Exposure is established; successful redirection is not.'],
  ['Answer is redirected', 'The delivered reply is the attacker’s unrelated marker instead of the requested summary.', 'Task integrity is violated in this constructed example; confidential-data disclosure is not established.'],
  ['Disclosure is proposed, then blocked', 'A proposed call contains fictional private data; the executor denies it before dispatch.', 'A rejected disclosure attempt, not a completed external transfer. Check for earlier effects separately.'],
  ['Disclosure is actually delivered', 'The trace records unauthorized private data reaching the specified recipient.', 'Confidentiality is violated under the stated policy. A model-generated claim that it sent data is insufficient evidence.']
];
function table(name, caption, headers, rows) {
  return `<div tabindex="0" role="region" aria-label="${caption}: scroll horizontally" style="max-width:100%;overflow-x:auto"><table data-${name} style="min-width:640px"><caption>${caption}</caption><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${r[0]}</th>${r.slice(1).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function alignment() {
  return `<div id="alignment-scope">
<p>Keep three questions separate: how a task is specified at inference time, how model parameters were trained, and which controls the application enforces. A zero-shot prompt can be given to a model that previously underwent instruction tuning or RLHF. These are not mutually exclusive model categories.</p>
<div class="lk-tabs" data-kit="tabs"><div class="lk-tablist"><button class="lk-tab">Few-Shot</button><button class="lk-tab">Zero-Shot</button><button class="lk-tab">Aligned Model</button></div>
<div class="lk-tabpanel"><p>In-context few-shot prompting supplies task demonstrations without updating model weights during that interaction. The example count is a choice, not a universal 1–5 definition: <a href="${sources.fewshot}">Brown et al., section 2</a>, distinguish zero-, one- and few-shot settings and often use 10–100 demonstrations. This differs from other uses of “few-shot learning” that train or adapt parameters.</p>
<pre tabindex="0"><code>Task: classify the review as Positive or Negative.
Example: "The screen is beautiful." → Positive
Example: "It crashes every hour." → Negative
Example: "It works exactly as described." → Positive
New review: "The setup process was a bit confusing."
Answer:</code></pre><p>There are three demonstrations. “Negative” is an illustrative expected label for the new review, not an output obtained from a model here. Demonstrations can communicate a format; they do not guarantee accuracy or remove the cost of evaluation.</p></div>
<div class="lk-tabpanel"><p>Zero-shot prompting supplies a task description without demonstrations for that task in the prompt. It does not imply that the model was never trained on related tasks or examples.</p>
<pre tabindex="0"><code>Task: classify the review as Positive or Negative.
Review: "The setup process was a bit confusing."
Answer:</code></pre><p>Same task and review, but no demonstrations. In these slides, “zero-shot privacy” means testing whether confidentiality instructions work without demonstrations or fine-tuning for the particular rules. It names a prompting setup, not a privacy guarantee or a proven reasoning mechanism. Measure actual outputs and tool dispatches under an explicit policy.</p></div>
<div class="lk-tabpanel"><p>Alignment concerns behavior relative to specified intentions or values; helpfulness and harmlessness are goals, not unconditional properties certified by the word “aligned.” <a href="${sources.alignment}">Ouyang et al.</a> study supervised demonstrations, human preference comparisons and reinforcement learning. That is one training approach, not the definition of every aligned model or an access-control mechanism.</p><p>Training-time preference learning, inference-time examples and external enforcement can coexist. Evaluate ordinary task performance and adversarial behavior separately; an attack that fails to find a violation does not prove that no violation is possible.</p></div></div>
<h3>Redaction is not automatically anonymity</h3>
<p>Replacing a name with a stable placeholder can still leave identifying combinations or links across records. For example, a fictional message might retain a rare role, a small location and a date even after its name is replaced. Whether someone can be identified depends on remaining information and the observer’s knowledge, not merely the placeholder. Do not infer global compliance or confidentiality from a model’s promise to redact.</p>
<p>The <a href="#healthcare-evaluation">healthcare evaluation</a> tests a particular prompting setup. Its two checkpoints do not establish that all small models fail or that a larger model is safe. For explicit controls, see the <a href="#agent-enforcement">proposal/check/dispatch architecture</a>.</p>
<details data-alignment-check><summary>Can a previously instruction-tuned model be evaluated zero-shot?</summary><p>Yes. Zero-shot describes the absence of task demonstrations in this evaluation prompt, not the absence of earlier training. It does not certify confidential behavior.</p></details>
</div>`;
}
function injection(r) {
  return `<div id="injection-channels">
<p>Prompt injection attempts to make an application treat attacker-controlled content as instructions contrary to its intended task or policy. It need not rewrite the stored system prompt, change model weights or succeed. Distinguish the input route, attacker objective and observed result.</p>
<figure data-static-diagram="${diagram.id}" style="max-width:100%;margin:1.6rem 0"><div role="region" tabindex="0" aria-label="Input provenance diagram: scroll horizontally" style="max-width:100%;overflow-x:auto;background:#F3EFE3;border:1px solid #C9C3B6;padding:12px;box-sizing:border-box"><img src="../cybersecurity/assets/diagrams/${diagram.id}.svg" width="${r.width}" height="${r.height}" alt="Application policy, user message, retrieved content and image input feed model processing, which produces a proposed reply or call." style="display:block;width:${r.width}px;max-width:none;height:auto;margin:auto"></div><figcaption>Conceptual input channels, not a claim that all content is concatenated as text. Vermilion marks channels that an adversary might control; their labels also identify them without color. The application-policy channel is assumed trusted in this threat model. An input arrow conveys influence, not authority or successful compromise. The output is still a proposal: delivery and enforcement are shown in the <a href="#agent-enforcement">agent architecture</a>.</figcaption></figure>
${table('injection-taxonomy', 'Separate route, modality and objective', ['Term', 'What the attacker controls or seeks', 'Important distinction'], channels)}
<h3>What the primary studies establish</h3>
<p><a href="${sources.direct}">Perez and Ribeiro (2022)</a> study goal hijacking and prompt leaking in their evaluated language-model setup. <a href="${sources.indirect}">Greshake et al. (2023)</a> study instructions planted in data retrieved by integrated applications. Neither establishes that every adversarial input overrides system instructions or that every prompt is confidential.</p>
<p>The slides’ DAN (“Do Anything Now”) material illustrates a role-play jailbreak attempt. Treat its historical examples as examples, not a universal success rate or evidence about current systems. A jailbreak seeks a safety-policy bypass; an indirect injection can instead seek an ordinary but unauthorized action. Terminology can overlap, so state the concrete objective.</p>
<h3>Visual attacks: distinguish the model from the attack paper</h3>
<p><a href="${sources.architecture}">Zhu et al., MiniGPT-4</a>, describe a vision-language architecture connecting a visual encoder to a language model. That architectural work is different from <a href="${sources.visual}">Carlini et al., sections 6.1–6.3</a>, which evaluate adversarial image optimization on specific vision-language implementations. Their setup uses a differentiable path from pixels to output scores, random initial images and an output-targeting objective. Reported distortion is not a certificate of imperceptibility or a physical-camera result.</p>
<p>The latter paper’s reported success applies to its chosen models, prompts, target outputs and optimization setup. It is not a measurement of every multimodal model or of text-only safety filters. Text drawn inside an image, optimized pixels and physical patches are different constructions; do not silently transfer evidence between them. No model or attack is run by this lesson.</p>
<h3>Judge the observed outcome, not the attack’s name</h3>
${table('injection-outcomes', 'Constructed outcome checks — not experimental results', ['Case', 'What the trace actually shows', 'Supported conclusion'], outcomes)}
<p>For an empirical success rate, state the eligible trials, attack budget, success criterion, judge and failures or missing runs. A safety refusal, correct task completion and protection of confidential data are different outcomes. Inspect dispatched arguments and delivered replies; do not infer real execution from generated narration.</p>
<details data-injection-check><summary>Does an adversarial instruction inside a retrieved image prove that data was leaked?</summary><p>No. It identifies a possible indirect, image-carried injection attempt. Establish whether the application followed it and whether unauthorized information actually reached a recipient. Merely quoting the instruction or blocking a proposed call does not establish that outcome.</p></details>
</div>`;
}
function next(entry, html, dimensions) {
  let result = html;
  const sections = entry.file.startsWith('cybersecurity-reworked/') ? [12, 13] : [14, 15];
  for (const [i, number] of sections.entries()) {
    const title = i ? 'Prompt injection: channels, objectives and evidence' : 'Alignment, prompting and confidentiality';
    const pattern = new RegExp('<section id="s' + number + '">[\\s\\S]*?<\\/section>');
    assert(pattern.test(result));
    result = result.replace(pattern, `<section id="s${number}">\n<h2>${number}. ${title}</h2>\n${i ? injection(dimensions) : alignment()}\n</section>`);
    result = result.replace(new RegExp('(<a href="#s' + number + '">)[^<]*(<\\/a>)'), '$1' + title + '$2');
  }
  return result;
}
function dimensions() {
  const svg = fs.readFileSync(asset, 'utf8');
  return {width: Number(svg.match(/\bwidth="([\d.]+)"/)[1]), height: Number(svg.match(/\bheight="([\d.]+)"/)[1])};
}
if (require.main === module) (async () => {
  const renderer = await createRenderer();
  let rendered;
  try { rendered = await renderer.render(diagram); } finally { await renderer.close(); }
  const check = process.argv.includes('--check');
  if (check) assert.equal(fs.readFileSync(asset, 'utf8'), rendered.svg + '\n');
  else fs.writeFileSync(asset, rendered.svg + '\n');
  let patch = '*** Begin Patch\n';
  for (const entry of require('./transfer-sources.cjs')) {
    const file = root + '/' + entry.file;
    const old = fs.readFileSync(file, 'utf8');
    const updated = next(entry, old, rendered);
    if (check) assert.equal(updated, old);
    else if (updated !== old) patch += '*** Update File: ' + file + '\n' + require('./transfer-content.cjs').hunks(old, updated);
  }
  if (check) console.log('Alignment, injection channels, provenance and examples synchronized');
  else process.stdout.write(patch + '*** End Patch\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {sources, diagram, asset, channels, outcomes, alignment, injection, next, dimensions};
