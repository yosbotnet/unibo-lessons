'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const papers=[
 {id:'kim',name:'Kim et al. (2025)',title:'Small language models learn enhanced reasoning skills from medical textbooks',url:'https://www.nature.com/articles/s41746-025-01653-8',access:'Full article: methods and discussion reviewed',
  method:'Meerkat models are instruction-tuned using synthetic reasoning examples derived from medical textbooks and other medical instruction datasets. The published study evaluates 7B/8B models on six exam datasets, clinical case challenges and expert assessments.',
  finding:'The authors report improvements over the corresponding base models. These are task-specific evaluations, not evidence of better patient outcomes in a deployed service.',
  limit:'The discussion reports inaccurate answers, including dosage errors, and possible unsafe or biased responses. Expert validation remains necessary. Local hosting and generated explanations do not establish confidentiality or reliable clinical reasoning by themselves.'},
 {id:'magnini',name:'Magnini et al. (2025)',title:'Open-source small language models for personal medical assistant chatbots',url:'https://doi.org/10.1016/j.ibmed.2024.100197',access:'Bibliographic record and abstract reviewed; full text not obtained',
  method:'The abstract describes local open-model evaluation for hypertension-related chatbot tasks, including intent recognition and empathetic conversation, with Gemini Pro 1.5 as a comparator.',
  finding:'It reports task-dependent results and semantic agreement assessed with an LLM judge. This supports a research lead, not the earlier blanket statement of sufficient clinical performance.',
  limit:'The full methods, sample size, judge validation and detailed results have not been reviewed here: public full-text requests returned access errors. Do not infer clinical readiness or an audited privacy guarantee from the abstract or the proposed local architecture.'},
 {id:'griewing',name:'Griewing et al. (2024)',title:'Proof-of-concept study of a small language model chatbot for breast cancer decision support',url:'https://link.springer.com/article/10.1007/s00432-024-05964-3',access:'Full article: methods and limitations reviewed',
  method:'The guideline-based BC-SLM is evaluated on 20 fictional profiles, with five binary recommendation categories per profile. Its outputs are compared with a multidisciplinary tumor board and two other models.',
  finding:'The 100 binary decisions are 20 × 5 observations, not 100 independent patients. Concordance measures agreement with the selected reference decisions, not patient benefit.',
  limit:'The authors explicitly state that this is not clinical validation. A small fictional cohort, one tumor board and a particular national guideline constrain generalization. Referenced passages and local execution do not prove the complete application secure.'},
 {id:'aguzzi',name:'Aguzzi et al. (2025)',title:'RAG-Enhanced Open SLMs for Hypertension Management Chatbots',url:'https://link.springer.com/article/10.1007/s10916-025-02297-7',access:'Full article: evaluation and limitations reviewed',
  method:'A pilot compares retrieval-augmented generation with role-playing and full-context prompts for Italian hypertension QA. Automatic evaluation uses 21 items, with an additional limited expert-scoring exercise.',
  finding:'The reported benefit depends on the model and configuration; retrieval is not uniformly superior. Failure to find a significant difference on a small sample is not evidence that two approaches are equivalent.',
  limit:'The authors report synthetic-data validation limits, Italian-only and single-turn evaluation, and no patient participation. Answer ratings do not establish long-term safety, adherence benefits, or deployment readiness.'}
];
function content(){return `<div id="clinical-evidence" role="region" aria-labelledby="clinical-evidence-heading">
<h3 id="clinical-evidence-heading">Medical-model studies: what was actually evaluated</h3>
<p data-reading-leads>The slide reading list spans benchmark studies, a preclinical simulation and a QA pilot; it is not a list of validated clinical deployments. This scoped review, checked 8 September 2026, identifies the evidence actually consulted for each paper. It does not reproduce the experiments or provide medical recommendations.</p>
${papers.map(p=>`<article data-clinical-paper="${p.id}"><h4>${p.name}</h4><p><a href="${p.url}"><cite>${p.title}</cite></a><br><strong>${p.access}.</strong></p><p><strong>Evaluation.</strong> ${p.method}</p><p><strong>Reading the result.</strong> ${p.finding}</p><p><strong>Limits.</strong> ${p.limit}</p></article>`).join('\n')}
<p>For <strong>Aguzzi et al. (2026)</strong>, <cite>Privacy Leakage in Small Agentic Healthcare Models</cite>, see <a href="#healthcare-evaluation">the separate study section</a>. Its detailed numbers remain slide-reported: the paper’s full text and run-level artifacts were not obtained in that review.</p>
<details data-clinical-check><summary>Can benchmark accuracy, agreement with a tumor board and patient benefit be treated as the same outcome?</summary><p>No. Identify the evaluated unit, reference and setting first. A benchmark question, a fictional case’s binary recommendation and a patient outcome are different measurements. Repeated questions or multiple decisions for one case do not create additional independent patients. Clinical usefulness, privacy and application security need evidence beyond answer agreement.</p></details>
<p>For data handling, assess the complete application rather than its “local” or “small” label; see <a href="#agent-enforcement">the application boundary</a> and <a href="#regulation-scope">legal scope and responsibilities</a>. These reading notes do not choose treatments or authorize clinical deployment.</p>
</div><!-- END CLINICAL EVIDENCE -->`;}
function next(entry,html){
 if(!html.includes('href="#clinical-evidence"')){
  const anchor='<li><a href="#security-resources">Security references and tools</a></li>';
  assert(html.includes(anchor));html=html.replace(anchor,'<li><a href="#clinical-evidence">Medical-model study evidence</a></li>\n'+anchor);
 }
 const marker=/<div id="clinical-evidence"[\s\S]*?<!-- END CLINICAL EVIDENCE -->/;
 if(marker.test(html))return html.replace(marker,content());
 if(entry.file.startsWith('cybersecurity-reworked/')){
  const before='<div id="security-resources"';assert(html.includes(before));return html.replace(before,content()+'\n\n'+before);
 }
 const old=/<h4>SLMs in Clinical Deployments<\/h4>[\s\S]*?<\/ul>/;
 assert(old.test(html));return html.replace(old,content());
}
if(require.main===module){let patch='*** Begin Patch\n';
 for(const entry of require('./transfer-sources.cjs')){const file=root+'/'+entry.file,old=fs.readFileSync(file,'utf8'),updated=next(entry,old);
  if(process.argv.includes('--check'))assert.equal(updated,old);else if(updated!==old)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(old,updated);
 }
 if(process.argv.includes('--check'))console.log('Four scoped clinical reading entries synchronized in both chapters');else process.stdout.write(patch+'*** End Patch\n');
}
module.exports={papers,content,next};
