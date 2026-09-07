// A quantitative plate: point coordinates derive from the exact discrete domain.
const space=require('../../dm/assets/search-space.js');
const fs=require('node:fs'),path=require('node:path');
const x=d=>100+(d-1)*56,y=e=>458-(e-2)*22;
const text=(x,y,s,anchor='middle',color='ink')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="14" fill="var(--lk-${color})">${s}</text>`;
const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 535" style="width:700px" role="img" aria-label="Random-forest search space: ten depths and nineteen tree counts, 190 configurations; ten highlighted illustrative good configurations" data-generated-plot="dm-10-2" font-family="var(--lk-mono)">`,
 '<title>190 configurations: max_depth 1–10 × n_estimators 2–20</title>',
 text(350,22,'RANDOM FOREST · 10 × 19 = 190','middle','cobalt'),
 `<rect x="${x(8)-15}" y="${y(20)-12}" width="30" height="${y(11)-y(20)+24}" fill="var(--lk-paper-light)" stroke="var(--lk-vermilion)" stroke-width="1.5"/>`,
 '<path d="M78 48V480H630" fill="none" stroke="var(--lk-rule)" stroke-width="1.2"/>'];
for(const d of space.depths)svg.push(text(x(d),501,d));
for(const e of space.estimators)svg.push(text(65,y(e)+5,e,'end'));
for(const p of space.points)svg.push(`<circle data-depth="${p.depth}" data-trees="${p.trees}" data-good="${p.good}" cx="${x(p.depth)}" cy="${y(p.trees)}" r="3" fill="var(--lk-${p.good?'vermilion':'cobalt'})"/>`);
svg.push(text(350,526,'max_depth →'),'<text x="22" y="260" transform="rotate(-90 22 260)" text-anchor="middle" font-size="14" fill="var(--lk-ink)">n_estimators →</text>','</svg>');
const rendered=svg.join('\n');
if(require.main===module){const file=path.resolve(__dirname,'../../dm/cap-10-hyperparameter-optimization.html'),source=fs.readFileSync(file,'utf8');let found=0;const next=source.replace(/<figure\b[\s\S]*?<\/figure>/g,f=>{if(!f.includes('<b>Plate 10.2</b>'))return f;found++;return f.replace(/<svg\b[\s\S]*?<\/svg>/,rendered).replace(/<figcaption>[\s\S]*?<\/figcaption>/,'<figcaption><b>Plate 10.2</b> — Every dot is one of the 190 distinct configurations. Columns encode max_depth (1–10); rows encode n_estimators (2–20), increasing upwards. The vermilion band marks ten illustrative good configurations: 10/190 ≈ 5.3%, a discrete approximation to the deck’s 5% example, not measured model performance. The widget below uses exactly the same domain and highlighted points.</figcaption>')});if(found!==1)throw Error('Missing unique plate 10.2');
 if(process.argv.includes('--patch')){const a=source.split('\n'),b=next.split('\n');let i=0,j=0;while(i<a.length&&a[i]===b[i])i++;while(j<a.length-i&&a[a.length-1-j]===b[b.length-1-j])j++;if(source===next)process.stdout.write('*** Begin Patch\n*** End Patch\n');else process.stdout.write('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+[...a.slice(Math.max(0,i-2),i).map(l=>' '+l),...a.slice(i,a.length-j).map(l=>'-'+l),...b.slice(i,b.length-j).map(l=>'+'+l),...a.slice(a.length-j,a.length-j+2).map(l=>' '+l)].join('\n')+'\n*** End Patch\n');}
 else{console.log(`${space.total} points, ${space.goodCount} highlighted; chapter ${source===next?'matches':'DIFFERS'}.`);if(source!==next)process.exitCode=1}
}
module.exports={svg:rendered,space};
