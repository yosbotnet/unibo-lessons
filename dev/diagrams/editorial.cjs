// Course content is semantic JSON; reusable presets own placement and routing.
const {renderPreset}=require('./presets/index.cjs');
const specifications=require('./sources/editorial.json');
module.exports=function editorial(diagrams){
  for(const spec of specifications){const index=diagrams.findIndex(d=>d.plate===spec.plate);if(index<0)diagrams.push(renderPreset(spec));else diagrams[index]=renderPreset(spec)}
  return diagrams.sort((a,b)=>{const [ac,af]=a.plate.split('.').map(Number),[bc,bf]=b.plate.split('.').map(Number);return ac-bc||af-bf});
};
