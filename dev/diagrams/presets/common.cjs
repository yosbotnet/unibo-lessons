const assert=require('node:assert/strict');
const {Diagram}=require('../graph.cjs');
const circle={shape:'circle'},plain={shape:'plain'};
function keys(value,allowed,name){assert(value&&typeof value==='object'&&!Array.isArray(value),name+' must be an object');for(const k of Object.keys(value))assert(allowed.includes(k),'Unsupported '+name+'.'+k)}
function label(value,name){assert(typeof value==='string'&&value.trim()&&value.length<=48&&!/[|\n\r]/.test(value),name+' must be a nonempty single-line label (max 48 characters)');return value}
function integer(value,min,max,name){assert(Number.isInteger(value)&&value>=min&&value<=max,`${name} must be an integer in ${min}…${max}`);return value}
function measure(s){return [...s].filter(c=>!/[\p{Mark}]/u.test(c)).length*8.5}
function make(spec,height,width,title,caption){const d=new Diagram(spec.id,height,spec.title||title,width);d.plate=spec.plate;d.caption=caption;d.strokeWidth=1.5;return d}
function sub(i){return String(i).replace(/\d/g,c=>'₀₁₂₃₄₅₆₇₈₉'[c])}
function num(x){return String(Number(x.toPrecision(10))).replaceAll('-','−')}
module.exports={assert,circle,plain,keys,label,integer,measure,make,sub,num};
