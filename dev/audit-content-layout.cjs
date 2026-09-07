// Current browser evidence for whole-page overflow, distinct from figure audits.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/ybc/hosted/unibo-lessons/dev/node_modules/playwright');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const out=option('--out','/home/ybc/notes-content-review-artifacts/baseline.json'),inject=option('--inject',null),only=option('--only',null);
const files=require('../review/notes-inventory.json').records.map(p=>p.file).filter(f=>!only||only.split(',').some(prefix=>f.startsWith(prefix)));
(async()=>{const browser=await chromium.launch(),records=[];fs.mkdirSync(path.dirname(out),{recursive:true});
try{for(const width of [1280,390]){const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>/highlight\.min\.js$/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js',contentType:'application/javascript'}):r.abort());
for(const file of files){errors=[];await page.goto('file://'+path.join(root,file));if(inject)await page.addStyleTag({path:path.resolve(root,inject)});
const result=await page.evaluate(()=>{const viewport=innerWidth,doc=document.documentElement;
 function name(e){return e.tagName.toLowerCase()+(e.id?'#'+e.id:e.classList.length?'.'+[...e.classList].join('.'):'')}
 function contained(e){for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const s=getComputedStyle(a);if(['auto','scroll','hidden','clip'].includes(s.overflowX)&&a.clientWidth<a.scrollWidth)return true}return false}
 const candidates=[...document.body.querySelectorAll('*')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml'&&!['SCRIPT','STYLE','LINK','META'].includes(e.tagName)&&e.getBoundingClientRect().width&&e.getBoundingClientRect().right>viewport+1&&!contained(e));
 const leaves=candidates.filter(e=>!candidates.some(c=>c!==e&&e.contains(c))).slice(0,40).map(e=>({element:name(e),parent:name(e.parentElement),section:e.closest('section')?.id,widget:e.closest('[id]')?.id,text:e.textContent.trim().slice(0,130),right:Math.round(e.getBoundingClientRect().right),width:Math.round(e.getBoundingClientRect().width),display:getComputedStyle(e).display,whiteSpace:getComputedStyle(e).whiteSpace}));
 return {kit:document.body.classList.contains('lk'),pageWidth:doc.scrollWidth,overflow:doc.scrollWidth>viewport+1,suspects:leaves};});records.push({file,width,...result,errors:[...errors]});
}await page.close();}}
finally{await browser.close()}
const report={visits:records.length,pages:files.length,overflow:records.filter(p=>p.overflow).length,records};fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({visits:report.visits,overflow:report.overflow,desktop:records.filter(p=>p.overflow&&p.width===1280).map(p=>p.file),mobile:records.filter(p=>p.overflow&&p.width===390).length,output:out},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
