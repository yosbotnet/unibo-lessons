// Source and measured results are updated together, through an explicit patch.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {verify,files}=require('./test.cjs');
const file=path.resolve(__dirname,'../../ds/DS-C4.html');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function replace(html,name,body){
 const start=`<!-- BEGIN CONTRACT ${name} -->`,end=`<!-- END CONTRACT ${name} -->`;
 assert.equal(html.split(start).length,2);assert.equal(html.split(end).length,2);
 const a=html.indexOf(start),b=html.indexOf(end,a);assert(b>a);
 return html.slice(0,a)+start+'\n'+body+'\n'+html.slice(b);
}
(async()=>{
 const report=await verify(),old=fs.readFileSync(file,'utf8');
 let next=replace(old,'EXAMPLE','<pre tabindex="0" role="region" aria-label="Tested Counter source — scroll horizontally if needed"><code class="language-solidity">'+esc(files['Counter.sol'].trimEnd())+'</code></pre>');
 const headers=['Call','Receipt status','State after execution','Retained logs','Gas used / limit','Fee (wei)'];
 const rows=report.rows.map(r=>[r.label,r.status===1?'1 · success':'0 · failure',r.state,r.logs,r.gasUsed+' / '+r.gasLimit,r.feeWei]);
 next=replace(next,'RESULTS','<div role="region" aria-label="Local EVM execution results — scroll horizontally if needed" tabindex="0" style="overflow-x:auto;max-width:100%">\n<table id="contract-results"><caption>Measured local execution · Solidity 0.8.36 · Cancun · no real funds</caption><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>\n'+rows.map(r=>'<tr>'+r.map((v,i)=>i===0?'<th scope="row">'+esc(v)+'</th>':'<td>'+esc(v)+'</td>').join('')+'</tr>').join('\n')+'\n</tbody></table>\n</div>');
 if(process.argv.includes('--patch')){
  let a=old.split('\n'),b=next.split('\n'),i=0,j=0;while(i<a.length&&a[i]===b[i])i++;while(j<a.length-i&&a.at(-j-1)===b.at(-j-1))j++;
  if(old!==next)console.log('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+[...a.slice(Math.max(0,i-2),i).map(s=>' '+s),...a.slice(i,a.length-j).map(s=>'-'+s),...b.slice(i,b.length-j).map(s=>'+'+s),...a.slice(a.length-j,a.length-j+2).map(s=>' '+s)].join('\n')+'\n*** End Patch');
 }else{assert.equal(next,old,'Contract source/results drift: run sync.cjs --patch and apply the patch');console.log('Compiled source and 5 locally executed result rows match chapter')}
})().catch(e=>{console.error(e);process.exitCode=1});
