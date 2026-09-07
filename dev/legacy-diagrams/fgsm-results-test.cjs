const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const evidence=require('../../cybersecurity/assets/fgsm-evidence.cjs'),content=require('./fgsm-results.cjs');
const paper=process.env.NOTES_GOODFELLOW_PDF;assert(paper,'Set NOTES_GOODFELLOW_PDF to arXiv 1412.6572v3');
const bytes=fs.readFileSync(paper);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),evidence.sha256,'Unreviewed PDF version');
const result=spawnSync('pdftotext',['-f','3','-l','3','-layout',paper,'-'],{encoding:'utf8',timeout:15000,maxBuffer:1e6});assert.equal(result.status,0);assert(!result.error);
const text=result.stdout.replace(/\s+/g,' '),m=text.match(/= (\.\d+),.*?shallow softmax.*?error rate of ([\d.]+)%.*?confidence of ([\d.]+)%.*?maxout network.*?([\d.]+)%.*?confidence of ([\d.]+)%.*?= (\.\d+),.*?error rate of ([\d.]+)%.*?probability of ([\d.]+)%.*?convolutional maxout.*?CIFAR-10/);assert(m,'Published experiment paragraph not found');
const values=m.slice(1).map(Number),expected=[
 ['MNIST','Shallow softmax',values[1],values[2],values[0],'Pixel values in [0,1]'],
 ['MNIST','Maxout',values[3],values[4],values[0],'Pixel values in [0,1]'],
 ['CIFAR-10','Convolutional maxout',values[6],values[7],values[5],'Preprocessed inputs; standard deviation ≈ 0.5']
];
function validate(e){assert.deepEqual(e.rows.map(r=>[r.dataset,r.model,r.errorPercent,r.meanScorePercent,r.epsilon,r.units]),expected);assert.deepEqual(e.illustration,{model:'GoogLeNet',dataset:'ImageNet',cleanClass:'panda',cleanScorePercent:57.7,candidateClass:'gibbon',candidateScorePercent:99.3,epsilon:.007,unitContext:'GoogLeNet input encoding',count:1});}
validate(evidence);
assert.match(text,/pixel values in the interval \[0, 1\]/);assert.match(text,/preprocessing code, which yields a standard deviation of roughly 0\.5/);
assert.match(text,/57\.7% confidence.*?99\.3 % confidence/);assert.match(text,/\.007 corresponds.*?conversion to real numbers/);
let rejected=0;for(const mutate of [e=>e.rows[0].model='Maxout',e=>e.rows[2].errorPercent=87.2,e=>e.rows[2].units='Pixel values in [0,1]',e=>e.rows.splice(1,1),e=>e.illustration.count=100]){const bad=structuredClone(evidence);mutate(bad);assert.throws(()=>validate(bad));rejected++;}
for(const entry of require('./transfer-sources.cjs')){const html=fs.readFileSync(require('node:path').resolve(__dirname,'../..',entry.file),'utf8');assert.equal(content.next(html),html);const section=html.match(/<section id="s4">([\s\S]*?)<\/section>/)[1];assert(!/first efficient attack|cheapest possible|High success|87\.2%|\+1 or -1 per dimension/.test(section));assert(section.includes('x_candidate = clip(x + δ, lower, upper)'));assert(section.includes('Q = clip(P + ε·sign(Gradient), 0, 1)'),'Toy domain remains normalized');assert(!html.includes("'Full FGSM formula in one line'"));}
fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/fgsm-results-test.json',JSON.stringify({paperSha256:evidence.sha256,rows:evidence.rows,illustration:evidence.illustration,rejectedMutations:rejected,scope:'Source transcription, representation and chapter consistency; no network attacks rerun'},null,2)+'\n');
console.log('Three model-specific FGSM rows match the pinned paper; input units and single-image illustration checked; five false transcriptions rejected');
