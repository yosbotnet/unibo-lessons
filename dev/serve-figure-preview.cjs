// Isolated read-only preview. No Caddy changes; production files are never served here.
const http=require('http'), fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.FIGURE_ARTIFACTS||path.resolve(root,'../notes-figure-review-artifacts');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
  let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return;}
  if(!['GET','HEAD'].includes(req.method)||url.split('/').some(s=>s.startsWith('.'))){res.writeHead(403).end();return;}
  let base=root,rel=url;
  if(url.startsWith('/review/screenshots/')){base=artifacts;rel=url.slice('/review/screenshots'.length);}
  let file=path.resolve(base,'.'+rel);
  if(!file.startsWith(base+'/')){if(file===base)file+='/review/index.html';else{res.writeHead(403).end();return;}}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file+='/index.html';
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);});
}).listen(Number(process.env.PORT||8787),process.env.BIND||'127.0.0.1',()=>console.log('Figure preview http://127.0.0.1:'+(process.env.PORT||8787)+'/review/'));
