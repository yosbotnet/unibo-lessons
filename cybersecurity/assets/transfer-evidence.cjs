// Literature data are transcribed, not locally reproduced neural-network results.
const literature={url:'https://arxiv.org/pdf/1611.02770v3',table:3,page:8,sampleSize:100,
 models:['ResNet-152','ResNet-101','ResNet-50','VGG-16','GoogLeNet'],
 rows:[{heldOut:'ResNet-152',rmsd:30.68,matchingPercent:38},{heldOut:'ResNet-101',rmsd:30.76,matchingPercent:43},{heldOut:'ResNet-50',rmsd:30.26,matchingPercent:46},{heldOut:'VGG-16',rmsd:31.13,matchingPercent:24},{heldOut:'GoogLeNet',rmsd:29.70,matchingPercent:11}]};
const examples=[
 {id:'a',y:0,target:1,cleanA:0,cleanB:0,advA:1,advB:1},
 {id:'b',y:0,target:1,cleanA:0,cleanB:0,advA:1,advB:2},
 {id:'c',y:0,target:1,cleanA:0,cleanB:0,advA:1,advB:0},
 {id:'d',y:0,target:1,cleanA:0,cleanB:0,advA:0,advB:1},
 {id:'e',y:0,target:1,cleanA:0,cleanB:2,advA:1,advB:1}
];
function classify(row){
 if(!row||!['y','target','cleanA','cleanB','advA','advB'].every(k=>Number.isInteger(row[k])&&row[k]>=0)||row.y===row.target)throw new Error('Expected nonnegative integer labels and target different from truth');
 const eligible=row.cleanA===row.y&&row.cleanB===row.y;
 return {eligible,sourceTargeted:row.advA===row.target,targeted:row.advB===row.target,untargeted:row.advB!==row.y,outcome:row.advB===row.y?'correct':row.advB===row.target?'targeted':'other-wrong'};
}
function evaluate(rows){
 if(!Array.isArray(rows))throw new Error('Expected an array');
 const all=rows.map(classify),eligible=all.filter(r=>r.eligible),conditional=eligible.filter(r=>r.sourceTargeted);
 const rates=rs=>({n:rs.length,targeted:rs.filter(r=>r.targeted).length,untargeted:rs.filter(r=>r.untargeted).length});
 return {eligible:rates(eligible),sourceSuccessful:rates(conditional),excluded:all.length-eligible.length};
}
module.exports={literature,examples,classify,evaluate};
