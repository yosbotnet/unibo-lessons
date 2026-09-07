// Usage: node dev/diagrams/render-preset.cjs spec.json [--out diagram.svg] [--inline]
// Rendering is local and deterministic; this command never patches chapters.
const fs=require('node:fs'),path=require('node:path');
const {renderPreset}=require('./presets/index.cjs');
try{
 const args=process.argv.slice(2),file=args.shift();if(!file)throw Error('Usage: render-preset.cjs spec.json [--out diagram.svg] [--inline]');
 let output,inline=false;while(args.length){const flag=args.shift();if(flag==='--out'){output=args.shift();if(!output||!output.endsWith('.svg'))throw Error('--out must name an SVG file')}else if(flag==='--inline')inline=true;else throw Error('Unknown option '+flag)}
 const d=renderPreset(JSON.parse(fs.readFileSync(file,'utf8')));let svg=d.svg();
 if(!inline){
  const css=fs.readFileSync(path.resolve(__dirname,'../../dl/assets/lesson-kit.css'),'utf8');
  const tokens=css.match(/:root\s*\{([\s\S]*?)\}/)[1];
  // Standalone files use the SAME site tokens, without needing an enclosing page.
  svg=svg.replace('<defs>',`<style>svg[data-generated-diagram="${d.id}"]{${tokens};background:var(--lk-paper)}</style><defs>`);
 }
 if(output)fs.writeFileSync(output,svg);else process.stdout.write(svg+'\n');
}catch(e){console.error(e.message);process.exitCode=1}
