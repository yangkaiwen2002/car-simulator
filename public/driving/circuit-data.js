export const CIRCUITS=[
 {id:'monza',name:'蒙扎',title:'MONZA',country:'ITALY',length:5793,turns:11,halfWidth:6,description:'长直道与重刹弯 · 速度殿堂',source:'https://github.com/bacinger/f1-circuits/blob/master/circuits/it-1922.geojson'},
 {id:'silverstone',name:'银石',title:'SILVERSTONE',country:'UNITED KINGDOM',length:5891,turns:18,halfWidth:6,description:'高速连续弯 · 节奏与控制',source:'https://github.com/bacinger/f1-circuits/blob/master/circuits/gb-1948.geojson'},
];
const mod=(n,m)=>(n%m+m)%m;
export function buildRoute(geo){
 const input=geo.features[0].geometry.coordinates,origin=input[0],rad=Math.PI/180,R=6371008.8;
 // Local tangent-plane metres; no arbitrary resizing to make a guessed course.
 const raw=input.map(([lon,lat])=>({x:(lon-origin[0])*rad*R*Math.cos(origin[1]*rad),z:-(lat-origin[1])*rad*R}));
 if(Math.hypot(raw[0].x-raw.at(-1).x,raw[0].z-raw.at(-1).z)>.01)raw.push({...raw[0]});
 const points=[];for(let i=0;i<raw.length-1;i++){const a=raw[i],b=raw[i+1],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/7));for(let j=0;j<n;j++)points.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n});}
 let length=0;const segments=points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),segment={a,b,dx,dz,len,start:length,tx:dx/len,tz:dz/len};length+=len;return segment;});
 const bounds={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
 function at(distance){const d=mod(distance,length),s=segments.find(s=>s.start+s.len>=d)||segments.at(-1),t=(d-s.start)/s.len;return {x:s.a.x+s.dx*t,z:s.a.z+s.dz*t,tx:s.tx,tz:s.tz,yaw:Math.atan2(-s.tx,-s.tz),progress:d};}
 function nearest(x,z){let result,best=Infinity;for(const s of segments){const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.len*s.len))),px=s.a.x+t*s.dx,pz=s.a.z+t*s.dz,dist=(px-x)**2+(pz-z)**2;if(dist<best){best=dist;result={distance:Math.sqrt(dist),progress:s.start+s.len*t,x:px,z:pz,tx:s.tx,tz:s.tz};}}return result;}
 return {points,segments,length,bounds,at,nearest};
}
export function formatLap(seconds){if(!Number.isFinite(seconds))return '—:—.———';const milliseconds=Math.round(seconds*1000);return `${Math.floor(milliseconds/60000)}:${String(Math.floor(milliseconds/1000)%60).padStart(2,'0')}.${String(milliseconds%1000).padStart(3,'0')}`;}
export function createLapTimer(route,halfWidth,onLap=()=>{}){
 const count=60,gap=route.length/count;
 const timer={clock:0,start:null,lap:0,time:0,valid:true,reason:'',last:null,best:null,sectors:[],nextGate:1,previous:null,offRoad:false,wrongWay:false};
 function invalidate(reason){if(timer.start!==null){timer.valid=false;timer.reason||=reason;}}
 function update(x,z,dt){
  const now=route.nearest(x,z),p=now.progress,L=route.length;timer.clock+=dt;timer.offRoad=now.distance>halfWidth+.8;
  if(timer.offRoad)invalidate('驶出赛道');
  if(timer.previous!==null){let delta=p-timer.previous;if(delta>L/2)delta-=L;if(delta<-L/2)delta+=L;timer.wrongWay=delta<-.08;
   if(Math.abs(delta)>Math.max(4,dt*110))invalidate('漏过检查点');
   const forward=delta>0&&delta<=Math.max(4,dt*110),crossed=timer.previous>L-10&&p<10&&forward&&!timer.offRoad;
   if(timer.start!==null&&forward){
    const unwrapped=crossed?p+L:p;
    while(timer.nextGate<count&&timer.nextGate*gap<=unwrapped&&timer.nextGate*gap>timer.previous){
     const gate=timer.nextGate*gap,splitTime=timer.clock-dt*(unwrapped-gate)/delta-timer.start;
     if(timer.nextGate===20||timer.nextGate===40)timer.sectors.push(splitTime-(timer.sectors.reduce((a,b)=>a+b,0)));timer.nextGate++;
    }
   }
   if(crossed){const crossingTime=timer.clock-dt*p/delta;
    if(timer.start!==null){const total=crossingTime-timer.start,valid=timer.valid&&timer.nextGate===count&&total>15;const sectors=[...timer.sectors,total-timer.sectors.reduce((a,b)=>a+b,0)];timer.last={time:total,valid,reason:timer.reason||(valid?'':'漏过检查点'),sectors};if(valid&&(!timer.best||total<timer.best.time))timer.best=timer.last;onLap(timer.last);}
    timer.start=crossingTime;timer.lap++;timer.valid=true;timer.reason='';timer.sectors=[];timer.nextGate=1;
   }
  }
  timer.time=timer.start===null?0:timer.clock-timer.start;timer.previous=p;return now;
 }
 return Object.assign(timer,{update,invalidate});
}
