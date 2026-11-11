// Driving line for circuits: per-car cornering and braking speeds along the
// route, drawn as chevrons that turn amber/red where the car must slow down.
import * as THREE from '../vendor/three.module.min.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>{a%=Math.PI*2;return a>Math.PI?a-Math.PI*2:a<-Math.PI?a+Math.PI*2:a;};
export const LINE_TOP_SPEED=140;
// Pure: target speed (m/s) and lateral offset (m, towards the inside) per route point.
export function computeLine(route,specs,halfWidth){
 const seg=route.segments,n=seg.length,heading=seg.map(s=>Math.atan2(s.tx,s.tz));
 const curvature=span=>{const out=new Float32Array(n);for(let i=0;i<n;i++){let length=0;for(let k=-span;k<span;k++)length+=seg[(i+k+n)%n].len;out[i]=wrap(heading[(i+span-1)%n]-heading[(i-span+n)%n])/Math.max(length,1);}return out;};
 const tight=curvature(3),wide=curvature(7);
 const mu=(specs.tireGrip||1.08)*.9,grip=mu*9.81,aero=mu*(specs.downforce||0)/specs.mass;
 const speed=new Float32Array(n);
 for(let i=0;i<n;i++){const need=Math.abs(tight[i])-aero;speed[i]=need>grip/LINE_TOP_SPEED**2?Math.sqrt(grip/need):LINE_TOP_SPEED;}
 // Walk backwards (twice, to close the loop) so braking starts early enough.
 for(let pass=0;pass<2;pass++)for(let i=n-1;i>=0;i--){const next=speed[(i+1)%n],brake=grip*.8+aero*.6*next*next;speed[i]=Math.min(speed[i],Math.sqrt(next*next+2*brake*seg[i].len));}
 const raw=new Float32Array(n),offset=new Float32Array(n),reach=Math.max(0,halfWidth-1.7);
 for(let i=0;i<n;i++)raw[i]=clamp(wide[i]*55,-1,1)*reach;
 for(let i=0;i<n;i++){let sum=0;for(let k=-5;k<=5;k++)sum+=raw[(i+k+n)%n];offset[i]=sum/11;}
 return {speed,offset};
}
export function lineTone(carSpeed,target){const ratio=carSpeed/Math.max(target,1);return ratio>1.07?'brake':ratio>.95?'ease':'go';}
const COUNT=54,SPACING=7,COLORS={go:new THREE.Color('#2fc6ff'),ease:new THREE.Color('#ffc21a'),brake:new THREE.Color('#ff3527')};
export function createDrivingLine(route,specs,halfWidth){
 const line=computeLine(route,specs,halfWidth),seg=route.segments;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.8, .55,0,-.2, .55,0,-.8, 0,0,-.2, -.55,0,-.8, -.55,0,-.2],3));geometry.setIndex([0,1,3,1,2,3,0,3,5,3,4,5]);
 const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide,fog:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
 const mesh=new THREE.InstancedMesh(geometry,material,COUNT);mesh.frustumCulled=false;mesh.renderOrder=2;mesh.visible=false;
 const dummy=new THREE.Object3D();dummy.rotation.order='YXZ';
 function indexAt(distance){const d=((distance%route.length)+route.length)%route.length;let lo=0,hi=seg.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(seg[mid].start<=d)lo=mid;else hi=mid;}return [lo,d-seg[lo].start];}
 return {
  mesh,data:line,
  // mode: 'off' | 'brake' (only where slowing is needed) | 'full'
  update(progress,carSpeed,mode){
   mesh.visible=mode!=='off';if(!mesh.visible)return;
   const first=Math.ceil((progress+9)/SPACING)*SPACING;
   for(let k=0;k<COUNT;k++){
    const [i,along]=indexAt(first+k*SPACING),s=seg[i],tone=lineTone(carSpeed,line.speed[i]),shown=mode==='full'||tone!=='go';
    const side=line.offset[i];
    dummy.position.set(s.a.x+s.tx*along+s.tz*side,s.a.y+s.grade*along+.05,s.a.z+s.tz*along-s.tx*side);
    dummy.rotation.set(-Math.atan(s.grade),Math.atan2(s.tx,s.tz),0);dummy.scale.setScalar(shown?1+k*.012:0);dummy.updateMatrix();
    mesh.setMatrixAt(k,dummy.matrix);mesh.setColorAt(k,COLORS[tone]);
   }
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  },
  dispose(){geometry.dispose();material.dispose();},
 };
}
