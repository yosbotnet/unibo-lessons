'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),c=require('./oa-selection-content.cjs');
const root=path.resolve(__dirname,'../..'),dir=process.env.NOTES_OA_SELECTION_EVIDENCE,python=process.env.NOTES_OA_SELECTION_PYTHON;assert(dir&&python,'Set reviewed source directory and pinned NumPy/SciPy Python');
const hashes=['17a7f2838d5b92d2b1ca67f8297009db9806896c8ffc28bc72f2b485dd4e0e9e','06d05fc8397d481ea3e7b011f48969e5433ca6f15b2af18c940cfdcc7c112c9f','e7edda000772ac59b5e2dc07633a86ee227ee02b885bec61e316851e15f387cf','b76cac3a9540165296617c1dfdc709e234736a0b69ddb4875762b60f7437d8ed','f1f260998e47f0d7d994c8a08574901fdaa828cba0ce80fc47af47e125ce43a7','ece9833a485eccff4b193a88a5c574c2d08fd3552f0ede8032fce33689a6e39b','fa56d0732d729c88084ed98405acc2f21d453c517320392261e47228a428746a','3716659a789752bfba04e4f5ce08c1e0292b666bc5b083d62764fb65a0a933e1','874400669a9b53c025ee54623558dd7c4c731e521a9e7dcf07032fd03a5d8f2d','a3ab3532b27ba2053e17f87ea3d9d8c6943778e5324aab8b1c2e42b14e39230e','8caa15afc91b4eba8c988566b53f780fe74a3788d8e4edae17380c3b8ef7596c','9a741ff7024c4f4023b53e081d2f62f233b9cf44382743466ea58c43f9524c8c','8a3f5288cb83dbf11425432cc50b017951c41b81014a7a91020d9a19a00a3583'];
const names=['anova_rm','chi2_contingency','chisquare','cv','f_oneway','friedmanchisquare','jonckheere','kruskal','mannwhitneyu','page_trend_test','pointbiserialr','ttest_ind','wilcoxon'];
(async()=>{const pins={};names.forEach((n,i)=>{pins[n]=hashes[i];assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+n+'.html')).digest('hex'),hashes[i]);assert(c.sources[n]);});
 const slide=fs.readFileSync('/home/ybc/content/unibo-course-slides/68996-Operational Analytics/7 - Statistics_ inferential.txt');assert.equal(crypto.createHash('sha256').update(slide).digest('hex'),'a1bb74f95203168b0e23701a5a5718f8b951347145ca8c84a8a1efd580004493');
 const arithmetic=JSON.parse(execFileSync(python,['-B','-c',`import json, math, itertools
import numpy as np
import scipy
from scipy.stats import pearsonr, pointbiserialr, chi2_contingency, page_trend_test, friedmanchisquare, ttest_rel, ttest_ind
assert np.__version__ == '2.3.3' and scipy.__version__ == '1.16.2'
binary = np.array([0,0,1,1,0,1])
quantitative = np.array([-4,8,2,6,3,10])
assert math.isclose(pointbiserialr(binary,quantitative).statistic, pearsonr(binary,quantitative).statistic)
other = np.array([0,1,1,1,0,0])
table = np.zeros((2,2), dtype=int)
for a,b in zip(binary,other): table[a,b] += 1
a,b,c,d = table.ravel()
phi = (a*d-b*c) / math.sqrt((a+b)*(c+d)*(a+c)*(b+d))
assert math.isclose(phi,pearsonr(binary,other).statistic)
assert math.isclose(chi2_contingency(table,correction=False).statistic,len(binary)*phi**2)
ranks = np.array([[1,2,3],[1,3,2],[2,1,3]])
observed = sum(sum((j+1)*row[j] for j in range(3)) for row in ranks)
perms = list(itertools.permutations([1,2,3]))
distribution = [sum(sum((j+1)*row[j] for j in range(3)) for row in block) for block in itertools.product(perms,repeat=3)]
tail = sum(v >= observed for v in distribution)
page = page_trend_test(ranks,ranked=True,method='exact')
assert page.statistic == observed and math.isclose(page.pvalue,tail/216)
reversed_page = page_trend_test(ranks[:,::-1],ranked=True,method='exact')
assert page.pvalue != reversed_page.pvalue
assert friedmanchisquare(*ranks.T).statistic == friedmanchisquare(*ranks[:,::-1].T).statistic
x = np.array([1,2,3,4,5,6]); y = np.array([2,1,4,3,7,5])
assert not math.isclose(ttest_rel(x,y).statistic,ttest_rel(x,y[::-1]).statistic)
assert math.isclose(ttest_ind(x,y,equal_var=False).statistic,ttest_ind(x,y[::-1],equal_var=False).statistic)
print(json.dumps(dict(pointBiserial=float(pointbiserialr(binary,quantitative).statistic),phi=float(phi),pageStatistic=int(observed),orderedTail=int(tail),orderPermutations=len(distribution),reversedPageP=float(reversed_page.pvalue),pairingChangesPairedStatistic=True,numpy=np.__version__,scipy=scipy.__version__)))`],{encoding:'utf8'}));
 const {parse,parseFragment}=await import('../contracts/node_modules/parse5/dist/index.js'),html=fs.readFileSync(root+'/'+c.file,'utf8'),before=execFileSync('git',['show','954a22c:'+c.file],{cwd:root,encoding:'utf8'}),errors=[];parse(html,{onParseError:e=>errors.push(e)});assert.deepEqual(errors,[]);assert.equal(c.next(before),html);assert.equal(c.next(html),html);
 for(const previous of ['oa-frequency-content','oa-coin-content','oa-qq-content'])assert.equal(require('./'+previous+'.cjs').next(html),html);
 for(let i=1;i<=14;i++){if(i===12)continue;const re=new RegExp('<section id="s'+i+'"[^>]*>[\\s\\S]*?</section>');assert.equal(html.match(re)[0],before.match(re)[0]);}
 assert.deepEqual(html.match(/<svg\b[\s\S]*?<\/svg>/g),before.match(/<svg\b[\s\S]*?<\/svg>/g));assert.deepEqual(html.match(/<script\b[\s\S]*?<\/script>/g),before.match(/<script\b[\s\S]*?<\/script>/g));
 const rows=c.groups.flatMap(g=>g.rows);assert.deepEqual(rows.map(r=>r.id),['counts-gof','counts-independence','numeric-association','binary-association','two-paired','two-independent','many-independent','many-blocked','ordered','factorial']);
 const contracts={'counts-gof':['specified probabilities','expected counts'],'counts-independence':['independence','independent observational units','Paired binary'],'numeric-association':['linear','monotonic','causation'],'binary-association':['0/1','not generic rank-based'],'two-paired':['mean difference','symmetric about zero','ties'],'two-independent':['equal means','equal population variances','shape assumptions'],'many-independent':['equality of means','Rejection does not identify'],'many-blocked':['sphericity','complete blocks'],'ordered':['same subjects/blocks','ordered independent groups','prespecified order'],'factorial':['interactions','not a general replacement']};
 for(const r of rows)for(const phrase of contracts[r.id])assert(r.limits.includes(phrase),r.id+': '+phrase);
 const section=html.match(/<section id="s12"[^>]*>[\s\S]*?<\/section>/)[0];assert(!section.includes('all models are evaluated on the same folds'));assert(section.includes('does not automatically have its claimed error rate'));assert(section.includes('independently sorting the two columns destroys the pairing'));
 fs.writeFileSync('/home/ybc/notes-legacy-review-artifacts/oa-selection-test.json',JSON.stringify({pins,arithmetic,rows:rows.map(r=>r.id),markup:true,scope:'Source-backed selection boundaries, synthetic algebra/order checks and exact section preservation, not a universal test selector'},null,2)+'\n');console.log('10 reviewed design rows, 13 source pins, 216 Page permutations, correlation/pairing identities and markup/preservation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
