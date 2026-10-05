export const CIRCUITS=[
 {id:'nordschleife',name:'纽博格林北环',title:'NORDSCHLEIFE',country:'GERMANY',length:20832,turns:73,halfWidth:4.5,description:'绿色地狱 · 森林与起伏',source:'https://github.com/chendo/opentrackdata'},
 {id:'monza',name:'蒙扎',title:'MONZA',country:'ITALY',length:5793,turns:11,halfWidth:6,description:'长直道与重刹弯 · 速度殿堂',source:'https://github.com/bacinger/f1-circuits/blob/master/circuits/it-1922.geojson'},
 {id:'silverstone',name:'银石',title:'SILVERSTONE',country:'UNITED KINGDOM',length:5891,turns:18,halfWidth:6,description:'高速连续弯 · 节奏与控制',source:'https://github.com/bacinger/f1-circuits/blob/master/circuits/gb-1948.geojson'},
];
const mod=(n,m)=>(n%m+m)%m;
export function buildRoute(geo){
 const input=geo.features[0].geometry.coordinates.filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]),origin=input[0],rad=Math.PI/180,R=6371008.8;
 // Local tangent-plane metres; no arbitrary resizing to make a guessed course.
 const raw=input.map(([lon,lat,alt])=>({y:Number.isFinite(alt)?alt-(origin[2]||0):0,x:(lon-origin[0])*rad*R*Math.cos(origin[1]*rad),z:-(lat-origin[1])*rad*R}));
 if(Math.hypot(raw[0].x-raw.at(-1).x,raw[0].z-raw.at(-1).z)>.01)raw.push({...raw[0]});
 const points=[];for(let i=0;i<raw.length-1;i++){const a=raw[i],b=raw[i+1],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/7));for(let j=0;j<n;j++)points.push({y:a.y+(b.y-a.y)*j/n,x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n});}
 // Smooth the terrain profile over physical distance, not point count: OSM
 // vertices are irregularly spaced and index smoothing creates steep short edges.
 const stations=[0];for(let i=1;i<=points.length;i++){const a=points[i-1],b=points[i%points.length];stations.push(stations.at(-1)+Math.hypot(b.x-a.x,b.z-a.z));}
 const perimeter=stations.at(-1);
 function elevationAt(distance){const d=mod(distance,perimeter);let lo=0,hi=points.length;while(lo+1<hi){const m=(lo+hi)>>1;if(stations[m]<=d)lo=m;else hi=m;}const a=points[lo],b=points[(lo+1)%points.length],t=(d-stations[lo])/(stations[lo+1]-stations[lo]);return a.y+(b.y-a.y)*t;}
 const heights=points.map((p,i)=>{let sum=0,weight=0;for(let k=-8;k<=8;k++){const w=9-Math.abs(k);sum+=elevationAt(stations[i]+k*5)*w;weight+=w;}return sum/weight;});points.forEach((p,i)=>p.y=heights[i]);
 let length=0;const segments=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),segment={a,b,dx,dz,len,start:length,tx:dx/len,tz:dz/len,grade:(b.y-a.y)/len};length+=len;return segment;});
 const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
 function at(distance){const d=mod(distance,length),s=segments.find(s=>s.start+s.len>=d)||segments.at(-1),t=(d-s.start)/s.len;return {y:s.a.y+(s.b.y-s.a.y)*t,grade:s.grade,x:s.a.x+s.dx*t,z:s.a.z+s.dz*t,tx:s.tx,tz:s.tz,yaw:Math.atan2(-s.tx,-s.tz),progress:d};}
 const grid=new Map(),cell=90;for(const s of segments){const key=Math.floor(s.a.x/cell)+','+Math.floor(s.a.z/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(s);}
 function nearest(x,z){let result,best=Infinity;const cx=Math.floor(x/cell),cz=Math.floor(z/cell),near=[];for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)near.push(...(grid.get((cx+i)+','+(cz+j))||[]));
 for(const s of near.length?near:segments){const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.len*s.len))),px=s.a.x+t*s.dx,pz=s.a.z+t*s.dz,dist=(px-x)**2+(pz-z)**2;if(dist<best){best=dist;result={distance:Math.sqrt(dist),progress:s.start+s.len*t,x:px,z:pz,y:s.a.y+(s.b.y-s.a.y)*t,grade:s.grade,tx:s.tx,tz:s.tz};}}return result;}
 return {points,segments,length,bounds,at,nearest};
}
export function formatLap(seconds){if(!Number.isFinite(seconds))return '—:—.———';const milliseconds=Math.round(seconds*1000);return `${Math.floor(milliseconds/60000)}:${String(Math.floor(milliseconds/1000)%60).padStart(2,'0')}.${String(milliseconds%1000).padStart(3,'0')}`;}
export function createLapTimer(route,halfWidth,onLap=()=>{}){
 const count=60,gap=route.length/count;
 const timer={clock:0,start:null,lap:0,time:0,valid:true,reason:'',last:null,best:null,sectors:[],sectorBests:[null,null,null],reference:null,trace:[0],delta:null,nextGate:1,previous:null,previousPoint:null,offRoad:false,offTrackTime:0,trackWarning:false,wrongWay:false,progress:0};
 function invalidate(reason){if(timer.start!==null){timer.valid=false;timer.reason||=reason;timer.delta=null;}}
 function update(x,z,dt){
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(x)||!Number.isFinite(z))return null;
  const now=route.nearest(x,z),p=now.progress,L=route.length;timer.clock+=dt;timer.progress=p;timer.offRoad=now.distance>halfWidth+.8;
  timer.offTrackTime=timer.offRoad?timer.offTrackTime+dt:0;
  timer.trackWarning=timer.offRoad&&timer.start!==null;
  // Brief excursions are recoverable; deep cuts or staying outside delete the lap.
  if(now.distance>halfWidth+6||timer.offTrackTime>.8)invalidate('驶出赛道过远或过久');
  if(timer.previous!==null&&dt>0){let delta=p-timer.previous;if(delta>L/2)delta-=L;if(delta<-L/2)delta+=L;timer.wrongWay=delta<-.08;
   const jumped=Math.abs(delta)>Math.max(4,dt*110)||Math.hypot(x-timer.previousPoint.x,z-timer.previousPoint.z)>Math.max(4,dt*110);
   if(jumped)invalidate('漏过检查点');
   if(timer.wrongWay)invalidate('逆向行驶');
   const forward=delta>0&&!jumped,crossed=timer.previous>L-10&&p<10&&forward&&!timer.offRoad;
   if(timer.start!==null&&forward){
    const unwrapped=crossed?p+L:p;
    while(timer.nextGate<count&&timer.nextGate*gap<=unwrapped&&timer.nextGate*gap>timer.previous){
     const gate=timer.nextGate*gap,splitTime=timer.clock-dt*(unwrapped-gate)/delta-timer.start;
     timer.trace[timer.nextGate]=splitTime;
     if(timer.nextGate===20||timer.nextGate===40)timer.sectors.push(splitTime-timer.sectors.reduce((a,b)=>a+b,0));timer.nextGate++;
    }
   }
   if(crossed){const crossingTime=timer.clock-dt*p/delta;
    if(timer.start!==null){const total=crossingTime-timer.start,valid=timer.valid&&timer.nextGate===count&&timer.sectors.length===2&&total>15;
     const sectors=[...timer.sectors,total-timer.sectors.reduce((a,b)=>a+b,0)];
     timer.last={time:total,valid,reason:timer.reason||(valid?'':'漏过检查点'),sectors,trace:[...timer.trace,total],reference:timer.reference,priorSectorBests:[...timer.sectorBests]};
     if(valid){timer.sectorBests=sectors.map((value,i)=>Math.min(value,timer.sectorBests[i]??Infinity));if(!timer.best||total<timer.best.time)timer.best={time:total,sectors:[...sectors],trace:[...timer.trace,total]};}
     onLap(timer.last);
    }
    timer.start=crossingTime;timer.lap++;timer.valid=true;timer.reason='';timer.sectors=[];timer.nextGate=1;timer.trace=[0];timer.reference=timer.best?{time:timer.best.time,sectors:[...timer.best.sectors],trace:timer.best.trace?.slice()}:null;
   }
  }
  timer.time=timer.start===null?0:timer.clock-timer.start;
  const ref=timer.reference?.trace,index=Math.min(59,Math.floor(p/gap));
  timer.delta=timer.start!==null&&timer.valid&&ref?.length===61&&Number.isFinite(ref[index])&&Number.isFinite(ref[index+1])?timer.time-(ref[index]+(ref[index+1]-ref[index])*(p/gap-index)):null;
  timer.previous=p;timer.previousPoint={x,z};return now;
 }
 return Object.assign(timer,{update,invalidate});
}

// Purple refers to this local player's best sector, not an online world record.
export function sectorStatus(value,index,reference,bests,valid=true){
 if(!valid)return 'invalid';if(!Number.isFinite(value))return 'pending';
 if(!Number.isFinite(bests?.[index]))return 'baseline';
 if(value<bests[index]-.0005)return 'purple';
 if(Number.isFinite(reference?.sectors?.[index])&&value<reference.sectors[index]-.0005)return 'green';
 return 'yellow';
}
export function timingView(timer){
 const hold=timer.last&&timer.time<6,record=hold?timer.last:null;
 const sectors=record?.sectors||timer.sectors,reference=record?.reference||timer.reference,valid=record?record.valid:timer.valid;
 const bests=record?.priorSectorBests||timer.sectorBests;
 return {hold,valid,sectors:[0,1,2].map(i=>({value:sectors[i],status:sectorStatus(sectors[i],i,reference,bests,valid),delta:Number.isFinite(sectors[i])&&Number.isFinite(reference?.sectors?.[i])?sectors[i]-reference.sectors[i]:null})),active:Math.min(2,timer.sectors.length),delta:timer.delta};
}
