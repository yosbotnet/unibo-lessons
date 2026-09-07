const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const out = path.resolve(process.argv[3] || '/tmp/notes-figure-audit');
const courses = 'dl irs asmd asw bi bigdata dm ise netprog oa pm reti-lm sap spe visione'.split(' ');
const selected = process.env.ONLY_PAGES?.split(',');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = selected && fs.existsSync(path.join(out,'audit.json')) ? JSON.parse(fs.readFileSync(path.join(out,'audit.json'))).filter(p=>!selected.includes(p.course+'/'+p.file)) : [];
  for (const width of (process.env.DESKTOP_ONLY ? [1280] : [1280, 390])) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route(/^https?:/, route => /highlight\.min\.js$/.test(route.request().url())
      ? route.fulfill({path:path.join(root,'dl/assets/highlight.min.js'),contentType:'application/javascript'})
      : route.abort());
    for (const course of courses) {
      for (const file of fs.readdirSync(path.join(root, course)).filter(f => /^cap-.*\.html$/.test(f)).sort()) {
        if (selected && !selected.includes(course+'/'+file)) continue;
        const errors = [];
        const onerror = e => errors.push(e.message);
        page.on('pageerror', onerror);
        try { await page.goto('file://' + path.join(root, course, file)); }
        catch (e) { if (!String(e).includes('ERR_ABORTED')) throw e; await page.goto('file://' + path.join(root, course, file)); }
        const data = await page.evaluate(() => {
          const figures = [...document.querySelectorAll('figure')].map((fig, index) => {
            const svg = fig.querySelector('svg');
            const outside = [], overlaps = [];
            if (svg) {
              const vb = svg.getBoundingClientRect();
              const texts = [...svg.querySelectorAll('text')].map(t => ({ t: t.textContent, b: t.getBoundingClientRect() }));
              for (const {t,b} of texts) if (b.x < vb.x-1 || b.y < vb.y-1 || b.x+b.width > vb.x+vb.width+1 || b.y+b.height > vb.y+vb.height+1) outside.push(t);
              for (let i=0;i<texts.length;i++) for (let j=i+1;j<texts.length;j++) {
                const a=texts[i], b=texts[j];
                if (Math.min(a.b.x+a.b.width,b.b.x+b.b.width)-Math.max(a.b.x,b.b.x)>2 && Math.min(a.b.y+a.b.height,b.b.y+b.b.height)-Math.max(a.b.y,b.b.y)>2) overlaps.push([a.t,b.t]);
              }
            }
            const escaped = [...fig.querySelectorAll('text,path,rect,circle,line,polyline,polygon,g')].filter(e=>e.namespaceURI !== 'http://www.w3.org/2000/svg').length;
            return {index, caption: fig.querySelector('figcaption')?.textContent.trim(), outside, overlaps, escaped};
          });
          return { figures, overflow: document.documentElement.scrollWidth > innerWidth+1, widgets: document.querySelectorAll('.lk-tabs,.lk-stepper,.lk-state-explorer,[role="tablist"]').length };
        });
        for (const fig of data.figures) {
          const id = `${course}-${file.replace('.html','')}-${fig.index}-${width}`;
          fig.image = id+'.png';
          if (!process.env.METRICS_ONLY) await page.locator('figure').nth(fig.index).screenshot({path:path.join(out,fig.image)});
        }
        results.push({course,file,width,...data,errors});
        page.off('pageerror',onerror);
      }
      console.log(width, course, results.filter(x=>x.width===width&&x.course===course).length);
      fs.writeFileSync(path.join(out,'audit.json'), JSON.stringify(results,null,2));
    }
    await page.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
