// Targeted visual revisions. Still explicit layouts, NOT the automatic ELK prototype.
const {Diagram}=require('./graph.cjs');
module.exports=function refine(diagrams){
  function replace(plate,height,title,caption){const old=diagrams.findIndex(d=>d.plate===plate),d=new Diagram('dl-'+plate.replace('.','-'),height,title);d.plate=plate;d.caption=caption;diagrams[old]=d;return d}
  const circle={shape:'circle'},plain={shape:'plain'};
  let d=replace('8.5',365,'Bidirectional RNN: two recurrent chains with shared inputs and per-position concatenation','The upper chain runs left→right; the lower chain runs right→left. Each x enters both recurrent cells. Each y concatenates their states at the same position: yₜ=[h→ₜ; h←ₜ]. There are no connections between the two chains; crossings without dots are not junctions.');
  for(const [i,x] of [150,350,550].entries()){
    const idx=['t−1','t','t+1'][i];
    d.node('x'+i,x-40,315,80,30,'x('+idx+')',plain)
      .node('f'+i,x-26,99,52,52,'h→',circle)
      .node('b'+i,x-26,199,52,52,'h←',{...circle,color:'vermilion'})
      .node('o'+i,x-55,20,110,35,'y('+idx+')',plain);
    d.edge('x'+i+'.W','f'+i+'.S',[[x-70,330],[x-70,175],[x,175]])
      .edge('x'+i+'.N','b'+i+'.S',[],'vermilion')
      .edge('f'+i+'.N','o'+i+'.S')
      .edge('b'+i+'.N','o'+i+'.E',[[x,185],[x+70,185],[x+70,37.5]],'vermilion');
    if(i)d.edge('f'+(i-1)+'.E','f'+i+'.W').edge('b'+i+'.W','b'+(i-1)+'.E',[],'vermilion');
  }
  return diagrams;
};
