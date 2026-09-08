'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRenderer} = require('./render.cjs');
const root = path.resolve(__dirname, '../..');
const sources = {
  gdpr:'https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=EN',
  grounds:'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en',
  scope:'https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en',
  edpb:'https://www.edpb.europa.eu/sme/assess-the-risks/data-breaches_en',
  hipaaScope:'https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html',
  hipaaPrivacy:'https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html',
  hipaaBreach:'https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html'
};
const diagram = {
  id:'cyber-incident-responsibilities',
  title:'An observed incident prompts technical response, assessment and documentation',
  source:`flowchart TB
  I["Observed incident"] --> T["Technical response"]
  I --> A["Assess notice duties"]
  I --> D["Records and evidence"]
  classDef urgent stroke:#B83D2D,stroke-width:1.5px
  class A urgent
  linkStyle 1 stroke:#B83D2D`,
  overrides:{nodeSpacing:30,rankSpacing:45,wrappingWidth:190},
  requiredText:['Observed incident','Technical response','Assess notice duties','Records and evidence']
};
const asset = root + '/cybersecurity/assets/diagrams/' + diagram.id + '.svg';
const definitions = [
  ['GDPR personal data','Information relating to an identified or identifiable natural person.','Not restricted to names or to information stored on EU servers.'],
  ['GDPR special categories','Article 9 includes health data and specified other categories.','A security-sensitive password or trade secret is not automatically an Article 9 category.'],
  ['HIPAA PHI','Individually identifiable health information held or transmitted by a covered entity or business associate, subject to exclusions.','Names and dates are identifiers, not a freestanding definition of PHI. Context and the regulated entity matter.']
];
const notices = [
  ['GDPR: processor → controller','Awareness of a personal data breach.','Without undue delay; the processor does not get a separate 72-hour allowance.'],
  ['GDPR: controller → supervisory authority','Personal data breach, unless unlikely to pose a risk to people’s rights and freedoms.','Without undue delay and, where feasible, within 72 hours of awareness; explain a later notice.'],
  ['GDPR: controller → affected people','Likely high risk, with Article 34 exceptions and safeguards to assess separately.','Without undue delay; this is not the same threshold or a separate 72-hour rule.'],
  ['HIPAA: covered entity → affected people','A notifiable breach of unsecured PHI.','Without unreasonable delay, at most 60 days after discovery, subject to applicable legal exceptions.'],
  ['HIPAA: business associate → covered entity','A breach of unsecured PHI at or by the business associate.','Without unreasonable delay, at most 60 days after discovery, subject to applicable legal exceptions.']
];
function table(name, caption, headers, rows, minimum=640) {
  return `<div role="region" tabindex="0" aria-label="${caption}: scroll horizontally" style="max-width:100%;overflow-x:auto"><table data-${name} style="min-width:${minimum}px"><caption>${caption}</caption><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row[0]}</th>${row.slice(1).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function regulation(r) {
  return `<div id="regulation-scope">
<p><strong>Educational overview, sources checked 8 September 2026.</strong> This is not a compliance determination or legal advice for an incident. Applicability, national rules, contracts and facts require qualified review. If handling a real incident, involve the responsible privacy/security/legal team promptly rather than waiting for a complete investigation.</p>
<h3>Use the applicable definitions</h3>
<p>“PII” and “sensitive information” are useful course-level terms, not interchangeable legal categories. Identifiability, sensitivity and an obligation to keep information confidential are different questions. The <a href="${sources.gdpr}">GDPR, Articles 4 and 9</a>, and <a href="${sources.hipaaPrivacy}">HHS Privacy Rule summary</a> use the distinctions below.</p>
${table('legal-definitions','Different legal categories — not one universal PII set',['Category','Meaning in this overview','Avoid this inference'],definitions)}
<h3>Check scope before choosing a rule</h3>
<p><a href="${sources.scope}">GDPR applicability</a> includes processing in the context of an EU establishment and certain offering or monitoring activities involving people in the EU by non-EU organisations. Article 2 also limits material scope. “EU” is not merely a server-location label.</p>
<p><a href="${sources.hipaaScope}">HIPAA applies to covered entities and business associates</a>, not every consumer health app. Covered entities include health plans, clearinghouses and providers conducting specified standard electronic transactions. A business-associate arrangement has its own requirements. Being outside HIPAA does not establish that no other privacy law applies.</p>
<h3>Permission to process is not always explicit consent</h3>
<p>Under the GDPR, identify an Article 6 lawful basis and, for health data, an applicable Article 9 condition. Explicit consent is one route, not the only one. Article 9(2)(h) addresses specified health/social-care purposes subject to its legal/contractual conditions and Article 9(3) safeguards. National conditions can also apply. See the <a href="${sources.grounds}">Commission’s explanation of legal grounds and special categories</a>; “used for healthcare” alone is not permission.</p>
<p>GDPR data minimisation concerns relevance and necessity for the specified purposes, not just initial collection. Article 17 erasure has grounds and exceptions, including certain legal obligations and legal claims; it is not an unconditional promise to delete every record.</p>
<p>HIPAA permits certain uses and disclosures without individual authorization, including treatment, payment and health-care operations subject to its rules. Its minimum-necessary standard has exceptions, including disclosures to or requests by providers for treatment. Do not treat HIPAA authorization and GDPR consent as identical mechanisms. Consult the <a href="${sources.hipaaPrivacy}">HHS summary and underlying rules</a>.</p>
<h3>Separate incident response from a notification verdict</h3>
<figure data-static-diagram="${diagram.id}" style="max-width:100%;margin:1.6rem 0"><div role="region" tabindex="0" aria-label="Incident responsibilities: scroll horizontally" style="max-width:100%;overflow-x:auto;background:#F3EFE3;border:1px solid #C9C3B6;padding:12px;box-sizing:border-box"><img src="../cybersecurity/assets/diagrams/${diagram.id}.svg" width="${r.width}" height="${r.height}" alt="An observed incident prompts parallel technical response, assessment of notice duties, and records and evidence." style="display:block;width:${r.width}px;max-width:none;height:auto;margin:auto"></div><figcaption>Parallel responsibilities, not a decision tree that declares compliance. Containment, evidence collection and notification assessment inform each other. Record awareness/discovery and update facts as they become available; do not interpret any box as permission to wait out a deadline. The vermilion branch highlights a time-sensitive assessment, not an automatic duty to notify everyone.</figcaption></figure>
<p>A GDPR personal data breach can affect confidentiality, integrity or availability; deliberate exfiltration is not required. Under <a href="${sources.edpb}">EDPB guidance</a>, document breaches even when authority notification is not required. Information can be supplied in phases; incomplete information does not justify simply waiting for the investigation to finish.</p>
<p>Under the <a href="${sources.hipaaBreach}">HIPAA Breach Notification Rule</a>, an impermissible PHI use or disclosure is presumed a breach unless a documented assessment demonstrates low probability of compromise or an exception applies. Assess the information and identifiers, recipient, actual acquisition/viewing and mitigation. Required notification concerns unsecured PHI; do not equate “encrypted somewhere” with meeting the rule’s conditions.</p>
${table('notice-duties','Selected notice duties — not an exhaustive incident manual',['Responsible party → recipient','Trigger to assess','Timing'],notices,730)}
<p>The GDPR authority and individual-notice thresholds are distinct. HIPAA reporting to the Secretary and, where applicable, the media has additional population thresholds and schedules: follow <a href="${sources.hipaaBreach}">HHS reporting requirements</a>, not a single deadline for every recipient. Statutory exceptions and applicable contracts require separate review.</p>
<p>A third-party API transfer is not automatically lawful or automatically reportable. Determine the actor, data, recipient, purpose, permission and applicable regime. Conversely, a blocked model proposal does not prove that nothing happened earlier in the trace.</p>
<p>Do not infer a monetary penalty from a model’s output label. The <a href="${sources.hipaaPrivacy}">HHS enforcement summary</a> distinguishes circumstances and notes inflation adjustments; a dated figure is not a universal current penalty schedule. No sanction is calculated here.</p>
<details data-regulation-check><summary>Does a privacy-labelled model output determine which authority must be notified?</summary><p>No. A model label is technical evidence to assess, not a legal finding. Establish facts, scope, responsibilities, risk and the relevant notification rule while responding promptly. These notes do not decide a real incident.</p></details>
</div>`;
}
function implications() {
  return `<div id="governance-implications"><h3>Implications: engineering choices versus legal requirements</h3>
<div class="lk-tabs" data-kit="tabs"><div class="lk-tablist"><button class="lk-tab">System designers</button><button class="lk-tab">Threat modeling</button><button class="lk-tab">Governance</button></div>
<div class="lk-tabpanel"><ul><li>Enforce actor, resource, payload and recipient permissions outside the model. A larger checkpoint does not remove this architectural question.</li><li>Assess the complete application: model, retrieval, tools, reply delivery, logs, storage and synchronization. Local inference alone is not the boundary.</li><li>Collect useful audit evidence without indiscriminately copying every secret into logs. Define access, retention, purpose and redaction; logs themselves need protection.</li></ul></div>
<div class="lk-tabpanel"><ul><li>Track data at rest, in transit and in use, including context windows and tool observations. Do not assume traditional threat modeling excluded computation.</li><li>Tool count is not a risk score: capabilities, privileges, data access, recipients and mediation determine the added exposure.</li><li>Separate attempted manipulation, proposed actions, executed calls and delivered replies. Evaluate false refusals and task utility as well as security outcomes.</li></ul></div>
<div class="lk-tabpanel"><ul><li>Apply existing law according to its scope. Calls to update frameworks or create agentic-AI certifications are policy proposals, not evidence that no current obligations apply.</li><li>A benchmark result or the phrase “privacy-safe” is not a legal certification. State what was evaluated, by whom and under which standard or regime.</li><li>Record assumptions, responsibilities and decisions, and arrange appropriate legal and domain review. No universal compliance claim follows from these teaching examples.</li></ul></div></div></div>`;
}
function conclusion() {
  return `<div class="callout note" data-security-conclusion><span class="callout-label">Conclusion</span><p>Define the protected asset, policy and threat model before assessing a model or application. Adversarial examples can undermine decision integrity; unauthorized disclosure can violate confidentiality; loss or disruption can affect availability. Memorization and tool use are mechanisms or capabilities, not proof that every execution is a breach. Security, privacy, task quality and legal compliance require distinct evidence and controls; no single model label or benchmark establishes all of them.</p></div>`;
}
function next(entry, html, r) {
  let result=html;
  const reworked=entry.file.startsWith('cybersecurity-reworked/');
  const number=reworked?17:13;
  const pattern=new RegExp('<section id="s'+number+'">[\\s\\S]*?<\\/section>');
  assert(pattern.test(result));
  const title='Privacy regulation: scope, responsibilities and evidence';
  result=result.replace(pattern,`<section id="s${number}">\n<h2>${number}. ${title}</h2>\n${regulation(r)}\n${reworked?implications()+'\n'+conclusion():''}\n</section>`);
  result=result.replace(new RegExp('(<a href="#s'+number+'">)[^<]*(<\\/a>)'),'$1'+title+'$2');
  if(reworked) {
    const terms=/<h3>What counts as a loss: PII vs sensitive information<\/h3>[\s\S]*?(?=<\/section>)/;
    assert(terms.test(result));
    result=result.replace(terms,`<h3>What counts as a loss: PII vs sensitive information</h3>\n<p>Identifiability, security sensitivity and legal category are distinct. “Sensitive information” is a broad course-level term, not proof that every item of PII belongs to a GDPR special category or is HIPAA PHI. Confidentiality concerns unauthorized disclosure; not every observed attack succeeds. See <a href="#regulation-scope">the applicable definitions and scope</a> before assigning legal consequences.</p>\n`);
  } else {
    const section=result.match(/<section id="s18">[\s\S]*?<\/section>/);
    assert(section);
    let bibliography=section[0].match(/<h3>Relevant Literature and Tools<\/h3>[\s\S]*?(?=<div class="callout note")/)[0];
    if(!bibliography.includes('data-reading-leads')) bibliography=bibliography.replace('<h4>SLMs in Clinical Deployments</h4>','<h4>SLMs in Clinical Deployments</h4>\n<p data-reading-leads>The following are reading leads listed in the slides, not validated clinical-deployment recommendations. The first four papers and their study limitations have not yet been reviewed here; the Aguzzi 2026 evidence limits are explained in <a href="#healthcare-evaluation">the dedicated section</a>.</p>');
    for(const [old,replacement] of [
      ['SLMs trained on medical textbooks achieve enhanced clinical reasoning','course-listed reading on medical-textbook training and clinical reasoning'],
      ['Open-source SLMs demonstrate sufficient performance for medical chatbots','course-listed reading on open-source models for medical-assistant chatbots'],
      ['Proof-of-concept SLM chatbot for breast cancer decision support','course-listed proof-of-concept topic: breast-cancer decision support'],
      ['RAG-enhanced open SLMs for hypertension management','course-listed topic: RAG and hypertension-management chatbots']
    ]) bibliography=bibliography.replace(old,replacement);
    result=result.replace(section[0],`<section id="s18">\n<h2>18. Implications, Mitigations, and Future Directions</h2>\n${implications()}\n${bibliography}${conclusion()}\n</section>`);
  }
  return result.replace('Regulatory implications: GDPR, HIPAA, and the need for updated frameworks','Regulatory implications: GDPR/HIPAA scope, responsibilities and evidence');
}
function dimensions() {
  const svg=fs.readFileSync(asset,'utf8');
  return {width:Number(svg.match(/\bwidth="([\d.]+)"/)[1]),height:Number(svg.match(/\bheight="([\d.]+)"/)[1])};
}
if(require.main===module)(async()=>{
  const renderer=await createRenderer();let r;
  try{r=await renderer.render(diagram);}finally{await renderer.close();}
  const check=process.argv.includes('--check');
  if(check)assert.equal(fs.readFileSync(asset,'utf8'),r.svg+'\n');else fs.writeFileSync(asset,r.svg+'\n');
  let patch='*** Begin Patch\n';
  for(const entry of require('./transfer-sources.cjs')){
    const file=root+'/'+entry.file,old=fs.readFileSync(file,'utf8'),updated=next(entry,old,r);
    if(check)assert.equal(updated,old);else if(updated!==old)patch+='*** Update File: '+file+'\n'+require('./transfer-content.cjs').hunks(old,updated);
  }
  if(check)console.log('Legal scope, notice distinctions, governance and conclusions synchronized');else process.stdout.write(patch+'*** End Patch\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={sources,diagram,asset,definitions,notices,regulation,implications,conclusion,next,dimensions};
