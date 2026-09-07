const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('node:crypto');
const reviewedScripts = require('./content-layout/script-changes.json');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.argv[2] || '/home/ybc/hosted/unibo-lessons';
const courses = 'dl irs asmd asw bi bigdata dm ise netprog oa pm reti-lm sap spe visione'.split(' ');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  await page.route(/^https?:/, r => /highlight\.min\.js$/.test(r.request().url()) ? r.fulfill({path:path.join(root,'dl/assets/highlight.min.js'),contentType:'application/javascript'}) : r.abort());
  const failures = [], report = [];
  for (const course of courses) for (const file of fs.readdirSync(path.join(root,course)).filter(f=>/^cap-.*\.html$/.test(f))) {
    const rel=course+'/'+file, source=fs.readFileSync(path.join(root,rel),'utf8'), old=fs.readFileSync(path.join(baseline,rel),'utf8');
    const scripts = s => [...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
    const bodies=scripts(source), oldBodies=scripts(old);
    if(JSON.stringify(bodies)!==JSON.stringify(oldBodies.map(s=>s.replaceAll('&thetas;','&theta;')))){
      const hash=s=>crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex'),review=reviewedScripts[rel];
      if(!review||review.before!==hash(oldBodies)||review.after!==hash(bodies))failures.push(rel+': unreviewed inline script change');
    }
    bodies.forEach((body,i)=>{try{new vm.Script(body)}catch(e){failures.push(rel+': script '+i+' '+e.message)}});
    const errors=[];const onerror=e=>errors.push(e.message);page.on('pageerror',onerror);
    await page.goto('file://'+path.join(root,rel));
    const svgs=[...source.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].flatMap(f=>[...f[0].matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m=>m[0]));
    const validation=await page.evaluate(svgs=>{
      let xml=[];const decode=document.createElement('textarea');
      svgs.forEach((s,i)=>{s=s.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g,(full)=>{decode.innerHTML=full;return [...decode.value].map(c=>'&#'+c.codePointAt(0)+';').join('')});let doc=new DOMParser().parseFromString(s,'application/xml');if(doc.querySelector('parsererror'))xml.push({i,error:doc.querySelector('parsererror').textContent});});
      const escaped=[...document.querySelectorAll('figure text,figure path,figure rect,figure circle,figure g')].filter(e=>e.namespaceURI!=='http://www.w3.org/2000/svg').length;
      const missingMarkers=[];for(let el of document.querySelectorAll('figure svg [marker-end],figure svg [marker-start]'))for(let name of ['marker-end','marker-start']){let id=el.getAttribute(name)?.match(/url\(#([^)]*)\)/)?.[1];if(id&&!document.getElementById(id))missingMarkers.push(id)}
      return {xml,escaped,missingMarkers,buttons:document.querySelectorAll('button').length,sliders:document.querySelectorAll('input[type=range]').length};
    },svgs);
    // Exercise existing widget event handlers with valid, different values and tabs/buttons.
    const interactions=await page.evaluate(()=>{let sliders=0,buttons=0;for(let e of document.querySelectorAll('input[type=range]')){const min=Number(e.min)||0,max=Number(e.max)||100;e.value=Number(e.value)===max?min:max;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));sliders++;}for(let e of document.querySelectorAll('button')){if(e.disabled||e.closest('form')||/install|scarica|download|export|stampa|print|play|run|start|avvia|auto|bulk|1000|reset/i.test(e.textContent))continue;e.click();buttons++;}return {sliders,buttons}});
    page.off('pageerror',onerror);
    if(validation.xml.length||validation.escaped||validation.missingMarkers.length||errors.length)failures.push({rel,...validation,errors});
    report.push({rel,...validation,interactions,errors});
  }
  await browser.close();
  fs.writeFileSync('/tmp/notes-verification.json',JSON.stringify({pages:report.length,failures,report},null,2));
  console.log(JSON.stringify({pages:report.length,sliders:report.reduce((s,p)=>s+p.interactions.sliders,0),buttons:report.reduce((s,p)=>s+p.interactions.buttons,0),failures},null,2));
  if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
