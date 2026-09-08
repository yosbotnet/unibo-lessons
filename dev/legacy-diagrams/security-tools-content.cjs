'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const sources={
  cleverhans:'https://github.com/cleverhans-lab/cleverhans',
  foolbox:'https://github.com/bethgelab/foolbox',
  robustbench:'https://github.com/RobustBench/robustbench',
  art:'https://github.com/Trusted-AI/adversarial-robustness-toolbox',
  agentdojo:'https://arxiv.org/html/2406.13352v3',
  agentdojoCode:'https://github.com/ethz-spylab/agentdojo',
  camel:'https://arxiv.org/html/2503.18813v2',
  progent:'https://arxiv.org/html/2504.11703v1',
  agentleak:'https://arxiv.org/html/2602.11510v3'
};
const models=[
  {id:'cleverhans',name:'CleverHans',role:'Attack implementations',description:'Python reference implementations for adversarial-example evaluation. Since v4, supports JAX, PyTorch and TensorFlow 2; older releases used TensorFlow 1.',limit:'Select the implementation for the actual framework and pin dependencies. A framework name does not establish compatibility with every version or attack.'},
  {id:'foolbox',name:'Foolbox',role:'Attack library',description:'Foolbox 3 uses EagerPy for attacks on PyTorch, TensorFlow and JAX models, including gradient-based and decision-based methods.',limit:'Model bounds, preprocessing, the attack criterion and perturbation budget must match the experiment; a failed search is not a robustness certificate.'},
  {id:'robustbench',name:'RobustBench',role:'Benchmark and model zoo',description:'Standardized empirical robustness evaluation, leaderboards and reusable model checkpoints; includes L∞, L₂ and common-corruption settings.',limit:'Compare the same dataset and threat model. AutoAttack and adaptive evaluations provide evidence for tested conditions, not universal or formally certified robustness.'},
  {id:'art',name:'Adversarial Robustness Toolbox (ART)',role:'ML-security toolbox',description:'Python tools for evasion, poisoning, extraction and inference, with attacks, defenses, estimators and metrics. Hosted by LF AI & Data.',limit:'Choose a supported estimator and method for the threat being tested. Installing the toolbox does not automatically protect a model or agent.'}
];
const agents=[
  {id:'agentdojo',name:'AgentDojo',role:'Agent evaluation environment',description:'Extensible tasks, tools, attacks and defenses. User-task and attacker-goal checks inspect outputs and environment state; benign utility and attack outcomes are distinct.',limit:'It is not merely a final-answer text filter. Results depend on the task suite, agent, defense and attacker; running the benchmark does not enforce production policy.'},
  {id:'camel',name:'CaMeL',role:'Architectural defense',description:'Separates control and data flow, with an interpreter, capabilities and explicit tool policies. See the reviewed paper’s threat model and non-goals.',limit:'Assumes trusted user instructions. Not a universal defense against misleading text without relevant data/control-flow effects; side channels and human clarification remain concerns.'},
  {id:'progent',name:'Progent — Shi et al. (2025)',role:'Programmable privilege control',description:'A policy language and runtime enforcement for tool calls. Policies may be authored by people or generated and updated with LLM assistance.',limit:'Enforcement of a specified policy is not proof that an LLM wrote the right policy. The reviewed v1 excludes text-output attacks and abuse within permitted privileges.'},
  {id:'agentleak',name:'AgentLeak — El Yagoubi et al. (2026)',role:'Multi-agent privacy benchmark',description:'The reviewed v3 instruments seven channels. Its main evaluation covers final outputs, inter-agent messages and shared memory; other channels have narrower evaluations.',limit:'Instrumentation is not equal empirical coverage. A benchmark flag is not an automatic legal finding; detector errors and scenario/topology limits need separate assessment.'}
];
function table(id,caption,rows){return `<div role="region" tabindex="0" aria-label="${caption}: scroll horizontally" style="max-width:100%;overflow-x:auto"><table data-security-tools="${id}" style="width:100%;min-width:740px;table-layout:fixed"><caption>${caption}</caption><colgroup><col style="width:24%"><col style="width:38%"><col style="width:38%"></colgroup><thead><tr><th scope="col">Resource / role</th><th scope="col">What it provides</th><th scope="col">Interpretation boundary</th></tr></thead><tbody>${rows.map(r=>`<tr data-tool="${r.id}"><th scope="row"><a href="${sources[r.id]}">${r.name}</a><br>${r.role}</th><td>${r.description}</td><td>${r.limit}</td></tr>`).join('')}</tbody></table></div>`;}
function content(){return `<div id="security-resources" role="region" aria-labelledby="security-resources-heading">
<h3 id="security-resources-heading">Security references: implementation, evaluation and enforcement</h3>
<p>These resources serve different purposes. An attack library constructs test inputs; a benchmark defines evaluation conditions; a policy mechanism constrains execution. Some projects span several roles, but none of those roles alone establishes application security. Descriptions below were checked against project documentation and the linked paper versions on 8 September 2026; these notes do not execute or reproduce their experiments.</p>
${table('models','Adversarial ML resources — implementations versus benchmark evidence',models)}
${table('agents','Agent security resources — measurement versus enforcement',agents)}
<p><strong>Read the version, not just the project name.</strong> AgentLeak’s course-listed “Full-Stack” title refers to an earlier version. The linked v3 is titled <cite>A Benchmark for Internal-Channel Privacy Leakage in Multi-Agent LLM Systems</cite> and explicitly distinguishes channel instrumentation from evaluation coverage. Do not merge numbers from different versions, project pages or experiments.</p>
<p>For AgentDojo, consult both the <a href="${sources.agentdojo}">paper’s task and metric definitions</a> and the <a href="${sources.agentdojoCode}">implementation</a>. A test may inspect a changed environment, not just the final reply. Record the suite revision, model identifier, configuration, attack access, success predicate and denominator when reporting a result.</p>
<details data-security-tools-check><summary>A gate blocks every tool call. Does a zero attack-success rate establish a useful secure agent?</summary><p>No. It may block the tested attacker goal while also preventing the legitimate task. Measure task completion alongside attack success, and state what the gate mediates. A tool-call policy may leave final replies or other data paths outside its scope. The <a href="#agent-enforcement">local policy example</a> is a teaching model, not an implementation or evaluation of CaMeL or Progent.</p></details>
<p>Before using external tools in an experiment, choose and test a pinned environment and use authorized, non-sensitive test data. The browser widgets in this chapter are local teaching examples; they do not load these Python packages or call hosted models.</p>
</div><!-- END SECURITY RESOURCES -->`;}
function next(entry,html){
  if(!html.includes('href="#security-resources"')){
    const quizLink='<li><a href="#quiz">Check Your Understanding</a></li>';
    assert(html.includes(quizLink));
    html=html.replace(quizLink,'<li><a href="#security-resources">Security references and tools</a></li>\n'+quizLink);
  }
  const marker=/<div id="security-resources"[\s\S]*?<!-- END SECURITY RESOURCES -->/;
  if(marker.test(html))return html.replace(marker,content());
  if(entry.file.startsWith('cybersecurity-reworked/')){
    assert(html.includes('<section id="quiz">'));
    return html.replace('<section id="quiz">',content()+'\n\n<section id="quiz">');
  }
  const old=/<h4>Security in LLMs<\/h4>[\s\S]*?(?=<div class="callout note" data-security-conclusion)/;
  assert(old.test(html),'Expected original security reading/tool lists');
  return html.replace(old,content()+'\n\n');
}
if(require.main===module){
  let patch='*** Begin Patch\n';
  for(const entry of require('./transfer-sources.cjs')){
    const file=root+'/'+entry.file,old=fs.readFileSync(file,'utf8'),updated=next(entry,old);
    if(process.argv.includes('--check'))assert.equal(updated,old);else if(updated!==old)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(old,updated);
  }
  if(process.argv.includes('--check'))console.log('Eight security resource descriptions synchronized in both chapters');else process.stdout.write(patch+'*** End Patch\n');
}
module.exports={sources,models,agents,content,next};
