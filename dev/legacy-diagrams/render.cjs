// Build-time Mermaid adapter. Keep Mermaid's node/edge semantics and arrowheads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.MERMAID_FIXTURE||path.join(path.dirname(require.resolve('mermaid')),'mermaid.min.js');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const palette={paper:'#F3EFE3',panel:'#FAF7EF',ink:'#171813',cobalt:'#1546B8',accent:'#B83D2D',rule:'#C9C3B6',mono:"'IBM Plex Mono',ui-monospace,SFMono-Regular,Consolas,monospace"};
async function createRenderer(){
  assert.equal(JSON.parse(fs.readFileSync(path.resolve(fixture,'../../package.json'))).version,'11.17.2','Use the reviewed Mermaid version');
  const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1200}});
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({path:fixture});
  return {close:()=>browser.close(),page,async render(spec){
    assert(/^[a-z][a-z0-9-]+$/.test(spec.id),'SVG-safe id required');
    assert(/^(flowchart|graph)\s+(LR|RL|TD|TB|BT)\b/.test(spec.source.trim()),'Only flowcharts supported by this adapter');
    assert(!/%%\{|^---|\bclick\s/m.test(spec.source),'No embedded configuration or interaction');
    for(const k of Object.keys(spec.overrides||{}))assert(['direction','nodeSpacing','rankSpacing'].includes(k),'Unknown override '+k);
    for(const k of ['nodeSpacing','rankSpacing'])if(spec.overrides?.[k]!==undefined)assert(Number.isFinite(spec.overrides[k])&&spec.overrides[k]>=20&&spec.overrides[k]<=300,'Invalid '+k);
    if(spec.overrides?.direction)assert(['LR','RL','TD','TB','BT'].includes(spec.overrides.direction),'Invalid direction');
    return page.evaluate(async({spec,p})=>{
      let source=spec.source;const o=spec.overrides||{};
      if(o.direction)source=source.replace(/^(flowchart|graph)\s+\w+/,`$1 ${o.direction}`);
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',htmlLabels:false,deterministicIds:true,deterministicIDSeed:spec.id,
        flowchart:{curve:'linear',useMaxWidth:false,padding:16,nodeSpacing:o.nodeSpacing||40,rankSpacing:o.rankSpacing||64},
        themeVariables:{fontFamily:p.mono,fontSize:'14px',background:p.paper,primaryColor:p.panel,primaryTextColor:p.ink,primaryBorderColor:p.cobalt,lineColor:p.cobalt,secondaryColor:p.panel,tertiaryColor:p.paper,clusterBkg:p.paper,clusterBorder:p.rule,edgeLabelBackground:p.paper},
        themeCSS:'.node rect,.node circle,.node polygon,.node path,.flowchart-link{stroke-width:1.5px}.edgeLabel rect{opacity:1}.cluster rect{stroke-width:1px}'
      });
      document.body.replaceChildren();
      const {svg}=await mermaid.render(spec.id,source);
      document.body.innerHTML=svg;
      const root=document.querySelector('svg');
      if(root.querySelector('foreignObject,.error-icon,.error-text'))throw Error('Invalid or non-native SVG');
      const vb=root.viewBox.baseVal;
      root.setAttribute('width',Math.ceil(vb.width));root.setAttribute('height',Math.ceil(vb.height));
      root.setAttribute('style',`background:${p.paper};font-family:${p.mono};font-size:14px`);
      root.setAttribute('role','img');root.setAttribute('aria-label',spec.title);
      const title=document.createElementNS(root.namespaceURI,'title');title.textContent=spec.title;root.prepend(title);
      // Preserve all Mermaid edge types, including undirected and bidirectional.
      const edges=[...root.querySelectorAll('.flowchart-link')].map(e=>({id:e.id,d:e.getAttribute('d'),start:e.getAttribute('marker-start'),end:e.getAttribute('marker-end')}));
      if(edges.some(e=>/[CQAST]/i.test(e.d)))throw Error('Unexpected curved flowchart route');
      const text=[...root.querySelectorAll('text')].map(e=>e.textContent);
      return {svg:root.outerHTML,width:Math.ceil(vb.width),height:Math.ceil(vb.height),nodes:root.querySelectorAll('.node').length,edges,text};
    },{spec,p:palette});
  }};
}
module.exports={createRenderer,palette};
