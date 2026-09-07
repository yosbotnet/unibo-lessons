const {evidence}=require('./hash-chain.cjs'),e=evidence();
const original=e.scenarios[0].records,rebuilt=e.scenarios[2].records;
const label=(id,r)=>`${id}["B${r.index}${id.startsWith('R')?'′':''}<br/>H = ${r.digest.slice(0,12)}…"]`;
module.exports={id:'ds-hash-checkpoint',file:'ds/DS-C4.html',slot:null,
 title:'A coherent rewrite changes the trusted head',overrides:{rankSpacing:36,nodeSpacing:30},
 requiredText:[original.at(-1).digest.slice(0,12),rebuilt.at(-1).digest.slice(0,12)],
 caption:'One shared B0, then two alternative versions of the same three-record log. Arrows between records show append order: each successor stores its predecessor’s complete digest. The lower version edits B1 and recomputes B1′ and B2′; both versions are internally coherent. Only the original matches the separately saved head. These are not two consensus-approved forks. Labels abbreviate real SHA-256 digests to 12 hex characters for display only; checks use all 64. The tables also show the intermediate edit without recomputation.',
 source:'flowchart LR\n'+original.map(r=>label('B'+r.index,r)).join('\n')+'\n'+rebuilt.slice(1).map(r=>label('R'+r.index,r)).join('\n')+`
 B0 --> B1 --> B2
 B0 --> R1 --> R2
 B2 -->|"matches"| C["Saved original head<br/>${e.anchor.head.slice(0,12)}…"]
 R2 -->|"differs"| C
 style R1 stroke:#B83D2D
 style R2 stroke:#B83D2D`};
