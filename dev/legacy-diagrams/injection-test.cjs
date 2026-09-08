'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const c = require('./injection-content.cjs');
const root = path.resolve(__dirname, '../..');
const evidence = process.env.NOTES_INJECTION_EVIDENCE;
assert(evidence, 'Set NOTES_INJECTION_EVIDENCE to the reviewed primary PDF directory');
const pins = {
  'fewshot.pdf': '97fd272f1fdfc18677462d0292f5fbf26ca86b4d1b485c2dba03269b643a0e83',
  'rlhf.pdf': 'c1984bb50a5b90fddb895fdc3a0f72e5bc977148c9f63ef6040cbe7a3e1f0d98',
  'perez.pdf': 'e0a69946a77a307b2a153d285a54442d4845e2354a920c7c2a6324481929dc09',
  'injection.pdf': '428e23e8c7e4f89310e113e38d082b3f65548a8b887188ebc536099061800e81',
  'carlini.pdf': '6040533894c63a038cdb26890fb140ea172d3d2fffea5a959ad168a218c16e49',
  'minigpt.pdf': 'a78f64448a86d91bd3c821178686cbe129312d53ee2b7eaf29ab412ce44c2ac0'
};
const text = {};
for (const [name, sha] of Object.entries(pins)) {
  const file = path.join(evidence, name);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), sha);
  text[name] = execFileSync('pdftotext', ['-layout', file, '-'], {encoding: 'utf8', maxBuffer: 5e6}).replace(/\s+/g, ' ');
}
assert.match(text['fewshot.pdf'], /no weight updates are allowed/);
assert.match(text['fewshot.pdf'], /K in the range of 10 to 100/);
assert.match(text['rlhf.pdf'], /human-labeled comparisons/);
assert.match(text['rlhf.pdf'], /train a reward model/);
assert.match(text['perez.pdf'], /goal hijacking and prompt leaking/);
assert.match(text['injection.pdf'], /injecting prompts into data likely to be retrieved/);
assert.match(text['carlini.pdf'], /end-to-end differentiable implementation/);
assert.match(text['carlini.pdf'], /sampling each pixel uniformly at random/);
assert.match(text['minigpt.pdf'], /Deyao Zhu/);
assert.match(text['minigpt.pdf'], /frozen visual encoder/);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('/home/ybc/content/exams/Cybersecurity/03 - privacy in LLM.pdf')).digest('hex'), '82506e353bda60ff819a96eaa8b538818b625639343b658e434b2bf6a6855749');

(async () => {
  const {parse} = await import('../contracts/node_modules/parse5/dist/index.js');
  const scripts = html => [...html.matchAll(/<script\b[\s\S]*?<\/script>/g)].map(m => m[0]);
  for (const entry of require('./transfer-sources.cjs')) {
    const html = fs.readFileSync(root + '/' + entry.file, 'utf8');
    const old = execFileSync('git', ['show', '2818b90:' + entry.file], {cwd: root, encoding: 'utf8'});
    const errors = [];
    parse(html, {onParseError: error => errors.push(error)});
    assert.deepEqual(errors, []);
    assert.equal(c.next(entry, html, c.dimensions()), html);
    assert.deepEqual(scripts(html), scripts(old), 'No widget or script changes');
    for (const marker of ['data-kit="tabs"', 'data-fgsm', 'data-agent-case=']) {
      assert.equal(html.split(marker).length, old.split(marker).length, 'Preserve ' + marker);
    }
    for (const wrong of ['spoiler: not on small models', 'typically <strong>1 to 5</strong>', '1&ndash;5 input-output examples', 'Carlini, Zhu et al.', 'is the proof that <strong>alignment is brittle</strong>']) {
      assert(!html.includes(wrong), 'Remove unsupported claim: ' + wrong);
    }
    for (const url of Object.values(c.sources)) assert(html.includes('href="' + url + '"'));
    assert.equal((html.match(/data-injection-taxonomy/g) || []).length, 1);
    assert.equal((html.match(/data-injection-outcomes/g) || []).length, 1);
  }
  assert.equal(c.channels.length, 5);
  assert.equal(c.outcomes.length, 4);
  assert.equal(c.dimensions().width, 738);
  assert.equal(c.dimensions().height, 291);
  fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/injection-test.json', JSON.stringify({pins,chapters:2,taxonomyRows:5,outcomeRows:4,scriptsUnchanged:true,markup:true,idempotence:true,scope:'Source provenance and constructed examples; no real jailbreak or model evaluation'}, null, 2) + '\n');
  console.log('Six primary PDFs, two chapter replacements, 5 distinctions/4 outcomes, unchanged scripts and markup passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
