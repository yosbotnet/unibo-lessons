const {assert}=require('./common.cjs');
const presets={neuron:require('./neuron.cjs'),inception:require('./inception.cjs'),autodiff:require('./autodiff.cjs'),gru:require('./gru.cjs')};
function renderPreset(spec){
  assert(spec&&typeof spec==='object'&&!Array.isArray(spec),'Preset specification must be an object');
  assert(Object.hasOwn(presets,spec.preset),'Unknown preset '+spec.preset);
  assert(typeof spec.id==='string'&&/^[a-z][a-z0-9-]*$/.test(spec.id),'id must be a lowercase SVG-safe identifier');
  if(spec.plate!==undefined)assert(/^\d+\.\d+$/.test(spec.plate),'Invalid plate number');
  if(spec.title!==undefined)assert(typeof spec.title==='string'&&spec.title.length>0&&spec.title.length<200,'Invalid title');
  return presets[spec.preset](spec).validate();
}
module.exports={renderPreset};
