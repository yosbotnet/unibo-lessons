const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {evidence,sha}=require('./hash-chain.cjs');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'ds/DS-C4.html');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const yes=v=>v?'yes':'no',code=s=>'<code style="white-space:normal;overflow-wrap:anywhere">'+esc(s)+'</code>';
function table(caption,headers,rows){
 const full=caption.startsWith('Full checks:');
 const columns=full?'<colgroup><col style="width:22%"><col style="width:56%"><col style="width:22%"></colgroup>':'';
 return '<div role="region" tabindex="0" aria-label="'+esc(caption)+' — scroll horizontally if needed" style="max-width:100%;overflow-x:auto"><table'+(full?' style="min-width:760px;table-layout:fixed"':'')+'><caption>'+esc(caption)+'</caption>'+columns+'<thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>\n'+rows.map(r=>'<tr>'+r.map((v,i)=>i?'<td>'+v+'</td>':'<th scope="row">'+v+'</th>').join('')+'</tr>').join('\n')+'\n</tbody></table></div>';
}
function hashes(){return table('Actual SHA-256: UTF-8 text, no final newline',['Exact input','Full digest'],['Alice->Bob: 1 $','Allce->Bob: 1 $','Alice->bob: 2 $'].map(s=>[code(JSON.stringify(s)),code(sha(s))]))}
function markup(){const e=evidence();return '<p>Saved outside the editable example: length '+e.anchor.length+', head '+code(e.anchor.head)+'. This trusted checkpoint is an explicit assumption, not something a hash creates for itself.</p>\n'+table('Three histories checked against the same original checkpoint',['History','Internally coherent?','Head matches?','Accepted?'],e.scenarios.map(s=>[esc(s.title),yes(s.result.coherent),yes(s.result.headMatches),yes(s.result.accepted)]))+'\n'+e.scenarios.map(s=>'<details data-hash-case="'+s.id+'"><summary>'+esc(s.title)+': full records and verification</summary>\n'+table('Full checks: '+s.id,['Record / payload','Stored digest / computed digest','Predecessor link correct?'],s.records.map((r,i)=>[code('B'+r.index+': '+r.payload),'Stored: '+code(r.digest)+'<br>Computed: '+code(s.result.rows[i].computed),yes(s.result.rows[i].linkOK)]))+'\n'+s.records.map((r,i)=>'<p>B'+i+' exact hash input (JSON encoded as UTF-8): '+code(s.result.rows[i].input)+'</p>').join('\n')+'\n</details>').join('\n')+'\n<p><a href="assets/examples/hash-chain.json">Download full inputs, digests and check results as JSON</a>. The record payloads are strings, not validated transfers; the example has no signatures, timestamps, proof-of-work or consensus.</p>'}
function replace(s,id,body){const begin=`<!-- BEGIN ${id} -->`,end=`<!-- END ${id} -->`;assert.equal(s.split(begin).length,2);assert.equal(s.split(end).length,2);const a=s.indexOf(begin),b=s.indexOf(end);assert(b>a);return s.slice(0,a)+begin+'\n'+body+'\n'+s.slice(b)}
function main(){
 const old=fs.readFileSync(file,'utf8'),next=replace(replace(old,'HASH EXAMPLES',hashes()),'HASH CHAIN TRACE',markup());
 const data=JSON.stringify(evidence(),null,2)+'\n',asset=path.join(root,'ds/assets/examples/hash-chain.json');
 if(process.argv.includes('--check')){assert.equal(next,old,'Hash examples/trace drift');assert.equal(fs.readFileSync(asset,'utf8'),data,'Hash JSON drift');console.log('SHA-256 examples, all three histories and full JSON in sync');return}
 fs.writeFileSync(asset,data);
 if(old===next)return;
 const a=old.split('\n'),b=next.split('\n');let i=0,j=0;while(i<a.length&&a[i]===b[i])i++;while(j<a.length-i&&a.at(-j-1)===b.at(-j-1))j++;
 console.log('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+[...a.slice(Math.max(0,i-2),i).map(s=>' '+s),...a.slice(i,a.length-j).map(s=>'-'+s),...b.slice(i,b.length-j).map(s=>'+'+s),...a.slice(a.length-j,a.length-j+2).map(s=>' '+s)].join('\n')+'\n*** End Patch');
}
if(require.main===module)main();module.exports={markup,hashes};
