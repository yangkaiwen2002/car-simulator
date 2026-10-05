// Planar rigid-body contacts. Coordinates match Three.js: positive yaw turns left.
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const cross=(r,v)=>r.z*v.x-r.x*v.z;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createBody(options){
 const b={x:0,z:0,yaw:0,vx:0,vz:0,yawRate:0,hx:1,hz:2,mass:0,restitution:.1,friction:.55,kind:'障碍物',...options};
 b.invMass=b.mass>0?1/b.mass:0;b.invInertia=b.mass>0?3/(b.mass*(b.hx*b.hx+b.hz*b.hz)):0;return b;
}
function axes(b){const c=Math.cos(b.yaw),s=Math.sin(b.yaw);return [{x:c,z:-s},{x:s,z:c}];}
function corners(b){const [u,v]=axes(b);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>({x:b.x+i*u.x*b.hx+j*v.x*b.hz,z:b.z+i*u.z*b.hx+j*v.z*b.hz}));}
function bounds(b){const [u,v]=axes(b),x=Math.abs(u.x)*b.hx+Math.abs(v.x)*b.hz,z=Math.abs(u.z)*b.hx+Math.abs(v.z)*b.hz;return {minX:b.x-x,maxX:b.x+x,minZ:b.z-z,maxZ:b.z+z};}
function clip(poly,axis,limit){
 const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dot(a,axis)-limit,db=dot(b,axis)-limit;if(da<=1e-8)result.push(a);if((da<0)!==(db<0)){const t=da/(da-db);result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}return result;
}
export function contact(a,b){
 const aa=axes(a),bb=axes(b),delta={x:a.x-b.x,z:a.z-b.z};let depth=Infinity,normal;
 for(const n of [...aa,...bb]){const ar=a.hx*Math.abs(dot(n,aa[0]))+a.hz*Math.abs(dot(n,aa[1])),br=b.hx*Math.abs(dot(n,bb[0]))+b.hz*Math.abs(dot(n,bb[1])),distance=dot(delta,n),overlap=ar+br-Math.abs(distance);if(overlap<=0)return null;if(overlap<depth){depth=overlap;const sign=distance<0?-1:1;normal={x:n.x*sign,z:n.z*sign};}}
 let poly=corners(a);for(let i=0;i<2;i++)for(const sign of [-1,1]){const n={x:bb[i].x*sign,z:bb[i].z*sign};poly=clip(poly,n,dot(b,n)+(i?b.hz:b.hx));if(!poly.length)break;}
 if(!poly.length)return null;
 const tangent={x:-normal.z,z:normal.x};let lo=Infinity,hi=-Infinity,plane=0;for(const p of poly){const t=dot(p,tangent);lo=Math.min(lo,t);hi=Math.max(hi,t);plane+=dot(p,normal);}plane/=poly.length;
 const ts=hi-lo>.08?[lo,hi]:[(lo+hi)/2];return {a,b,depth,normal,points:ts.map(t=>({x:normal.x*plane+tangent.x*t,z:normal.z*plane+tangent.z*t}))};
}
function velocityAt(b,p){return {x:b.vx+b.yawRate*(p.z-b.z),z:b.vz-b.yawRate*(p.x-b.x)};}
function impulse(b,p,n,j){if(!b.invMass)return;b.vx+=n.x*j*b.invMass;b.vz+=n.z*j*b.invMass;b.yawRate+=cross({x:p.x-b.x,z:p.z-b.z},n)*j*b.invInertia;}
function relative(a,b,p){const av=velocityAt(a,p),bv=velocityAt(b,p);return {x:av.x-bv.x,z:av.z-bv.z};}
function effectiveMass(a,b,p,n){const ra=cross({x:p.x-a.x,z:p.z-a.z},n),rb=cross({x:p.x-b.x,z:p.z-b.z},n);return a.invMass+b.invMass+ra*ra*a.invInertia+rb*rb*b.invInertia;}
function kinetic(b){return b.mass*(b.vx*b.vx+b.vz*b.vz)/2+(b.invInertia?b.yawRate*b.yawRate/(2*b.invInertia):0);}
export function createCollisionWorld(initial=[]){
 const statics=[],dynamic=[],grid=new Map(),cellSize=16;
 function cells(b){const r=bounds(b),keys=[];for(let x=Math.floor(r.minX/cellSize);x<=Math.floor(r.maxX/cellSize);x++)for(let z=Math.floor(r.minZ/cellSize);z<=Math.floor(r.maxZ/cellSize);z++)keys.push(`${x},${z}`);return keys;}
 function addStatic(options){const b=createBody({...options,mass:0});statics.push(b);for(const key of cells(b)){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}return b;}
 function addDynamic(options){const b=createBody(options);dynamic.push(b);return b;}
 initial.forEach(addStatic);
 function nearby(b){const set=new Set();for(const key of cells(b))for(const o of grid.get(key)||[])set.add(o);return set;}
 function advance(active,dt){
  const bodies=[active,...dynamic];let impact=null;
  // Bound movement to 10 cm including rotating corners: thin poles cannot be skipped.
  const travel=Math.max(...bodies.map(b=>(Math.hypot(b.vx,b.vz)+Math.abs(b.yawRate)*Math.hypot(b.hx,b.hz))*dt));
  const steps=Math.max(1,Math.ceil(travel/.1)),h=dt/steps;
  for(let sub=0;sub<steps;sub++){
   for(const b of bodies){b.x+=b.vx*h;b.z+=b.vz*h;b.yaw+=b.yawRate*h;}
   const contacts=[];
   for(let i=0;i<bodies.length;i++){
    const a=bodies[i];for(const b of [...nearby(a),...bodies.slice(i+1)]){const hit=contact(a,b);if(hit)contacts.push(hit);}
   }
   const constraints=[];let activeContact=null;
   for(const hit of contacts){const {a,b,normal:n}=hit,inv=a.invMass+b.invMass;if(!inv)continue;
    const correction=Math.max(hit.depth-.001,0)*.9/inv;a.x+=n.x*correction*a.invMass;a.z+=n.z*correction*a.invMass;b.x-=n.x*correction*b.invMass;b.z-=n.z*correction*b.invMass;
    for(const p of hit.points){const closing=-dot(relative(a,b,p),n);constraints.push({a,b,p,n,t:{x:-n.z,z:n.x},normalImpulse:0,tangentImpulse:0,target:closing>1.2?Math.min(a.restitution,b.restitution)*closing:0});
     if((a===active||b===active)&&closing>.6&&(!impact||closing>impact.speed)){const sign=a===active?1:-1;impact={speed:closing,normal:{x:n.x*sign,z:n.z*sign},kind:a===active?b.kind:a.kind,deltaV:0,energy:0};activeContact={impact,beforeV:{x:active.vx,z:active.vz},a,b,energyBefore:kinetic(a)+kinetic(b)};}
    }
   }
   // Accumulated impulses converge head-on two-point contacts without artificial spin.
   for(let iteration=0;iteration<30;iteration++)for(const c of constraints){const {a,b,p,n,t}=c;
    const next=Math.max(0,c.normalImpulse+(c.target-dot(relative(a,b,p),n))/effectiveMass(a,b,p,n)),j=next-c.normalImpulse;c.normalImpulse=next;impulse(a,p,n,j);impulse(b,p,n,-j);
    const limit=Math.sqrt(a.friction*b.friction)*c.normalImpulse,nextT=clamp(c.tangentImpulse-dot(relative(a,b,p),t)/effectiveMass(a,b,p,t),-limit,limit),jt=nextT-c.tangentImpulse;c.tangentImpulse=nextT;impulse(a,p,t,jt);impulse(b,p,t,-jt);
   }
   if(activeContact){const c=activeContact,other=c.a===active?c.b:c.a;const lost=Math.max(0,c.energyBefore-kinetic(c.a)-kinetic(c.b));c.impact.energy=lost*(other.mass?other.mass/(other.mass+active.mass):1);c.impact.deltaV=Math.hypot(active.vx-c.beforeV.x,active.vz-c.beforeV.z);}
  }
  // Parked cars have rolling/sliding resistance, but remain movable after a hit.
  for(const b of dynamic){const damp=Math.exp(-dt*1.3);b.vx*=damp;b.vz*=damp;b.yawRate*=Math.exp(-dt*2.5);if(Math.hypot(b.vx,b.vz)<.015){b.vx=b.vz=0;}if(Math.abs(b.yawRate)<.004)b.yawRate=0;b.onMove?.(b);}
  return impact;
 }
 return {statics,dynamic,addStatic,addDynamic,advance};
}
