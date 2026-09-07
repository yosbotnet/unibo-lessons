// Render actual legacy Mermaid blocks with a pinned local v11 fixture.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'../..'),fixture=process.env.MERMAID_FIXTURE||path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
const out='/home/ybc/notes-legacy-review-artifacts',reportName=process.env.REPORT_NAME||'audit';
if(!/^[a-z0-9-]+$/.test(reportName))throw Error('Invalid report name');
const files=require('../../review/notes-inventory.json').records.map(p=>p.file).filter(f=>/class="mermaid"/.test(fs.readFileSync(path.join(root,f),'utf8')));
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch(),records=[];
try{for(const width of [1280,390]){for(const file of files){const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(/^https?:/,r=>/mermaid(?:@[^/]+)?\/dist\/mermaid(?:\.min)?\.js/.test(r.request().url())?r.fulfill({path:fixture,contentType:'application/javascript'}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js',contentType:'application/javascript'}):r.abort());
await page.goto('file://'+path.join(root,file));
await page.waitForFunction(()=>[...document.querySelectorAll('.mermaid')].every(e=>e.querySelector('svg')),null,{timeout:5000}).catch(()=>{});
const diagrams=[];
for(let i=0;i<await page.locator('.mermaid').count();i++){
const element=page.locator('.mermaid').nth(i);
// Exercise the real tab controls; hidden panels cannot be screenshotted.
await element.evaluate(e=>{const panels=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.matches('.lk-tabpanel'))panels.unshift(p);for(const p of panels){const tabs=p.closest('.lk-tabs');const siblings=[...tabs.querySelectorAll('.lk-tabpanel')].filter(x=>x.closest('.lk-tabs')===tabs);const buttons=[...tabs.querySelectorAll('.lk-tab')].filter(x=>x.closest('.lk-tabs')===tabs);buttons[siblings.indexOf(p)]?.click()}for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true});
const info=await element.evaluate((e,i)=>({i,rendered:!!e.querySelector('svg')&&!e.querySelector('.error-icon,.error-text'),visible:!!e.getClientRects().length,invalidGeometry:[...e.querySelectorAll('[d],[transform]')].filter(x=>/NaN|undefined|Infinity/.test((x.getAttribute('d')||'')+(x.getAttribute('transform')||''))).length,source:e.querySelector('svg')?null:e.textContent,viewBox:e.querySelector('svg')?.getAttribute('viewBox'),text:[...e.querySelectorAll('text')].map(t=>t.textContent).join(' ').slice(0,200),pageOverflow:document.documentElement.scrollWidth>innerWidth+1}),i);
if(width===1280&&info.visible)await element.screenshot({path:path.join(out,file.replaceAll('/','-').replace('.html','')+'-'+i+'.png'),timeout:5000}).catch(e=>{info.screenshotError=e.message.split('\n')[0]});
diagrams.push(info);
}
records.push({file,width,pageOverflow:diagrams.some(d=>d.pageOverflow),diagrams,errors});
fs.writeFileSync(path.join(out,reportName+'-partial.json'),JSON.stringify(records,null,2));await page.close();
}console.log('Completed legacy viewport '+width);}}
finally{await browser.close()}
const report={pages:files.length,diagrams:records.filter(r=>r.width===1280).reduce((n,r)=>n+r.diagrams.length,0),records};fs.writeFileSync(path.join(out,reportName+'.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pages:report.pages,diagrams:report.diagrams,issues:records.filter(r=>r.errors.length||r.pageOverflow||r.diagrams.some(d=>!d.rendered||d.invalidGeometry)).map(r=>({file:r.file,width:r.width,errors:r.errors,diagrams:r.diagrams.filter(d=>!d.rendered||d.invalidGeometry).map(d=>({i:d.i,rendered:d.rendered,invalidGeometry:d.invalidGeometry}))}))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
