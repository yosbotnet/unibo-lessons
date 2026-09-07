// Embed the unmodified official font. SVG <img> cannot fetch external web fonts.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.dirname(require.resolve('@ibm/plex-mono/package.json'));
const bytes=fs.readFileSync(path.join(base,'fonts/complete/woff2/IBMPlexMono-Regular.woff2'));
const license=fs.readFileSync(path.join(base,'LICENSE.txt'),'utf8').replaceAll('\r\n','\n').replace(/[ \t]+$/gm,'');
const css=`@font-face{font-family:'IBM Plex Mono';src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');font-style:normal;font-weight:400;font-display:block}`;
module.exports={css,license,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
