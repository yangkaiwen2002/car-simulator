// City stunts: speed traps, average-speed zones and drift zones.
// Pure logic; stunt-gates.js draws them. Coordinates are city metres (x east, z south).
export const ROAD_HALF=10.4;
// A gate is a line across the road: centre, unit direction along the road, half width.
const gate=(x,z,dx,dz)=>({x,z,dx,dz,half:ROAD_HALF});
export const STUNTS=[
 {id:'trap-boulevard',kind:'trap',name:'滨海大道测速',unit:'km/h',targets:[110,160,215],gates:[gate(0,-120,0,-1)]},
 {id:'trap-harbor',kind:'trap',name:'港湾环路测速',unit:'km/h',targets:[120,170,225],gates:[gate(240,40,0,-1)]},
 {id:'trap-central',kind:'trap',name:'中央街测速',unit:'km/h',targets:[100,150,200],gates:[gate(-120,-80,1,0)]},
 {id:'zone-north',kind:'zone',name:'北城大道区间测速',unit:'km/h',targets:[90,135,180],path:[[-200,-240],[200,-240]]},
 {id:'zone-west',kind:'zone',name:'西区长街区间测速',unit:'km/h',targets:[90,135,180],path:[[-160,200],[-160,-200]]},
 {id:'drift-park',kind:'drift',name:'公园弯道漂移区',unit:'分',targets:[500,1300,2400],path:[[-160,-30],[-160,-160],[-80,-160],[-80,-90]]},
 {id:'drift-harbor',kind:'drift',name:'港湾回头弯漂移区',unit:'分',targets:[500,1300,2400],path:[[150,160],[240,160],[240,80],[150,80]]},
];
for(const stunt of STUNTS)if(stunt.path){
 const p=stunt.path,unit=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);return [dx/l,dz/l];};
 const [sx,sz]=unit(p[0],p[1]),[ex,ez]=unit(p.at(-2),p.at(-1));
 stunt.gates=[gate(p[0][0],p[0][1],sx,sz),gate(p.at(-1)[0],p.at(-1)[1],ex,ez)];
 stunt.length=p.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b[0]-p[i][0],b[1]-p[i][1]),0);
}
export const MAX_STARS=STUNTS.length*3;
export function starsFor(stunt,value){return stunt.targets.filter(target=>value>=target).length;}
// Signed crossing of a gate between two positions: +1 along its direction, -1 against, 0 none.
export function crossing(g,ax,az,bx,bz){
 const da=(ax-g.x)*g.dx+(az-g.z)*g.dz,db=(bx-g.x)*g.dx+(bz-g.z)*g.dz;
 if((da<0)===(db<0)||da===db)return 0;
 const t=da/(da-db),px=ax+(bx-ax)*t,pz=az+(bz-az)*t,side=(px-g.x)*-g.dz+(pz-g.z)*g.dx;
 return Math.abs(side)<=g.half?(db>da?1:-1):0;
}
export function distanceToPath(path,x,z){
 let best=Infinity;
 for(let i=1;i<path.length;i++){const [ax,az]=path[i-1],[bx,bz]=path[i],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(ax+dx*t-x,az+dz*t-z));}
 return best;
}
export function createStuntTracker(onEvent=()=>{},stunts=STUNTS){
 let previous=null,run=null;
 function finish(value){const stunt=run.stunt;run=null;onEvent('result',{stunt,value,stars:starsFor(stunt,value)});}
 // t: {x,z,speed m/s,slip rad}
 function update(dt,t){
  if(previous&&dt>0){
   const moved=Math.hypot(t.x-previous.x,t.z-previous.z);
   if(moved>12){run=null;}// teleport (reset / rewind)
   else{
    if(run){
     run.time+=dt;run.distance+=moved;
     if(run.stunt.kind==='drift'&&Math.abs(t.speed)>8&&Math.abs(t.slip)>.2)run.score+=Math.abs(t.speed)*Math.min(Math.abs(t.slip),.9)*11*dt;
     const exit=run.stunt.gates[run.exit],sign=crossing(exit,previous.x,previous.z,t.x,t.z);
     if(sign===(run.exit?1:-1))finish(run.stunt.kind==='zone'?run.stunt.length/run.time*3.6:run.score);
     else if(distanceToPath(run.stunt.path,t.x,t.z)>26||run.time>90){onEvent('abandon',{stunt:run.stunt});run=null;}
    }
    if(!run)for(const stunt of stunts){
     if(stunt.kind==='trap'){if(crossing(stunt.gates[0],previous.x,previous.z,t.x,t.z)){const value=Math.abs(t.speed)*3.6;onEvent('result',{stunt,value,stars:starsFor(stunt,value)});}continue;}
     // Zones run in either direction: enter through one gate, leave by the other.
     for(const entry of [0,1]){const sign=crossing(stunt.gates[entry],previous.x,previous.z,t.x,t.z);if(sign===(entry?-1:1)){run={stunt,exit:1-entry,time:0,distance:0,score:0};onEvent('start',{stunt});break;}}
     if(run)break;
    }
   }
  }
  previous={x:t.x,z:t.z};
 }
 return {
  update,
  reset(){previous=null;run=null;},
  get run(){return run?{stunt:run.stunt,time:run.time,value:run.stunt.kind==='zone'?(run.time>.5?run.distance/run.time*3.6:0):run.score}:null;},
  // Closest stunt entry within range, for the approach card.
  nearest(x,z,range=170){let best=null;for(const stunt of stunts)for(const g of stunt.gates){const d=Math.hypot(g.x-x,g.z-z);if(d<range&&(!best||d<best.distance))best={stunt,distance:d};}return best;},
 };
}
