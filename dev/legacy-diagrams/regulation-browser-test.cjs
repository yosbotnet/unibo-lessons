'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{createRenderer}=require('./render.cjs'),c=require('./regulation-content.cjs');
const root=path.resolve(__dirname,'../..'),out='/home/ybc/notes-legacy-review-artifacts',base='http://127.0.0.1:8787/';
async function route(page){
  await page.route(/^https?:/,r=>r.request().url().startsWith(base)?r.continue():/mermaid.*\.js/.test(r.request().url())?r.fulfill({path:path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js')}):/highlight\.min\.js/.test(r.request().url())?r.fulfill({path:root+'/dl/assets/highlight.min.js'}):r.abort());
}
async function shot(page,element,name){
  await element.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:out+'/'+name+'.png'});
}
async function tableBounds(table){
  return table.evaluate(t=>{
    const bad=[];
    for(const cell of t.querySelectorAll('th,td')){
      const box=cell.getBoundingClientRect(),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;
      while(node=walker.nextNode()){
        if(!node.textContent.trim())continue;
        const range=document.createRange();range.selectNodeContents(node);
        for(const r of range.getClientRects())if(r.width&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))bad.push(cell.textContent);
      }
    }
    return bad;
  });
}
(async()=>{
  const renderer=await createRenderer();let geometry;
  try{
    const r=await renderer.render(c.diagram);
    assert.equal(fs.readFileSync(c.asset,'utf8'),r.svg+'\n');assert.equal(r.nodes,4);assert.equal(r.edges.length,3);
    for(const pair of ['I_T','I_A','I_D'])assert(r.edges.some(e=>e.id.includes('_'+pair+'_')));
    assert(r.edges.every(e=>e.end&&!/[CQAST]/i.test(e.d)));
    assert(r.width+26<=800);
    geometry=await renderer.page.evaluate(()=>{
      const svg=document.querySelector('svg'),b=svg.getBoundingClientRect(),texts=[...svg.querySelectorAll('text')].map(e=>({text:e.textContent,b:e.getBoundingClientRect()}));
      const outside=texts.filter(({b:r})=>r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1).map(t=>t.text),overlap=[];
      for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].b,b=texts[j].b;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlap.push([texts[i].text,texts[j].text]);}
      const nodeText=[];
      for(const node of svg.querySelectorAll('.node')){const box=node.querySelector('rect').getBoundingClientRect();for(const text of node.querySelectorAll('text')){const r=text.getBoundingClientRect();if(r.left<box.left||r.right>box.right||r.top<box.top||r.bottom>box.bottom)nodeText.push(text.textContent);}}
      const missingMarkers=[...svg.querySelectorAll('[marker-end]')].filter(e=>!svg.querySelector(e.getAttribute('marker-end').match(/#([^)]*)/)[0])).length;
      return {outside,overlap,nodeText,missingMarkers,foreign:svg.querySelectorAll('foreignObject,sub,sup').length,xml:new DOMParser().parseFromString(svg.outerHTML,'image/svg+xml').querySelectorAll('parsererror').length};
    });
    assert.deepEqual(geometry,{outside:[],overlap:[],nodeText:[],missingMarkers:0,foreign:0,xml:0});
    await renderer.page.locator('svg').screenshot({path:out+'/regulation-diagram.png'});
  }finally{await renderer.close();}
  const browser=await chromium.launch(),views=[];
  try{
    for(const entry of require('./transfer-sources.cjs'))for(const js of [true,false])for(const width of [1280,390,320]){
      const page=await browser.newPage({viewport:{width,height:1000},javaScriptEnabled:js}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));await route(page);await page.goto(base+entry.file);
      const host=page.locator('#regulation-scope'),figure=host.locator('figure');
      await figure.locator('img').evaluate(e=>e.decode());
      assert(await figure.locator('img').evaluate(e=>e.naturalWidth===732&&Math.abs(e.getBoundingClientRect().width-e.naturalWidth)<1));
      await shot(page,figure,'regulation-figure-'+entry.id+'-'+width+'-'+js);
      for(const [name,rows,minimum] of [['legal-definitions',c.definitions,640],['notice-duties',c.notices,730]]){
        const table=host.locator('[data-'+name+']');
        assert.deepEqual(await table.locator('tbody tr').evaluateAll(es=>es.map(e=>[...e.querySelectorAll('th,td')].map(c=>c.textContent))),rows);
        assert.deepEqual(await tableBounds(table),[]);assert(await table.evaluate((e,min)=>e.getBoundingClientRect().width>=min,minimum));
        await shot(page,table,'regulation-'+name+'-'+entry.id+'-'+width+'-'+js);
        const region=table.locator('..');
        if(await region.evaluate(e=>e.scrollWidth>e.clientWidth+1)){
          await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);assert(await region.evaluate(e=>e.scrollLeft>0));
          await region.evaluate(e=>e.scrollLeft=e.scrollWidth);await shot(page,region,'regulation-'+name+'-right-'+entry.id+'-'+width+'-'+js);
        }
      }
      const region=figure.locator('[role=region]');
      if(width===1280)assert(await region.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      else{await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);assert(await region.evaluate(e=>e.scrollLeft>0));}
      const tabs=page.locator('#governance-implications .lk-tabs');
      assert.equal(await tabs.locator('.lk-tab').count(),3);
      if(js){for(const [i,button] of (await tabs.locator('.lk-tab').all()).entries()){
        await button.click();assert.equal(await button.getAttribute('aria-selected'),'true');assert(await tabs.locator('.lk-tabpanel').nth(i).isVisible());await shot(page,tabs,'regulation-governance-'+i+'-'+entry.id+'-'+width);
      }}else for(const panel of await tabs.locator('.lk-tabpanel').all())assert(await panel.isVisible());
      const check=host.locator('[data-regulation-check]');await check.locator('summary').click();assert(await check.locator('p').isVisible());
      for(const url of Object.values(c.sources))assert(await host.locator('a[href="'+url+'"]').count());
      assert.match(await page.locator('[data-security-conclusion]').textContent(),/not proof that every execution is a breach/);
      if(entry.file.startsWith('cybersecurity-reworked/'))assert(await page.locator('#s10 a[href="#regulation-scope"]').count());
      else assert(await page.locator('[data-reading-leads]').count());
      const fgsm=page.locator('[data-fgsm-widget]');
      if(js){await fgsm.locator('#aeAttackBtn').click();assert.match(await fgsm.locator('[role=status]').textContent(),/Prediction changed/);await fgsm.locator('#aeResetBtn').click();assert.equal(await fgsm.locator('#aeAdvClass').textContent(),'—');
        const agent=page.locator('#react-flow');await agent.locator('select').selectOption('returned-instruction');await agent.locator('[data-agent-next]').click();assert.equal(await agent.getAttribute('data-step'),'1');
      }else assert(await fgsm.locator('fieldset').evaluate(e=>e.disabled));
      assert.deepEqual(await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id).filter((id,i,ids)=>ids.indexOf(id)!==i)),[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),entry.id+' overflow '+width+' '+js);assert.deepEqual(errors,[]);
      views.push({file:entry.file,width,js});console.log('Regulation view passed',entry.id,width,js);await page.close();
    }
  }finally{await browser.close();}
  fs.writeFileSync(out+'/regulation-browser-test.json',JSON.stringify({geometry,views,nodes:4,edges:3,definitions:3,notices:5,scope:'Native diagram, exact content, mobile scrolling, tabs and adjacent widget smoke tests; not legal certification'},null,2)+'\n');
  console.log('4-node/3-edge SVG and 12 desktop/mobile JS/no-JS views passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
